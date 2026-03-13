use anyhow::{Context, Result};
use backforge_core::project::schema::ProjectSchema;
use backforge_core::ProjectManager;
use backforge_migrations::{generate_migration_file, MigrationRunner};
use backforge_versions::VersionStore;
use sqlx::postgres::PgPoolOptions;
use std::env;

use crate::commands::project::projects_dir;

fn migrations_dir(project: &str) -> std::path::PathBuf {
    projects_dir().join(project).join("migrations")
}

fn version_store(project: &str) -> VersionStore {
    VersionStore::new(projects_dir().join(project))
}

async fn make_pool() -> Result<sqlx::PgPool> {
    let url = env::var("DATABASE_URL")
        .context("DATABASE_URL не задан в окружении. Добавьте его в .env")?;
    PgPoolOptions::new()
        .max_connections(2)
        .connect(&url)
        .await
        .context("Не удалось подключиться к PostgreSQL")
}

// ── generate ──────────────────────────────────────────────────────────────

/// `backforge migrate generate <project> [--description <desc>] [--from-version <N>]`
///
/// Offline-команда: читает project_state, вычисляет diff относительно
/// предыдущей версии (или указанной через --from-version) и записывает
/// новый .sql файл в <project>/migrations/.
pub fn cmd_generate(
    project: String,
    description: String,
    from_version: Option<u32>,
) -> Result<()> {
    let manager = ProjectManager::new(projects_dir());
    let state = manager
        .load_project(&project)
        .map_err(|e| anyhow::anyhow!("{}", e))?;

    let new_schema = &state.schema;

    let old_schema: ProjectSchema = match from_version {
        Some(v) => {
            let store = version_store(&project);
            let snap = store
                .restore(v, &project)
                .map_err(|e| anyhow::anyhow!("версия {}: {}", v, e))?;
            snap.schema
        }
        None => {
            // Авто: берём последнюю сохранённую версию как базу.
            // Если версий нет — пустая схема (генерирует полный CREATE TABLE).
            let store = version_store(&project);
            match store.latest_version().map_err(|e| anyhow::anyhow!("{}", e))? {
                Some(v) => {
                    let snap = store
                        .restore(v, &project)
                        .map_err(|e| anyhow::anyhow!("{}", e))?;
                    snap.schema
                }
                None => ProjectSchema::default(),
            }
        }
    };

    let dir = migrations_dir(&project);
    match generate_migration_file(&old_schema, new_schema, &description, &dir)
        .map_err(|e| anyhow::anyhow!("{}", e))?
    {
        Some(path) => {
            println!("✓ Migration generated: {}", path.display());
            println!("  Review and apply with: backforge migrate run {}", project);
        }
        None => println!("✓ No schema changes detected — no migration needed."),
    }

    Ok(())
}

// ── run ───────────────────────────────────────────────────────────────────

/// `backforge migrate run <project>`
///
/// Подключается к PostgreSQL (DATABASE_URL) и применяет все ожидающие
/// миграции из <project>/migrations/.
pub async fn cmd_run(project: String) -> Result<()> {
    let pool = make_pool().await?;
    let runner = MigrationRunner::new(pool, migrations_dir(&project));

    let applied = runner
        .run_pending()
        .await
        .map_err(|e| anyhow::anyhow!("{}", e))?;

    if applied.is_empty() {
        println!("✓ No pending migrations for '{}'.", project);
    } else {
        println!("✓ Applied {} migration(s) for '{}':", applied.len(), project);
        for name in &applied {
            println!("  ✓ {}", name);
        }
    }

    Ok(())
}

// ── status ────────────────────────────────────────────────────────────────

/// `backforge migrate status <project>`
///
/// Показывает статус каждого файла миграции (применена / ожидает).
pub async fn cmd_status(project: String) -> Result<()> {
    let pool = make_pool().await?;
    let runner = MigrationRunner::new(pool, migrations_dir(&project));

    let entries = runner
        .status()
        .await
        .map_err(|e| anyhow::anyhow!("{}", e))?;

    if entries.is_empty() {
        println!("No migration files found for '{}'. Generate one first:", project);
        println!("  backforge migrate generate {} \"initial\"", project);
        return Ok(());
    }

    println!("Migration status for '{}':", project);
    println!();
    println!("  {:<6}  {:<40}  {}", "Status", "File", "Applied at");
    println!("  {}", "-".repeat(72));
    for e in &entries {
        if e.applied {
            let ts = e
                .applied_at
                .map(|t| t.format("%Y-%m-%d %H:%M UTC").to_string())
                .unwrap_or_default();
            println!("  ✓      {:<40}  {}", e.filename, ts);
        } else {
            println!("  ⦿      {:<40}  (pending)", e.filename);
        }
    }

    Ok(())
}

// ── rollback ──────────────────────────────────────────────────────────────

/// `backforge migrate rollback <project>`
///
/// Убирает последнюю миграцию из таблицы отслеживания (_backforge_migrations).
/// SQL-изменения **не откатываются** автоматически — нужно написать
/// обратный SQL вручную (или восстановить БД из snapshot).
pub async fn cmd_rollback(project: String) -> Result<()> {
    let pool = make_pool().await?;
    let runner = MigrationRunner::new(pool, migrations_dir(&project));

    // Сначала показать что будем убирать
    let entries = runner
        .status()
        .await
        .map_err(|e| anyhow::anyhow!("{}", e))?;
    let last_applied = entries.iter().rev().find(|e| e.applied);

    match last_applied {
        None => {
            println!("Nothing to roll back for '{}'.", project);
        }
        Some(entry) => {
            println!("Rolling back: {}", entry.filename);
            println!();
            println!("  ⚠ SQL changes are NOT automatically reverted.");
            println!("  Run the reverse SQL manually in psql, then this command");
            println!("  removes the migration from the tracking table.");
            println!();

            runner
                .undo_last()
                .await
                .map_err(|e| anyhow::anyhow!("{}", e))?;

            println!("✓ '{}' removed from migration tracking.", entry.filename);
            println!(
                "  Re-apply with: backforge migrate run {}",
                project
            );
        }
    }

    Ok(())
}

