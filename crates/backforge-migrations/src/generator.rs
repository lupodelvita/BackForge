use crate::diff::{compute_diff, FieldDiff, SchemaDiff};
use backforge_core::project::schema::{FieldType, ProjectSchema};
use chrono::Utc;
use std::path::{Path, PathBuf};

/// Конвертировать FieldType в PostgreSQL тип
pub fn field_type_to_sql(ft: &FieldType) -> &'static str {
    match ft {
        FieldType::Text => "TEXT",
        FieldType::Integer => "INTEGER",
        FieldType::BigInt => "BIGINT",
        FieldType::Float => "DOUBLE PRECISION",
        FieldType::Boolean => "BOOLEAN",
        FieldType::Uuid => "UUID",
        FieldType::Timestamp => "TIMESTAMPTZ",
        FieldType::Json => "JSONB",
        FieldType::Bytes => "BYTEA",
    }
}

/// Сгенерировать имя файла миграции
pub fn migration_filename(step: u32, description: &str) -> String {
    let clean = description.replace(' ', "_").to_lowercase();
    format!("{:03}_{}.sql", step, clean)
}

/// Сгенерировать SQL для одного diff
pub fn diff_to_sql(diff: &SchemaDiff) -> String {
    match diff {
        SchemaDiff::CreateTable { table_name, fields } => {
            let cols: Vec<String> = fields.iter().map(field_def_to_sql).collect();
            format!(
                "CREATE TABLE IF NOT EXISTS \"{}\" (\n  {}\n);",
                table_name,
                cols.join(",\n  ")
            )
        }
        SchemaDiff::DropTable { table_name } => {
            format!("DROP TABLE IF EXISTS \"{}\";", table_name)
        }
        SchemaDiff::AddColumn {
            table_name,
            column_name,
            field_type,
            nullable,
            default_value,
        } => {
            let null_str = if *nullable { "" } else { " NOT NULL" };
            let default_str = default_value
                .as_ref()
                .map(|d| format!(" DEFAULT {}", d))
                .unwrap_or_default();
            format!(
                "ALTER TABLE \"{}\" ADD COLUMN IF NOT EXISTS \"{}\" {}{}{};",
                table_name,
                column_name,
                field_type_to_sql(field_type),
                null_str,
                default_str
            )
        }
        SchemaDiff::DropColumn {
            table_name,
            column_name,
        } => {
            format!(
                "ALTER TABLE \"{}\" DROP COLUMN IF EXISTS \"{}\";",
                table_name, column_name
            )
        }
        SchemaDiff::AddIndex {
            table_name,
            index_name,
            columns,
            unique,
        } => {
            let unique_str = if *unique { "UNIQUE " } else { "" };
            let cols = columns
                .iter()
                .map(|c| format!("\"{}\"", c))
                .collect::<Vec<_>>()
                .join(", ");
            format!(
                "CREATE {}INDEX IF NOT EXISTS \"{}\" ON \"{}\" ({});",
                unique_str, index_name, table_name, cols
            )
        }
        SchemaDiff::DropIndex { index_name, .. } => {
            format!("DROP INDEX IF EXISTS \"{}\";", index_name)
        }
        SchemaDiff::AlterColumn {
            table_name,
            column_name,
            new_type,
        } => {
            format!(
                "ALTER TABLE \"{}\" ALTER COLUMN \"{}\" TYPE {} USING \"{}\"::{};",
                table_name,
                column_name,
                field_type_to_sql(new_type),
                column_name,
                field_type_to_sql(new_type)
            )
        }
    }
}

fn field_def_to_sql(f: &FieldDiff) -> String {
    let type_str = field_type_to_sql(&f.field_type);
    let pk = if f.primary_key { " PRIMARY KEY" } else { "" };
    let null_str = if f.nullable && !f.primary_key {
        ""
    } else {
        " NOT NULL"
    };
    let unique_str = if f.unique && !f.primary_key {
        " UNIQUE"
    } else {
        ""
    };
    let default_str = f
        .default_value
        .as_ref()
        .map(|d| format!(" DEFAULT {}", d))
        .unwrap_or_default();
    format!(
        "\"{}\" {}{}{}{}{}",
        f.name, type_str, pk, null_str, unique_str, default_str
    )
}

/// Сгенерировать полный SQL файл миграции
pub fn generate_migration_sql(diffs: &[SchemaDiff], description: &str) -> String {
    let statements: Vec<String> = diffs.iter().map(diff_to_sql).collect();
    format!(
        "-- BackForge Migration: {}\n-- Generated: {}\n\n{}\n",
        description,
        Utc::now().format("%Y-%m-%d %H:%M:%S UTC"),
        statements.join("\n\n")
    )
}

/// Сгенерировать файл миграции без подключения к БД (offline).
/// Сравнивает old_schema и new_schema, пишет .sql файл в `migrations_dir`.
/// Возвращает `None` если изменений нет.
pub fn generate_migration_file(
    old_schema: &ProjectSchema,
    new_schema: &ProjectSchema,
    description: &str,
    migrations_dir: impl AsRef<Path>,
) -> crate::MigrationResult<Option<PathBuf>> {
    let diffs = compute_diff(old_schema, new_schema);
    if diffs.is_empty() {
        return Ok(None);
    }
    let dir = migrations_dir.as_ref();
    let step = count_existing_migrations(dir)?;
    let filename = migration_filename(step, description);
    let sql = generate_migration_sql(&diffs, description);
    std::fs::create_dir_all(dir).map_err(|e| crate::MigrationError::Failed { reason: e.to_string() })?;
    let path = dir.join(&filename);
    std::fs::write(&path, sql).map_err(|e| crate::MigrationError::Failed { reason: e.to_string() })?;
    Ok(Some(path))
}

