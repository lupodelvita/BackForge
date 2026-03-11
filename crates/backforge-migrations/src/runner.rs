use crate::diff::compute_diff;
use crate::generator::{generate_migration_sql, migration_filename};
use crate::{MigrationError, MigrationResult};
use backforge_core::project::schema::ProjectSchema;
use sqlx::PgPool;
use std::path::PathBuf;

pub struct MigrationRunner {
    pub pool: PgPool,
    pub migrations_dir: PathBuf,
}

impl MigrationRunner {
    pub fn new(pool: PgPool, migrations_dir: impl Into<PathBuf>) -> Self {
        Self {
            pool,
            migrations_dir: migrations_dir.into(),
        }
    }

    /// Инициализировать таблицу для хранения истории миграций
    pub async fn init(&self) -> MigrationResult<()> {
        sqlx::query(
            r#"
            CREATE TABLE IF NOT EXISTS _backforge_migrations (
                id          SERIAL PRIMARY KEY,
                filename    TEXT NOT NULL UNIQUE,
                applied_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
            )
            "#,
        )
        .execute(&self.pool)
        .await?;
        Ok(())
    }

    /// Применить новые миграции из папки
    pub async fn run_pending(&self) -> MigrationResult<Vec<String>> {
        self.init().await?;

        let applied: Vec<String> =
            sqlx::query_scalar("SELECT filename FROM _backforge_migrations ORDER BY id")
                .fetch_all(&self.pool)
                .await?;

        let mut migration_files: Vec<PathBuf> =
            std::fs::read_dir(&self.migrations_dir)
                .map_err(|e| MigrationError::Failed {
                    reason: e.to_string(),
                })?
                .filter_map(|e| e.ok())
                .map(|e| e.path())
                .filter(|p| p.extension().map(|e| e == "sql").unwrap_or(false))
                .collect();

        migration_files.sort();

        let mut ran = Vec::new();

        for file in migration_files {
            let filename = file.file_name().unwrap().to_string_lossy().into_owned();
            if applied.contains(&filename) {
                continue;
            }

            let sql = std::fs::read_to_string(&file).map_err(|e| MigrationError::Failed {
                reason: e.to_string(),
            })?;

            tracing::info!("Applying migration: {}", filename);

            sqlx::query(&sql).execute(&self.pool).await?;

            sqlx::query("INSERT INTO _backforge_migrations (filename) VALUES ($1)")
                .bind(&filename)
                .execute(&self.pool)
                .await?;

            ran.push(filename);
        }

        Ok(ran)
    }

    /// Сгенерировать файл миграции из diff двух схем
    pub fn generate_migration(
        &self,
        old_schema: &ProjectSchema,
        new_schema: &ProjectSchema,
        description: &str,
    ) -> MigrationResult<Option<PathBuf>> {
        let diffs = compute_diff(old_schema, new_schema);

        if diffs.is_empty() {
            tracing::info!("No schema changes detected, skipping migration");
            return Ok(None);
        }

        let step = self.next_step_number()?;
        let filename = migration_filename(step, description);
        let sql = generate_migration_sql(&diffs, description);

        std::fs::create_dir_all(&self.migrations_dir).map_err(|e| MigrationError::Failed {
            reason: e.to_string(),
        })?;

        let file_path = self.migrations_dir.join(&filename);
        std::fs::write(&file_path, sql).map_err(|e| MigrationError::Failed {
            reason: e.to_string(),
        })?;

        tracing::info!("Generated migration: {}", filename);
        Ok(Some(file_path))
    }

    fn next_step_number(&self) -> MigrationResult<u32> {
        if !self.migrations_dir.exists() {
            return Ok(1);
        }
        let count = std::fs::read_dir(&self.migrations_dir)
            .map_err(|e| MigrationError::Failed {
                reason: e.to_string(),
            })?
            .filter_map(|e| e.ok())
            .filter(|e| {
                e.path()
                    .extension()
                    .map(|ext| ext == "sql")
                    .unwrap_or(false)
            })
            .count();
        Ok(count as u32 + 1)
    }
}
