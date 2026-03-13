use serde::{Deserialize, Serialize};
use backforge_core::{ProjectState, project::schema::{Table, FieldType}};

/// Тип изменения
#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum ChangeKind {
    Added,
    Removed,
    Modified,
}

impl std::fmt::Display for ChangeKind {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        match self {
            ChangeKind::Added => write!(f, "added"),
            ChangeKind::Removed => write!(f, "removed"),
            ChangeKind::Modified => write!(f, "modified"),
        }
    }
}

/// Изменение одного поля таблицы
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct FieldChange {
    pub field_name: String,
    pub kind: ChangeKind,
    /// Тип поля "до" (None если поле добавлено)
    pub old_type: Option<String>,
    /// Тип поля "после" (None если поле удалено)
    pub new_type: Option<String>,
}

/// Изменения в одной таблице
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct TableChange {
    pub table_name: String,
    pub kind: ChangeKind,
    /// Изменения полей (только при kind == Modified)
    pub field_changes: Vec<FieldChange>,
}

/// Полное diff между двумя состояниями проекта
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct StateDiff {
    pub from_version: u32,
    pub to_version: u32,
    pub table_changes: Vec<TableChange>,
}

impl StateDiff {
    /// Вычислить diff между двумя состояниями
    pub fn compute(from_version: u32, from: &ProjectState, to_version: u32, to: &ProjectState) -> Self {
        let mut table_changes = Vec::new();

        // Таблицы, которые были удалены
        for old_table in &from.schema.tables {
            if !to.schema.tables.iter().any(|t| t.name == old_table.name) {
                table_changes.push(TableChange {
                    table_name: old_table.name.clone(),
                    kind: ChangeKind::Removed,
                    field_changes: Vec::new(),
                });
            }
        }

        // Таблицы, которые были добавлены
        for new_table in &to.schema.tables {
            if !from.schema.tables.iter().any(|t| t.name == new_table.name) {
                table_changes.push(TableChange {
                    table_name: new_table.name.clone(),
                    kind: ChangeKind::Added,
                    field_changes: Vec::new(),
                });
            }
        }

        // Таблицы, которые существовали в обоих — сравниваем поля
        for old_table in &from.schema.tables {
            if let Some(new_table) = to.schema.tables.iter().find(|t| t.name == old_table.name) {
                let field_changes = diff_fields(old_table, new_table);
                if !field_changes.is_empty() {
                    table_changes.push(TableChange {
                        table_name: old_table.name.clone(),
                        kind: ChangeKind::Modified,
                        field_changes,
                    });
                }
            }
        }

        Self {
            from_version,
            to_version,
            table_changes,
        }
    }

    /// Нет ли изменений вообще
    pub fn is_empty(&self) -> bool {
        self.table_changes.is_empty()
    }

    /// Человекочитаемый текстовый отчёт
    pub fn render(&self) -> String {
        if self.is_empty() {
            return format!("No changes between v{} and v{}", self.from_version, self.to_version);
        }

        let mut out = format!("Diff v{} → v{}\n", self.from_version, self.to_version);
        for tc in &self.table_changes {
            match tc.kind {
                ChangeKind::Added => out.push_str(&format!("  + table: {}\n", tc.table_name)),
                ChangeKind::Removed => out.push_str(&format!("  - table: {}\n", tc.table_name)),
                ChangeKind::Modified => {
                    out.push_str(&format!("  ~ table: {}\n", tc.table_name));
                    for fc in &tc.field_changes {
                        match fc.kind {
                            ChangeKind::Added => out.push_str(&format!(
                                "      + field: {} ({})\n",
                                fc.field_name,
                                fc.new_type.as_deref().unwrap_or("?")
                            )),
                            ChangeKind::Removed => out.push_str(&format!(
                                "      - field: {} ({})\n",
                                fc.field_name,
                                fc.old_type.as_deref().unwrap_or("?")
                            )),
                            ChangeKind::Modified => out.push_str(&format!(
                                "      ~ field: {} ({} → {})\n",
                                fc.field_name,
                                fc.old_type.as_deref().unwrap_or("?"),
                                fc.new_type.as_deref().unwrap_or("?")
                            )),
                        }
                    }
                }
            }
        }
        out
    }
}

fn field_type_name(ft: &FieldType) -> &'static str {
    match ft {
        FieldType::Text => "text",
        FieldType::Integer => "integer",
        FieldType::BigInt => "big_int",
        FieldType::Float => "float",
        FieldType::Boolean => "boolean",
        FieldType::Uuid => "uuid",
        FieldType::Timestamp => "timestamp",
        FieldType::Json => "json",
        FieldType::Bytes => "bytes",
    }
}

