use super::project::projects_dir;

#[allow(dead_code)]
pub fn cmd_migrate_generate(project_name: String, description: String) {
    let _dir = projects_dir();
    println!("Generating migration for project '{}'...", project_name);
    println!("Description: {}", description);
    println!("(Full DB apply in Phase 2.5 — requires live connection)");
}

#[allow(dead_code)]
pub fn cmd_migrate_status(project_name: String) {
    println!(
        "Migration status for '{}': (requires DB connection)",
        project_name
    );
}
