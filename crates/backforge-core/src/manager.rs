use std::path::{Path, PathBuf};
use crate::{CoreError, CoreResult, ProjectState};

/// Управляет проектами BackForge на диске.
/// Каждый проект — папка с файлом project_state.json внутри.
pub struct ProjectManager {
    /// Корневая директория где хранятся все проекты
    pub projects_dir: PathBuf,
}

impl ProjectManager {
    pub fn new(projects_dir: impl Into<PathBuf>) -> Self {
        Self {
            projects_dir: projects_dir.into(),
        }
    }

    /// Создать новый проект
    pub fn create_project(&self, name: &str, description: &str) -> CoreResult<ProjectState> {
        let project_dir = self.projects_dir.join(name);

        if project_dir.exists() {
            return Err(CoreError::ProjectAlreadyExists {
                name: name.to_string(),
            });
        }

        std::fs::create_dir_all(&project_dir)?;

        let state = ProjectState::new(name, description);
        self.save_state(&project_dir, &state)?;

        tracing::info!("Created project '{}' at {:?}", name, project_dir);
        Ok(state)
    }

    /// Загрузить проект по имени
    pub fn load_project(&self, name: &str) -> CoreResult<ProjectState> {
        let project_dir = self.projects_dir.join(name);

        if !project_dir.exists() {
            return Err(CoreError::ProjectNotFound {
                id: name.to_string(),
            });
        }

        self.load_state(&project_dir)
    }

    /// Сохранить состояние проекта
    pub fn save_project(&self, state: &ProjectState) -> CoreResult<()> {
        let project_dir = self.projects_dir.join(&state.meta.name);
        self.save_state(&project_dir, state)
    }

    /// Список всех проектов
    pub fn list_projects(&self) -> CoreResult<Vec<String>> {
        if !self.projects_dir.exists() {
            return Ok(Vec::new());
        }

        let mut names = Vec::new();
        for entry in std::fs::read_dir(&self.projects_dir)? {
            let entry = entry?;
            let path = entry.path();
            if path.is_dir() {
                let state_file = path.join("project_state.json");
                if state_file.exists() {
                    if let Some(name) = path.file_name() {
                        names.push(name.to_string_lossy().into_owned());
                    }
                }
            }
        }
        names.sort();
        Ok(names)
    }

    fn save_state(&self, dir: &Path, state: &ProjectState) -> CoreResult<()> {
        let state_file = dir.join("project_state.json");
        let json = serde_json::to_string_pretty(state)?;
        std::fs::write(state_file, json)?;
        Ok(())
    }

    fn load_state(&self, dir: &Path) -> CoreResult<ProjectState> {
        let state_file = dir.join("project_state.json");
        let json = std::fs::read_to_string(state_file)?;
        let state = serde_json::from_str(&json)?;
        Ok(state)
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::fs;

    fn temp_dir() -> PathBuf {
        let dir = std::env::temp_dir()
            .join(format!("backforge-test-{}", uuid::Uuid::new_v4()));
        fs::create_dir_all(&dir).unwrap();
        dir
    }

    #[test]
    fn test_create_and_load_project() {
        let dir = temp_dir();
        let manager = ProjectManager::new(&dir);

        let state = manager.create_project("my-app", "Test app").unwrap();
        assert_eq!(state.meta.name, "my-app");

        let loaded = manager.load_project("my-app").unwrap();
        assert_eq!(loaded.meta.id, state.meta.id);
        assert_eq!(loaded.meta.name, "my-app");

        fs::remove_dir_all(dir).ok();
    }

    #[test]
    fn test_create_duplicate_project_fails() {
        let dir = temp_dir();
        let manager = ProjectManager::new(&dir);

        manager.create_project("app", "First").unwrap();
        let result = manager.create_project("app", "Duplicate");

        assert!(matches!(result, Err(CoreError::ProjectAlreadyExists { .. })));
        fs::remove_dir_all(dir).ok();
    }

    #[test]
    fn test_load_nonexistent_project_fails() {
        let dir = temp_dir();
        let manager = ProjectManager::new(&dir);

        let result = manager.load_project("ghost");
        assert!(matches!(result, Err(CoreError::ProjectNotFound { .. })));
        fs::remove_dir_all(dir).ok();
    }

    #[test]
    fn test_list_projects() {
        let dir = temp_dir();
        let manager = ProjectManager::new(&dir);

        manager.create_project("alpha", "").unwrap();
        manager.create_project("beta", "").unwrap();
        manager.create_project("gamma", "").unwrap();

        let list = manager.list_projects().unwrap();
        assert_eq!(list, vec!["alpha", "beta", "gamma"]);

        fs::remove_dir_all(dir).ok();
    }
}
