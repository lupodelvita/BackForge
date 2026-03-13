use serde::{Deserialize, Serialize};
use uuid::Uuid;
use chrono::{DateTime, Utc};
use super::schema::ProjectSchema;
use super::permissions::RbacPolicy;

/// Метаданные проекта
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ProjectMeta {
    pub id: Uuid,
    pub name: String,
    pub description: String,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
    pub version: u32,
}

impl ProjectMeta {
    pub fn new(name: impl Into<String>, description: impl Into<String>) -> Self {
        let now = Utc::now();
        Self {
            id: Uuid::new_v4(),
            name: name.into(),
            description: description.into(),
            created_at: now,
            updated_at: now,
            version: 1,
        }
    }
}

/// Корневая структура — единый source of truth всего BackForge проекта.
/// Сериализуется в project_state.json
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ProjectState {
    pub meta: ProjectMeta,
    pub schema: ProjectSchema,
    #[serde(default = "RbacPolicy::default_policy")]
    pub permissions: RbacPolicy,
}

impl ProjectState {
    pub fn new(name: impl Into<String>, description: impl Into<String>) -> Self {
        Self {
            meta: ProjectMeta::new(name, description),
            schema: ProjectSchema::default(),
            permissions: RbacPolicy::default_policy(),
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::project::schema::{Field, FieldType};

    #[test]
    fn test_create_project_state() {
        let state = ProjectState::new("my-app", "Test project");
        assert_eq!(state.meta.name, "my-app");
        assert_eq!(state.meta.version, 1);
        assert!(state.schema.tables.is_empty());
    }

    #[test]
    fn test_add_table_to_schema() {
        let mut state = ProjectState::new("my-app", "");
        let mut table = crate::project::schema::Table::new("users");
        table.add_field(Field::new("id", FieldType::Uuid).primary_key());
        table.add_field(Field::new("email", FieldType::Text).not_null());
        state.schema.tables.push(table);
        assert_eq!(state.schema.tables.len(), 1);
        assert_eq!(state.schema.tables[0].fields.len(), 2);
    }

    #[test]
    fn test_project_state_serialization() {
        let state = ProjectState::new("my-app", "Test");
        let json = serde_json::to_string_pretty(&state).unwrap();
        let restored: ProjectState = serde_json::from_str(&json).unwrap();
        assert_eq!(state.meta.id, restored.meta.id);
        assert_eq!(state.meta.name, restored.meta.name);
    }
}
