use crate::diff::{FieldDiff, SchemaDiff};
use backforge_core::project::schema::FieldType;
use chrono::Utc;

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
}
