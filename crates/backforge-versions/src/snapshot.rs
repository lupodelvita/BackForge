use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};
use sha2::{Digest, Sha256};
use backforge_core::ProjectState;

/// Метаданные одного снимка (без полного state — для быстрого листинга)
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SnapshotMeta {
    /// Номер версии (1-based, монотонно растёт)
    pub version: u32,
    /// SHA-256 содержимого project_state.json на момент снимка
    pub checksum: String,
    /// Метка времени создания снимка
    pub created_at: DateTime<Utc>,
    /// Необязательное описание (например "before migration")
    pub message: Option<String>,
    /// Количество таблиц в схеме
    pub table_count: usize,
}

/// Полный снимок: метаданные + сериализованный ProjectState
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Snapshot {
    pub meta: SnapshotMeta,
    /// Полный сериализованный ProjectState (как JSON-строка)
    pub state_json: String,
}

impl Snapshot {
    /// Создать снимок из текущего ProjectState и номера версии
    pub fn new(state: &ProjectState, version: u32, message: Option<String>) -> serde_json::Result<Self> {
        let state_json = serde_json::to_string_pretty(state)?;
        let checksum = sha256_hex(&state_json);
        let meta = SnapshotMeta {
            version,
            checksum,
            created_at: Utc::now(),
            message,
            table_count: state.schema.tables.len(),
        };
        Ok(Self { meta, state_json })
    }

    /// Восстановить ProjectState из снимка
    pub fn restore(&self) -> serde_json::Result<ProjectState> {
        serde_json::from_str(&self.state_json)
    }
}

fn sha256_hex(data: &str) -> String {
    let mut hasher = Sha256::new();
    hasher.update(data.as_bytes());
    hex::encode(hasher.finalize())
}

#[cfg(test)]
mod tests {
    use super::*;
    use backforge_core::ProjectState;

    fn make_state() -> ProjectState {
        ProjectState::new("myapp", "test project")
    }

    #[test]
    fn test_snapshot_creation() {
        let state = make_state();
        let snap = Snapshot::new(&state, 1, Some("initial".into())).unwrap();
        assert_eq!(snap.meta.version, 1);
        assert_eq!(snap.meta.message.as_deref(), Some("initial"));
        assert_eq!(snap.meta.table_count, 0);
        assert!(!snap.meta.checksum.is_empty());
        assert_eq!(snap.meta.checksum.len(), 64); // SHA-256 hex
    }

    #[test]
    fn test_snapshot_restore() {
        let state = make_state();
        let snap = Snapshot::new(&state, 1, None).unwrap();
        let restored = snap.restore().unwrap();
        assert_eq!(restored.meta.id, state.meta.id);
        assert_eq!(restored.meta.name, state.meta.name);
    }

    #[test]
    fn test_snapshot_checksum_changes_with_state() {
        let state1 = ProjectState::new("app1", "desc1");
        let state2 = ProjectState::new("app2", "desc2");
        let snap1 = Snapshot::new(&state1, 1, None).unwrap();
        let snap2 = Snapshot::new(&state2, 1, None).unwrap();
        assert_ne!(snap1.meta.checksum, snap2.meta.checksum);
    }

    #[test]
    fn test_snapshot_serialization() {
        let state = make_state();
        let snap = Snapshot::new(&state, 3, Some("v3".into())).unwrap();
        let json = serde_json::to_string(&snap).unwrap();
        let snap2: Snapshot = serde_json::from_str(&json).unwrap();
        assert_eq!(snap2.meta.version, 3);
        assert_eq!(snap2.meta.checksum, snap.meta.checksum);
    }
}