pub(crate) fn count_existing_migrations(dir: &Path) -> crate::MigrationResult<u32> {
    if !dir.exists() {
        return Ok(1);
    }
    let count = std::fs::read_dir(dir)
        .map_err(|e| crate::MigrationError::Failed { reason: e.to_string() })?
        .filter_map(|e| e.ok())
        .filter(|e| e.path().extension().map(|x| x == "sql").unwrap_or(false))
        .count();
    Ok(count as u32 + 1)
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::diff::{FieldDiff, SchemaDiff};
    use backforge_core::project::schema::FieldType;

    #[test]
    fn test_create_table_sql() {
        let diff = SchemaDiff::CreateTable {
            table_name: "users".to_string(),
            fields: vec![
                FieldDiff {
                    name: "id".to_string(),
                    field_type: FieldType::Uuid,
                    nullable: false,
                    primary_key: true,
                    unique: false,
                    default_value: None,
                },
                FieldDiff {
                    name: "email".to_string(),
                    field_type: FieldType::Text,
                    nullable: false,
                    primary_key: false,
                    unique: true,
                    default_value: None,
                },
            ],
        };
        let sql = diff_to_sql(&diff);
        assert!(sql.contains("CREATE TABLE IF NOT EXISTS \"users\""));
        assert!(sql.contains("\"id\" UUID PRIMARY KEY NOT NULL"));
        assert!(sql.contains("\"email\" TEXT NOT NULL UNIQUE"));
    }

    #[test]
    fn test_add_column_sql() {
        let diff = SchemaDiff::AddColumn {
            table_name: "users".to_string(),
            column_name: "avatar_url".to_string(),
            field_type: FieldType::Text,
            nullable: true,
            default_value: None,
        };
        let sql = diff_to_sql(&diff);
        assert!(sql.contains("ALTER TABLE \"users\" ADD COLUMN IF NOT EXISTS \"avatar_url\" TEXT"));
    }

    #[test]
    fn test_generate_migration_file_creates_sql() {
        use backforge_core::project::schema::{Field, FieldType, ProjectSchema, Table};
        use tempfile::tempdir;
        use uuid::Uuid;

        let dir = tempdir().unwrap();

        let old = ProjectSchema::default();
        let mut new = ProjectSchema::default();
        new.tables.push(Table {
            id: Uuid::new_v4(),
            name: "orders".to_string(),
            fields: vec![Field {
                id: Uuid::new_v4(),
                name: "id".to_string(),
                field_type: FieldType::Uuid,
                nullable: false,
                primary_key: true,
                unique: false,
                default_value: None,
            }],
            indexes: vec![],
        });

        let path = generate_migration_file(&old, &new, "add_orders", dir.path())
            .unwrap()
            .expect("should generate a file");

        assert!(path.exists());
        let content = std::fs::read_to_string(&path).unwrap();
        assert!(content.contains("CREATE TABLE IF NOT EXISTS \"orders\""));
        assert!(content.contains("-- BackForge Migration: add_orders"));
    }

    #[test]
    fn test_generate_migration_file_no_changes_returns_none() {
        use backforge_core::project::schema::ProjectSchema;
        use tempfile::tempdir;

        let dir = tempdir().unwrap();
        let schema = ProjectSchema::default();

        let result = generate_migration_file(&schema, &schema, "noop", dir.path()).unwrap();
        assert!(result.is_none());
    }

    #[test]
    fn test_generate_migration_file_step_increments() {
        use backforge_core::project::schema::{Field, FieldType, ProjectSchema, Table};
        use tempfile::tempdir;
        use uuid::Uuid;

        let dir = tempdir().unwrap();

        let make_schema = |name: &str| {
            let mut s = ProjectSchema::default();
            s.tables.push(Table {
                id: Uuid::new_v4(),
                name: name.to_string(),
                fields: vec![Field {
                    id: Uuid::new_v4(),
                    name: "id".to_string(),
                    field_type: FieldType::Integer,
                    nullable: false,
                    primary_key: true,
                    unique: false,
                    default_value: None,
                }],
                indexes: vec![],
            });
            s
        };

        let empty = ProjectSchema::default();
        let s1 = make_schema("alpha");
        let s2 = make_schema("beta");

        let p1 = generate_migration_file(&empty, &s1, "first", dir.path())
            .unwrap()
            .unwrap();
        let p2 = generate_migration_file(&s1, &s2, "second", dir.path())
            .unwrap()
            .unwrap();

        let n1 = p1.file_name().unwrap().to_string_lossy();
        let n2 = p2.file_name().unwrap().to_string_lossy();
        assert!(n1.starts_with("001_"), "got: {}", n1);
        assert!(n2.starts_with("002_"), "got: {}", n2);
    }
}
