use backforge_core::{CoreResult, ProjectManager};
use std::path::PathBuf;

pub fn projects_dir() -> PathBuf {
    dirs::data_dir()
        .unwrap_or_else(|| PathBuf::from("."))
        .join("backforge")
        .join("projects")
}

pub fn cmd_create(name: String, description: String) -> CoreResult<()> {
    let manager = ProjectManager::new(projects_dir());
    let state = manager.create_project(&name, &description)?;
    println!("✓ Project '{}' created (id: {})", state.meta.name, state.meta.id);
    println!("  Path: {:?}", projects_dir().join(&name));
    Ok(())
}

pub fn cmd_list() -> CoreResult<()> {
    let manager = ProjectManager::new(projects_dir());
    let projects = manager.list_projects()?;

    if projects.is_empty() {
        println!("No projects found. Create one with: backforge project create <name>");
    } else {
        println!("Projects:");
        for name in &projects {
            println!("  - {}", name);
        }
    }
    Ok(())
}

pub fn cmd_info(name: String) -> CoreResult<()> {
    let manager = ProjectManager::new(projects_dir());
    let state = manager.load_project(&name)?;

    println!("Project: {}", state.meta.name);
    println!("  ID:          {}", state.meta.id);
    println!("  Description: {}", state.meta.description);
    println!("  Version:     {}", state.meta.version);
    println!("  Created:     {}", state.meta.created_at.format("%Y-%m-%d %H:%M UTC"));
    println!("  Tables:      {}", state.schema.tables.len());
    Ok(())
}
