use serde::{Deserialize, Serialize};
use uuid::Uuid;
use chrono::{DateTime, Utc};
use crate::clock::VectorClock;
use sha2::{Sha256, Digest};

/// A versioned snapshot of project_state.json with attached vector clock.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ProjectSnapshot {
    /// Unique snapshot ID
    pub id: Uuid,
    /// Project name (directory name under projects root)
    pub project_name: String,
    /// Node ID that created this snapshot (e.g. machine hostname)
    pub node_id: String,
    /// Logical clock at time of snapshot
    pub clock: VectorClock,
    /// SHA-256 of `content` for fast equality / integrity checks
    pub sha256: String,
    /// Raw content of project_state.json
    pub content: Vec<u8>,
    pub created_at: DateTime<Utc>,
}

impl ProjectSnapshot {
    pub fn new(
        project_name: impl Into<String>,
        node_id: impl Into<String>,
        clock: VectorClock,
        content: Vec<u8>,
    ) -> Self {
        let sha256 = hex::encode(Sha256::digest(&content));
        Self {
            id: Uuid::new_v4(),
            project_name: project_name.into(),
            node_id: node_id.into(),
            clock,
            sha256,
            content,
            created_at: Utc::now(),
        }
    }

    /// Returns true if this snapshot's content is identical to another's.
    pub fn same_content(&self, other: &ProjectSnapshot) -> bool {
        self.sha256 == other.sha256
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    fn make_snap(project: &str, node: &str, data: &[u8]) -> ProjectSnapshot {
        let mut clock = VectorClock::new();
        clock.increment(node);
        ProjectSnapshot::new(project, node, clock, data.to_vec())
    }

    #[test]
    fn test_snapshot_sha256_is_deterministic() {
        let s1 = make_snap("proj", "n1", b"hello");
        let s2 = make_snap("proj", "n1", b"hello");
        assert_eq!(s1.sha256, s2.sha256);
    }

    #[test]
    fn test_snapshot_different_content_different_hash() {
        let s1 = make_snap("proj", "n1", b"hello");
        let s2 = make_snap("proj", "n1", b"world");
        assert_ne!(s1.sha256, s2.sha256);
    }

    #[test]
    fn test_same_content() {
        let s1 = make_snap("p", "n", b"data");
        let s2 = make_snap("p", "n", b"data");
        assert!(s1.same_content(&s2));
    }

    #[test]
    fn test_snapshot_serialization() {
        let s = make_snap("myproject", "laptop", b"{\"meta\":{}}");
        let json = serde_json::to_string(&s).unwrap();
        let restored: ProjectSnapshot = serde_json::from_str(&json).unwrap();
        assert_eq!(s.id, restored.id);
        assert_eq!(s.sha256, restored.sha256);
        assert_eq!(s.content, restored.content);
    }
}
