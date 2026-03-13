use anyhow::Result;
use backforge_core::ProjectManager;
use backforge_versions::{VersionStore, StateDiff};
use crate::commands::project::projects_dir;

fn version_store(project: &str) -> VersionStore {
    VersionStore::new(projects_dir().join(project))
}

/// `backforge version commit <project> [--message <msg>]`
/// Сохранить текущее состояние проекта как новый снимок
pub fn cmd_version_commit(project: String, message: Option<String>) -> Result<()> {
    let manager = ProjectManager::new(projects_dir());
    let state = manager.load_project(&project)
        .map_err(|e| anyhow::anyhow!("{}", e))?;

    let store = version_store(&project);
    let version = store.commit(&state, message.clone())
        .map_err(|e| anyhow::anyhow!("{}", e))?;

    println!("✓ Snapshot v{} created for '{}'", version, project);
    if let Some(msg) = message {
        println!("  Message: {}", msg);
    }
    println!("  Tables: {}", state.schema.tables.len());
    Ok(())
}

/// `backforge version history <project>`
/// Показать историю версий проекта
pub fn cmd_version_history(project: String) -> Result<()> {
    let store = version_store(&project);
    let history = store.history()
        .map_err(|e| anyhow::anyhow!("{}", e))?;

    if history.is_empty() {
        println!("No version history for '{}'. Use: backforge version commit {}", project, project);
        return Ok(());
    }

    println!("Version history for '{}':", project);
    println!("{:>5}  {:<30}  {:>7}  {}", "VER", "DATE", "TABLES", "MESSAGE");
    println!("{}", "-".repeat(70));
    for meta in &history {
        let date = meta.created_at.format("%Y-%m-%d %H:%M UTC");
        let msg = meta.message.as_deref().unwrap_or("-");
        println!("{:>5}  {:<30}  {:>7}  {}", meta.version, date, meta.table_count, msg);
    }
    Ok(())
}

/// `backforge version rollback <project> <version>`
/// Восстановить состояние проекта из указанного снимка
pub fn cmd_version_rollback(project: String, version: u32) -> Result<()> {
    let store = version_store(&project);

    // Сначала сохранить текущее состояние как авто-снимок
    let manager = ProjectManager::new(projects_dir());
    let current = manager.load_project(&project)
        .map_err(|e| anyhow::anyhow!("{}", e))?;

    let auto_v = store.commit(&current, Some(format!("auto-snapshot before rollback to v{}", version)))
        .map_err(|e| anyhow::anyhow!("{}", e))?;
    println!("  Auto-snapshot created: v{}", auto_v);

    // Восстановить указанную версию
    let restored = store.restore(version, &project)
        .map_err(|e| anyhow::anyhow!("{}", e))?;

    manager.save_project(&restored)
        .map_err(|e| anyhow::anyhow!("{}", e))?;

    println!("✓ Project '{}' rolled back to v{}", project, version);
    println!("  Tables: {}", restored.schema.tables.len());
    Ok(())
}

/// `backforge version diff <project> <from_version> <to_version>`
/// Показать diff между двумя версиями
pub fn cmd_version_diff(project: String, from: u32, to: u32) -> Result<()> {
    let store = version_store(&project);

    let from_state = store.restore(from, &project)
        .map_err(|e| anyhow::anyhow!("{}", e))?;
    let to_state = store.restore(to, &project)
        .map_err(|e| anyhow::anyhow!("{}", e))?;

    let diff = StateDiff::compute(from, &from_state, to, &to_state);
    println!("{}", diff.render());
    Ok(())
}

/// `backforge version show <project> <version>`
/// Показать метаданные конкретного снимка
pub fn cmd_version_show(project: String, version: u32) -> Result<()> {
    let store = version_store(&project);
    let snap = store.load_snapshot(version, &project)
        .map_err(|e| anyhow::anyhow!("{}", e))?;

    let m = &snap.meta;
    println!("Snapshot v{} — '{}'", m.version, project);
    println!("  Date:     {}", m.created_at.format("%Y-%m-%d %H:%M:%S UTC"));
    println!("  Tables:   {}", m.table_count);
    println!("  Checksum: {}", m.checksum);
    println!("  Message:  {}", m.message.as_deref().unwrap_or("-"));
    Ok(())
}
