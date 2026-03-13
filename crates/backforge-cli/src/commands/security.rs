use anyhow::Result;
use backforge_audit::{AuditAction, AuditEntry, AuditLog};
use backforge_core::{
    project::permissions::{Action, Resource, Role},
    ProjectManager,
};
use crate::commands::project::projects_dir;

fn audit_log(project: &str) -> AuditLog {
    AuditLog::new(projects_dir().join(project))
}

// ── Permissions commands ───────────────────────────────────────────────────

/// `backforge security permissions show <project>`
/// Показать таблицу RBAC-политик проекта
pub fn cmd_permissions_show(project: String) -> Result<()> {
    let manager = ProjectManager::new(projects_dir());
    let state = manager
        .load_project(&project)
        .map_err(|e| anyhow::anyhow!("{}", e))?;

    let policy = &state.permissions;

    println!("RBAC policy for project '{}' ({} rules)", project, policy.permissions.len());
    println!();
    println!("{:<12} {:<18} {:<18} {:<6}", "Role", "Action", "Resource", "Allow");
    println!("{}", "-".repeat(60));

    for p in &policy.permissions {
        let resource_str = match &p.resource {
            Resource::Table(t) => format!("table:{}", t),
            Resource::AllTables => "all_tables".into(),
            Resource::System => "system".into(),
        };
        let role_str = match &p.role {
            Role::Admin => "admin".into(),
            Role::Editor => "editor".into(),
            Role::Viewer => "viewer".into(),
            Role::Custom(r) => r.clone(),
        };
        let action_str = format!("{:?}", p.action).to_lowercase();
        let allow_icon = if p.allow { "✓" } else { "✗" };

        println!(
            "{:<12} {:<18} {:<18} {}",
            role_str, action_str, resource_str, allow_icon
        );
    }

    Ok(())
}

/// `backforge security permissions check <project> --role <role> --action <action> --resource <resource>`
/// Проверить, разрешено ли действие для роли
pub fn cmd_permissions_check(
    project: String,
    role: String,
    action: String,
    resource: String,
) -> Result<()> {
    let manager = ProjectManager::new(projects_dir());
    let state = manager
        .load_project(&project)
        .map_err(|e| anyhow::anyhow!("{}", e))?;

    let role_val = parse_role(&role)?;
    let action_val = parse_action(&action)?;
    let resource_val = parse_resource(&resource)?;

    let allowed = state
        .permissions
        .is_allowed(&role_val, &action_val, &resource_val);

    let icon = if allowed { "✓ ALLOWED" } else { "✗ DENIED" };
    println!(
        "{} — role='{}' action='{}' resource='{}' on project '{}'",
        icon, role, action, resource, project
    );

    if !allowed {
        std::process::exit(1);
    }

    Ok(())
}

// ── Audit log commands ─────────────────────────────────────────────────────

/// `backforge security audit show <project> [--last N]`
/// Показать последние N записей audit log
pub fn cmd_audit_show(project: String, last: usize) -> Result<()> {
    let log = audit_log(&project);
    let entries = log
        .read_recent(last)
        .map_err(|e| anyhow::anyhow!("{}", e))?;

    if entries.is_empty() {
        println!("No audit entries for project '{}'.", project);
        return Ok(());
    }

    println!("Audit log for '{}' (last {} entries):", project, entries.len());
    println!();
    for entry in &entries {
        println!(
            "  {}  {:>10}  {}",
            entry.timestamp.format("%Y-%m-%d %H:%M:%S UTC"),
            entry.actor,
            entry.action
        );
    }

    Ok(())
}

/// `backforge security audit count <project>`
/// Число записей в audit log проекта
pub fn cmd_audit_count(project: String) -> Result<()> {
    let log = audit_log(&project);
    let count = log.count().map_err(|e| anyhow::anyhow!("{}", e))?;
    println!("Audit log for '{}': {} entries", project, count);
    Ok(())
}

/// Записать событие в audit log (используется другими командами)
pub fn audit_write(project: &str, actor: &str, action: AuditAction) {
    let entry = AuditEntry::new(project, actor, action);
    let log = audit_log(project);
    // Ошибки логирования не должны прерывать основную операцию
    if let Err(e) = log.append(&entry) {
        tracing::warn!("audit log write failed: {}", e);
    }
}

// ── Helpers ────────────────────────────────────────────────────────────────

fn parse_role(s: &str) -> Result<Role> {
    match s.to_lowercase().as_str() {
        "admin" => Ok(Role::Admin),
        "editor" => Ok(Role::Editor),
        "viewer" => Ok(Role::Viewer),
        other => Ok(Role::Custom(other.to_string())),
    }
}

fn parse_action(s: &str) -> Result<Action> {
    match s.to_lowercase().as_str() {
        "read" => Ok(Action::Read),
        "create" => Ok(Action::Create),
        "update" => Ok(Action::Update),
        "delete" => Ok(Action::Delete),
        "manage_schema" | "manageschema" => Ok(Action::ManageSchema),
        "manage_users" | "manageusers" => Ok(Action::ManageUsers),
        other => Err(anyhow::anyhow!(
            "unknown action '{}'. Valid: read, create, update, delete, manage_schema, manage_users",
            other
        )),
    }
}

fn parse_resource(s: &str) -> Result<Resource> {
    if s.eq_ignore_ascii_case("all") || s.eq_ignore_ascii_case("all_tables") {
        return Ok(Resource::AllTables);
    }
    if s.eq_ignore_ascii_case("system") {
        return Ok(Resource::System);
    }
    // Accept "table:users" or just "users"
    let table_name = s.strip_prefix("table:").unwrap_or(s);
    Ok(Resource::Table(table_name.to_string()))
}
