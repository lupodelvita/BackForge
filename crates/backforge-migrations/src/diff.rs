use backforge_core::project::schema::{FieldType, ProjectSchema};
use serde::{Deserialize, Serialize};

/// Одно изменение в схеме
#[derive(Debug, Clone, Serialize, Deserialize)]
pub enum SchemaDiff {
    CreateTable {
        table_name: String,
        fields: Vec<FieldDiff>,
    },
    DropTable {
        table_name: String,
    },
    AddColumn {
        table_name: String,
        column_name: String,
        field_type: FieldType,
        nullable: bool,
        default_value: Option<String>,
    },
    DropColumn {
        table_name: String,
        column_name: String,
    },
    AlterColumn {
        table_name: String,
        column_name: String,
        new_type: FieldType,
    },
    AddIndex {
        table_name: String,
        index_name: String,
        columns: Vec<String>,
        unique: bool,
    },
    DropIndex {
        table_name: String,
        index_name: String,
    },
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct FieldDiff {
    pub name: String,
    pub field_type: FieldType,
    pub nullable: bool,
    pub primary_key: bool,
    pub unique: bool,
    pub default_value: Option<String>,
}

/// Вычислить diff между старой и новой схемой
pub fn compute_diff(old: &ProjectSchema, new: &ProjectSchema) -> Vec<SchemaDiff> {
    let mut diffs = Vec::new();

    // Новые таблицы
    for new_table in &new.tables {
        if !old.tables.iter().any(|t| t.name == new_table.name) {
            diffs.push(SchemaDiff::CreateTable {
                table_name: new_table.name.clone(),
                fields: new_table
                    .fields
                    .iter()
                    .map(|f| FieldDiff {
                        name: f.name.clone(),
                        field_type: f.field_type.clone(),
                        nullable: f.nullable,
                        primary_key: f.primary_key,
                        unique: f.unique,
                        default_value: f.default_value.clone(),
                    })
                    .collect(),
            });
        }
    }

    // Удалённые таблицы
    for old_table in &old.tables {
        if !new.tables.iter().any(|t| t.name == old_table.name) {
            diffs.push(SchemaDiff::DropTable {
                table_name: old_table.name.clone(),
            });
        }
    }

    // Изменения внутри существующих таблиц
    for new_table in &new.tables {
        if let Some(old_table) = old.tables.iter().find(|t| t.name == new_table.name) {
            // Новые колонки
            for new_field in &new_table.fields {
                if !old_table.fields.iter().any(|f| f.name == new_field.name) {
                    diffs.push(SchemaDiff::AddColumn {
                        table_name: new_table.name.clone(),
                        column_name: new_field.name.clone(),
                        field_type: new_field.field_type.clone(),
                        nullable: new_field.nullable,
                        default_value: new_field.default_value.clone(),
                    });
                }
            }

            // Удалённые колонки
            for old_field in &old_table.fields {
                if !new_table.fields.iter().any(|f| f.name == old_field.name) {
                    diffs.push(SchemaDiff::DropColumn {
                        table_name: old_table.name.clone(),
                        column_name: old_field.name.clone(),
                    });
                }
            }

            // Изменения типов колонок
            for new_field in &new_table.fields {
                if let Some(old_field) = old_table.fields.iter().find(|f| f.name == new_field.name)
                {
                    if old_field.field_type != new_field.field_type {
                        diffs.push(SchemaDiff::AlterColumn {
                            table_name: new_table.name.clone(),
                            column_name: new_field.name.clone(),
                            new_type: new_field.field_type.clone(),
                        });
                    }
                }
            }

            // Индексы
            for new_idx in &new_table.indexes {
                if !old_table.indexes.iter().any(|i| i.name == new_idx.name) {
                    diffs.push(SchemaDiff::AddIndex {
                        table_name: new_table.name.clone(),
                        index_name: new_idx.name.clone(),
                        columns: new_idx.fields.clone(),
                        unique: new_idx.unique,
                    });
                }
            }
            for old_idx in &old_table.indexes {
                if !new_table.indexes.iter().any(|i| i.name == old_idx.name) {
                    diffs.push(SchemaDiff::DropIndex {
                        table_name: old_table.name.clone(),
                        index_name: old_idx.name.clone(),
                    });
                }
            }
        }
    }

    diffs
}

#[cfg(test)]
mod tests {
    use super::*;
    use backforge_core::project::schema::{Field, Table};

    #[test]
    fn test_diff_detects_new_table() {
        let old = ProjectSchema::default();
        let mut new = ProjectSchema::default();
        let mut t = Table::new("users");
        t.add_field(Field::new("id", FieldType::Uuid).primary_key());
        new.tables.push(t);

        let diffs = compute_diff(&old, &new);
        assert_eq!(diffs.len(), 1);
        assert!(
            matches!(&diffs[0], SchemaDiff::CreateTable { table_name, .. } if table_name == "users")
        );
    }

    #[test]
    fn test_diff_detects_new_column() {
        let mut old_schema = ProjectSchema::default();
        let mut table = Table::new("users");
        table.add_field(Field::new("id", FieldType::Uuid).primary_key());
        old_schema.tables.push(table);

        let mut new_schema = old_schema.clone();
        new_schema.tables[0].add_field(Field::new("email", FieldType::Text));

        let diffs = compute_diff(&old_schema, &new_schema);
        assert_eq!(diffs.len(), 1);
        assert!(
            matches!(&diffs[0], SchemaDiff::AddColumn { column_name, .. } if column_name == "email")
        );
    }

    #[test]
    fn test_diff_empty_when_no_changes() {
        let schema = ProjectSchema::default();
        let diffs = compute_diff(&schema, &schema);
        assert!(diffs.is_empty());
    }
}
