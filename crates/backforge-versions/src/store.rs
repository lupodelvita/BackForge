use std::fs;
use std::path::PathBuf;
use backforge_core::ProjectState;
use crate::{Snapshot, SnapshotMeta, VersionError, VersionResult};

/// Управляет историей версий для одного проекта.
///
/// Структура на диске:
/// ```text
/// <projects_root>/<project>/.versions/
///   index.json          ← список всех SnapshotMeta (быстрый листинг)
///   v0001.json          ← полный Snapshot для версии 1
///   v0002.json
///   ...
/// ```
pub struct VersionStore {
    versions_dir: PathBuf,
}

impl VersionStore {
    /// Создать хранилище для проекта (путь до директории проекта, не версий)
    pub fn new(project_dir: impl Into<PathBuf>) -> Self {
        Self {
            versions_dir: project_dir.into().join(".versions"),
        }
    }

    /// Создать снимок текущего состояния проекта
    /// Возвращает номер созданной версии
    pub fn commit(&self, state: &ProjectState, message: Option<String>) -> VersionResult<u32> {
        fs::create_dir_all(&self.versions_dir)?;

        let next_version = self.next_version()?;
        let snapshot = Snapshot::new(state, next_version, message)?;

        // Записать полный снимок
        let snap_path = self.snapshot_path(next_version);
        fs::write(&snap_path, serde_json::to_string_pretty(&snapshot)?)?;

        // Обновить индекс
        let mut index = self.load_index()?;
        index.push(snapshot.meta.clone());
        self.save_index(&index)?;

        Ok(next_version)
    }

    /// Загрузить список всех снимков (только метаданные, без state_json)
    pub fn history(&self) -> VersionResult<Vec<SnapshotMeta>> {
        if !self.versions_dir.exists() {
            return Ok(Vec::new());
        }
        self.load_index()
    }

    /// Восстановить ProjectState из указанной версии
    pub fn restore(&self, version: u32, project: &str) -> VersionResult<ProjectState> {
        let path = self.snapshot_path(version);
        if !path.exists() {
            return Err(VersionError::VersionNotFound {
                project: project.to_string(),
                version,
            });
        }
        let raw = fs::read_to_string(&path)?;
        let snap: Snapshot = serde_json::from_str(&raw)?;
        Ok(snap.restore()?)
    }

    /// Загрузить конкретный снимок полностью
    pub fn load_snapshot(&self, version: u32, project: &str) -> VersionResult<Snapshot> {
        let path = self.snapshot_path(version);
        if !path.exists() {
            return Err(VersionError::VersionNotFound {
                project: project.to_string(),
                version,
            });
        }
        let raw = fs::read_to_string(&path)?;
        Ok(serde_json::from_str(&raw)?)
    }

    /// Получить последнюю версию (номер)
    pub fn latest_version(&self) -> VersionResult<Option<u32>> {
        let index = self.history()?;
        Ok(index.last().map(|m| m.version))
    }

    fn next_version(&self) -> VersionResult<u32> {
        Ok(self.latest_version()?.unwrap_or(0) + 1)
    }

    fn snapshot_path(&self, version: u32) -> PathBuf {
        self.versions_dir.join(format!("v{:04}.json", version))
    }

    fn index_path(&self) -> PathBuf {
        self.versions_dir.join("index.json")
    }

    fn load_index(&self) -> VersionResult<Vec<SnapshotMeta>> {
        let path = self.index_path();
        if !path.exists() {
            return Ok(Vec::new());
        }
        let raw = fs::read_to_string(&path)?;
        Ok(serde_json::from_str(&raw)?)
    }

    fn save_index(&self, index: &[SnapshotMeta]) -> VersionResult<()> {
        fs::write(self.index_path(), serde_json::to_string_pretty(index)?)?;
        Ok(())
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use backforge_core::{ProjectState, project::schema::{Table, Field, FieldType}};
    use tempfile::TempDir;

    fn store_in_tmpdir(tmp: &TempDir) -> VersionStore {
        VersionStore::new(tmp.path())
    }

    fn make_state(name: &str) -> ProjectState {
        ProjectState::new(name, "test")
    }

    #[test]
    fn test_commit_creates_version() {
        let tmp = TempDir::new().unwrap();
        let store = store_in_tmpdir(&tmp);
        let state = make_state("myapp");
        let v = store.commit(&state, Some("initial".into())).unwrap();
        assert_eq!(v, 1);
        assert!(tmp.path().join(".versions/v0001.json").exists());
        assert!(tmp.path().join(".versions/index.json").exists());
    }

    #[test]
    fn test_commit_increments_version() {
        let tmp = TempDir::new().unwrap();
        let store = store_in_tmpdir(&tmp);
        let state = make_state("myapp");
        let v1 = store.commit(&state, None).unwrap();
        let v2 = store.commit(&state, None).unwrap();
        let v3 = store.commit(&state, None).unwrap();
        assert_eq!(v1, 1);
        assert_eq!(v2, 2);
        assert_eq!(v3, 3);
    }

    #[test]
    fn test_history_returns_all_versions() {
        let tmp = TempDir::new().unwrap();
        let store = store_in_tmpdir(&tmp);
        let state = make_state("myapp");
        store.commit(&state, Some("v1".into())).unwrap();
        store.commit(&state, Some("v2".into())).unwrap();
        let hist = store.history().unwrap();
        assert_eq!(hist.len(), 2);
        assert_eq!(hist[0].message.as_deref(), Some("v1"));
        assert_eq!(hist[1].message.as_deref(), Some("v2"));
    }

    #[test]
    fn test_history_empty_when_no_versions() {
        let tmp = TempDir::new().unwrap();
        let store = store_in_tmpdir(&tmp);
        let hist = store.history().unwrap();
        assert!(hist.is_empty());
    }

    #[test]
    fn test_restore_returns_correct_state() {
        let tmp = TempDir::new().unwrap();
        let store = store_in_tmpdir(&tmp);

        let mut state_v1 = make_state("myapp");
        state_v1.schema.tables.push({
            let mut t = Table::new("users");
            t.add_field(Field::new("id", FieldType::Uuid).primary_key());
            t
        });
        store.commit(&state_v1, Some("add users".into())).unwrap();

        let state_v2 = make_state("myapp");
        store.commit(&state_v2, Some("remove users".into())).unwrap();

        let restored_v1 = store.restore(1, "myapp").unwrap();
        assert_eq!(restored_v1.schema.tables.len(), 1);
        assert_eq!(restored_v1.schema.tables[0].name, "users");

        let restored_v2 = store.restore(2, "myapp").unwrap();
        assert_eq!(restored_v2.schema.tables.len(), 0);
    }

    #[test]
    fn test_restore_missing_version_errors() {
        let tmp = TempDir::new().unwrap();
        let store = store_in_tmpdir(&tmp);
        let err = store.restore(99, "myapp").unwrap_err();
        assert!(matches!(err, VersionError::VersionNotFound { .. }));
    }

    #[test]
    fn test_latest_version() {
        let tmp = TempDir::new().unwrap();
        let store = store_in_tmpdir(&tmp);
        assert_eq!(store.latest_version().unwrap(), None);
        let state = make_state("app");
        store.commit(&state, None).unwrap();
        store.commit(&state, None).unwrap();
        assert_eq!(store.latest_version().unwrap(), Some(2));
    }
}
