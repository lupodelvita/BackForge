use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};
use uuid::Uuid;

/// Тип действия, которое записывается в audit log
#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum AuditAction {
    /// Проект создан
    ProjectCreated,
    /// Схема изменена (таблица добавлена/удалена/изменена)
    SchemaChanged,
    /// Разрешения изменены
    PermissionsChanged,
    /// Версия схемы зафиксирована (snapshot)
    VersionCommitted { version: u32 },
    /// Откат к предыдущей версии
    RolledBack { to_version: u32 },
    /// Деплой запущен
    DeployStarted { target: String },
    /// Деплой завершён
    DeployCompleted { target: String },
    /// Кодогенерация запущена
    CodeGenerated { artifact: String },
    /// Файл загружен в хранилище
    FileUploaded { bucket: String, key: String },
    /// Файл удалён из хранилища
    FileDeleted { bucket: String, key: String },
    /// Кастомное событие
    Custom { event: String, details: Option<String> },
}

impl std::fmt::Display for AuditAction {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        match self {
            AuditAction::ProjectCreated => write!(f, "project_created"),
            AuditAction::SchemaChanged => write!(f, "schema_changed"),
            AuditAction::PermissionsChanged => write!(f, "permissions_changed"),
            AuditAction::VersionCommitted { version } => write!(f, "version_committed(v{})", version),
            AuditAction::RolledBack { to_version } => write!(f, "rolled_back(v{})", to_version),
            AuditAction::DeployStarted { target } => write!(f, "deploy_started({})", target),
            AuditAction::DeployCompleted { target } => write!(f, "deploy_completed({})", target),
            AuditAction::CodeGenerated { artifact } => write!(f, "code_generated({})", artifact),
            AuditAction::FileUploaded { bucket, key } => write!(f, "file_uploaded({}/{})", bucket, key),
            AuditAction::FileDeleted { bucket, key } => write!(f, "file_deleted({}/{})", bucket, key),
            AuditAction::Custom { event, .. } => write!(f, "custom({})", event),
        }
    }
}

/// Одна запись в audit log
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AuditEntry {
    /// Уникальный ID записи
    pub id: Uuid,
    /// Имя проекта
    pub project: String,
    /// Кто совершил действие (пользователь, сервис, "cli")
    pub actor: String,
    /// Что произошло
    pub action: AuditAction,
    /// Когда
    pub timestamp: DateTime<Utc>,
}

impl AuditEntry {
    pub fn new(project: impl Into<String>, actor: impl Into<String>, action: AuditAction) -> Self {
        Self {
            id: Uuid::new_v4(),
            project: project.into(),
            actor: actor.into(),
            action,
            timestamp: Utc::now(),
        }
    }
}