fn diff_fields(old: &Table, new: &Table) -> Vec<FieldChange> {
    let mut changes = Vec::new();

    // Удалённые поля
    for old_f in &old.fields {
        if !new.fields.iter().any(|f| f.name == old_f.name) {
            changes.push(FieldChange {
                field_name: old_f.name.clone(),
                kind: ChangeKind::Removed,
                old_type: Some(field_type_name(&old_f.field_type).to_string()),
                new_type: None,
            });
        }
    }

    // Добавленные поля
    for new_f in &new.fields {
        if !old.fields.iter().any(|f| f.name == new_f.name) {
            changes.push(FieldChange {
                field_name: new_f.name.clone(),
                kind: ChangeKind::Added,
                old_type: None,
                new_type: Some(field_type_name(&new_f.field_type).to_string()),
            });
        }
    }

    // Изменённые типы
    for old_f in &old.fields {
        if let Some(new_f) = new.fields.iter().find(|f| f.name == old_f.name) {
            let old_type = field_type_name(&old_f.field_type);
            let new_type = field_type_name(&new_f.field_type);
            if old_type != new_type {
                changes.push(FieldChange {
                    field_name: old_f.name.clone(),
                    kind: ChangeKind::Modified,
                    old_type: Some(old_type.to_string()),
                    new_type: Some(new_type.to_string()),
                });
            }
        }
    }

    changes
}

#[cfg(test)]
mod tests {
    use super::*;
    use backforge_core::{ProjectState, project::schema::{Table, Field, FieldType}};

    fn state_with_tables(tables: Vec<(&str, Vec<(&str, FieldType)>)>) -> ProjectState {
        let mut state = ProjectState::new("app", "");
        for (tname, fields) in tables {
            let mut t = Table::new(tname);
            for (fname, ftype) in fields {
                t.add_field(Field::new(fname, ftype));
            }
            state.schema.tables.push(t);
        }
        state
    }

    #[test]
    fn test_no_changes() {
        let s = state_with_tables(vec![("users", vec![("id", FieldType::Uuid)])]);
        let diff = StateDiff::compute(1, &s, 2, &s);
        assert!(diff.is_empty());
        assert!(diff.render().contains("No changes"));
    }

    #[test]
    fn test_table_added() {
        let from = state_with_tables(vec![]);
        let to = state_with_tables(vec![("posts", vec![("id", FieldType::Uuid)])]);
        let diff = StateDiff::compute(1, &from, 2, &to);
        assert_eq!(diff.table_changes.len(), 1);
        assert_eq!(diff.table_changes[0].kind, ChangeKind::Added);
        assert_eq!(diff.table_changes[0].table_name, "posts");
    }

    #[test]
    fn test_table_removed() {
        let from = state_with_tables(vec![("users", vec![])]);
        let to = state_with_tables(vec![]);
        let diff = StateDiff::compute(1, &from, 2, &to);
        assert_eq!(diff.table_changes.len(), 1);
        assert_eq!(diff.table_changes[0].kind, ChangeKind::Removed);
    }

    #[test]
    fn test_field_added_to_existing_table() {
        let from = state_with_tables(vec![("users", vec![("id", FieldType::Uuid)])]);
        let to = state_with_tables(vec![("users", vec![
            ("id", FieldType::Uuid),
            ("email", FieldType::Text),
        ])]);
        let diff = StateDiff::compute(1, &from, 2, &to);
        assert_eq!(diff.table_changes.len(), 1);
        assert_eq!(diff.table_changes[0].kind, ChangeKind::Modified);
        let fc = &diff.table_changes[0].field_changes;
        assert_eq!(fc.len(), 1);
        assert_eq!(fc[0].field_name, "email");
        assert_eq!(fc[0].kind, ChangeKind::Added);
    }

    #[test]
    fn test_field_type_changed() {
        let from = state_with_tables(vec![("t", vec![("x", FieldType::Integer)])]);
        let to = state_with_tables(vec![("t", vec![("x", FieldType::BigInt)])]);
        let diff = StateDiff::compute(1, &from, 2, &to);
        let fc = &diff.table_changes[0].field_changes;
        assert_eq!(fc[0].kind, ChangeKind::Modified);
        assert_eq!(fc[0].old_type.as_deref(), Some("integer"));
        assert_eq!(fc[0].new_type.as_deref(), Some("big_int"));
    }

    #[test]
    fn test_render_output() {
        let from = state_with_tables(vec![("users", vec![("id", FieldType::Uuid)])]);
        let to = state_with_tables(vec![
            ("users", vec![("id", FieldType::Uuid), ("name", FieldType::Text)]),
            ("posts", vec![]),
        ]);
        let diff = StateDiff::compute(1, &from, 2, &to);
        let rendered = diff.render();
        assert!(rendered.contains("v1 → v2"));
        assert!(rendered.contains("+ table: posts"));
        assert!(rendered.contains("+ field: name"));
    }
}
