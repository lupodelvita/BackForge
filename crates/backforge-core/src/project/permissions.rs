use serde::{Deserialize, Serialize};

/// Роль пользователя в проекте
#[derive(Debug, Clone, PartialEq, Eq, Hash, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum Role {
    /// Полный доступ — управление схемой, настройками, пользователями
    Admin,
    /// Чтение и запись данных, без изменения схемы
    Editor,
    /// Только чтение данных
    Viewer,
    /// Кастомная роль с явно заданными разрешениями
    Custom(String),
}

impl std::fmt::Display for Role {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        match self {
            Role::Admin => write!(f, "admin"),
            Role::Editor => write!(f, "editor"),
            Role::Viewer => write!(f, "viewer"),
            Role::Custom(n) => write!(f, "custom:{}", n),
        }
    }
}

/// Тип операции, которую разрешение защищает
#[derive(Debug, Clone, PartialEq, Eq, Hash, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum Action {
    Read,
    Create,
    Update,
    Delete,
    /// Управление схемой / настройки проекта
    ManageSchema,
    /// Управление пользователями и ролями
    ManageUsers,
}

impl std::fmt::Display for Action {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        match self {
            Action::Read => write!(f, "read"),
            Action::Create => write!(f, "create"),
            Action::Update => write!(f, "update"),
            Action::Delete => write!(f, "delete"),
            Action::ManageSchema => write!(f, "manage_schema"),
            Action::ManageUsers => write!(f, "manage_users"),
        }
    }
}

/// Ресурс, к которому применяется разрешение
#[derive(Debug, Clone, PartialEq, Eq, Hash, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum Resource {
    /// Конкретная таблица по имени
    Table(String),
    /// Все таблицы
    AllTables,
    /// Системные ресурсы (схема, конфиг, деплой)
    System,
}

impl std::fmt::Display for Resource {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        match self {
            Resource::Table(n) => write!(f, "table:{}", n),
            Resource::AllTables => write!(f, "*"),
            Resource::System => write!(f, "system"),
        }
    }
}

/// Одно RBAC-правило: роль → действие → ресурс → разрешено/запрещено
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Permission {
    pub role: Role,
    pub action: Action,
    pub resource: Resource,
    pub allow: bool,
}

impl Permission {
    pub fn allow(role: Role, action: Action, resource: Resource) -> Self {
        Self { role, action, resource, allow: true }
    }

    pub fn deny(role: Role, action: Action, resource: Resource) -> Self {
        Self { role, action, resource, allow: false }
    }
}

/// RBAC-политики проекта.
/// Хранится в `project_state.json` → `permissions`.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct RbacPolicy {
    pub permissions: Vec<Permission>,
}

impl RbacPolicy {
    /// Создать политику с безопасными defaults:
    /// - admin: всё разрешено
    /// - editor: CRUD на все таблицы, запрещены manage_schema/manage_users
    /// - viewer: только read на все таблицы
    pub fn default_policy() -> Self {
        use Action::*;
        use Resource::*;
        use Role::*;
        let all_crud = [Read, Create, Update, Delete];

        let mut perms = Vec::new();

        // Admin — full access
        for action in [Read, Create, Update, Delete, ManageSchema, ManageUsers] {
            perms.push(Permission::allow(Admin, action, AllTables));
        }
        perms.push(Permission::allow(Admin, ManageSchema, System));
        perms.push(Permission::allow(Admin, ManageUsers, System));

        // Editor — CRUD data, no schema/user management
        for action in all_crud {
            perms.push(Permission::allow(Editor, action, AllTables));
        }
        perms.push(Permission::deny(Editor, ManageSchema, System));
        perms.push(Permission::deny(Editor, ManageUsers, System));

        // Viewer — read only
        perms.push(Permission::allow(Viewer, Read, AllTables));
        perms.push(Permission::deny(Viewer, Create, AllTables));
        perms.push(Permission::deny(Viewer, Update, AllTables));
        perms.push(Permission::deny(Viewer, Delete, AllTables));
        perms.push(Permission::deny(Viewer, ManageSchema, System));
        perms.push(Permission::deny(Viewer, ManageUsers, System));

        Self { permissions: perms }
    }

    /// Проверить, разрешено ли действие для роли на ресурс.
    /// Логика: ищем первое явное правило (allow=true → permit, allow=false → deny).
    /// Если правило не найдено — deny по умолчанию (fail-closed).
    pub fn is_allowed(&self, role: &Role, action: &Action, resource: &Resource) -> bool {
        for p in &self.permissions {
            if &p.role != role {
                continue;
            }
            if &p.action != action {
                continue;
            }
            // Ресурс совпадает точно или AllTables покрывает Table(*)
            let resource_match = &p.resource == resource
                || (p.resource == Resource::AllTables
                    && matches!(resource, Resource::Table(_)));
            if resource_match {
                return p.allow;
            }
        }
        false // fail-closed
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_default_policy_admin_full_access() {
        let policy = RbacPolicy::default_policy();
        let table = Resource::Table("users".into());
        for action in [Action::Read, Action::Create, Action::Update, Action::Delete] {
            assert!(
                policy.is_allowed(&Role::Admin, &action, &table),
                "admin should be allowed {:?}", action
            );
        }
        assert!(policy.is_allowed(&Role::Admin, &Action::ManageSchema, &Resource::System));
        assert!(policy.is_allowed(&Role::Admin, &Action::ManageUsers, &Resource::System));
    }

    #[test]
    fn test_default_policy_editor_crud_only() {
        let policy = RbacPolicy::default_policy();
        let table = Resource::Table("posts".into());
        for action in [Action::Read, Action::Create, Action::Update, Action::Delete] {
            assert!(
                policy.is_allowed(&Role::Editor, &action, &table),
                "editor should be allowed {:?}", action
            );
        }
        assert!(!policy.is_allowed(&Role::Editor, &Action::ManageSchema, &Resource::System));
        assert!(!policy.is_allowed(&Role::Editor, &Action::ManageUsers, &Resource::System));
    }

    #[test]
    fn test_default_policy_viewer_read_only() {
        let policy = RbacPolicy::default_policy();
        let table = Resource::Table("items".into());
        assert!(policy.is_allowed(&Role::Viewer, &Action::Read, &table));
        assert!(!policy.is_allowed(&Role::Viewer, &Action::Create, &table));
        assert!(!policy.is_allowed(&Role::Viewer, &Action::Update, &table));
        assert!(!policy.is_allowed(&Role::Viewer, &Action::Delete, &table));
        assert!(!policy.is_allowed(&Role::Viewer, &Action::ManageSchema, &Resource::System));
    }

    #[test]
    fn test_fail_closed_unknown_role() {
        let policy = RbacPolicy::default_policy();
        let custom = Role::Custom("guest".into());
        assert!(!policy.is_allowed(&custom, &Action::Read, &Resource::AllTables));
    }

    #[test]
    fn test_permission_serialization() {
        let policy = RbacPolicy::default_policy();
        let json = serde_json::to_string(&policy).unwrap();
        let restored: RbacPolicy = serde_json::from_str(&json).unwrap();
        assert_eq!(policy.permissions.len(), restored.permissions.len());
    }

    #[test]
    fn test_custom_permission() {
        let mut policy = RbacPolicy { permissions: vec![] };
        policy.permissions.push(Permission::allow(
            Role::Custom("analyst".into()),
            Action::Read,
            Resource::Table("reports".into()),
        ));
        assert!(policy.is_allowed(
            &Role::Custom("analyst".into()),
            &Action::Read,
            &Resource::Table("reports".into())
        ));
        assert!(!policy.is_allowed(
            &Role::Custom("analyst".into()),
            &Action::Delete,
            &Resource::Table("reports".into())
        ));
    }
}
