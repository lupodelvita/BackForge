use serde::{Deserialize, Serialize};
use chrono::{DateTime, Utc};
use std::fs::{self, OpenOptions};
use std::io::{BufRead, BufReader, Write};
use std::path::{Path, PathBuf};
use crate::error::SyncResult;

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum SyncEventKind {
    Push,
    Pull,
    Conflict,
    Resolved,
}

/// One sync event appended to the log.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SyncEvent {
    pub kind: SyncEventKind,
    pub project_name: String,
    pub snapshot_id: String,
    pub sha256: String,
    pub remote_url: String,
    pub timestamp: DateTime<Utc>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub note: Option<String>,
}

/// Append-only NDJSON log of sync events, stored at `<sync_root>/sync.log`.
pub struct SyncLog {
    path: PathBuf,
}

impl SyncLog {
    pub fn new(sync_root: impl AsRef<Path>) -> SyncResult<Self> {
        let root = sync_root.as_ref();
        fs::create_dir_all(root)?;
        Ok(Self {
            path: root.join("sync.log"),
        })
    }

    /// Append one event to the log.
    pub fn append(&self, event: &SyncEvent) -> SyncResult<()> {
        let mut f = OpenOptions::new()
            .create(true)
            .append(true)
            .open(&self.path)?;
        let line = serde_json::to_string(event)?;
        writeln!(f, "{}", line)?;
        Ok(())
    }

    /// Read all events from the log.
    pub fn read_all(&self) -> SyncResult<Vec<SyncEvent>> {
        if !self.path.exists() {
            return Ok(vec![]);
        }
        let f = fs::File::open(&self.path)?;
        let reader = BufReader::new(f);
        let mut events = Vec::new();
        for line in reader.lines() {
            let line = line?;
            if line.trim().is_empty() {
                continue;
            }
            let event: SyncEvent = serde_json::from_str(&line)?;
            events.push(event);
        }
        Ok(events)
    }

    /// Return only events for a specific project.
    pub fn for_project(&self, project: &str) -> SyncResult<Vec<SyncEvent>> {
        Ok(self
            .read_all()?
            .into_iter()
            .filter(|e| e.project_name == project)
            .collect())
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use tempfile::tempdir;

    fn make_event(kind: SyncEventKind, project: &str) -> SyncEvent {
        SyncEvent {
            kind,
            project_name: project.to_string(),
            snapshot_id: "snap-1".to_string(),
            sha256: "abc".to_string(),
            remote_url: "http://localhost:8083".to_string(),
            timestamp: Utc::now(),
            note: None,
        }
    }

    #[test]
    fn test_append_and_read_all() {
        let dir = tempdir().unwrap();
        let log = SyncLog::new(dir.path()).unwrap();

        log.append(&make_event(SyncEventKind::Push, "my-project")).unwrap();
        log.append(&make_event(SyncEventKind::Pull, "my-project")).unwrap();

        let events = log.read_all().unwrap();
        assert_eq!(events.len(), 2);
        assert_eq!(events[0].kind, SyncEventKind::Push);
        assert_eq!(events[1].kind, SyncEventKind::Pull);
    }

    #[test]
    fn test_read_all_empty_log() {
        let dir = tempdir().unwrap();
        let log = SyncLog::new(dir.path()).unwrap();
        let events = log.read_all().unwrap();
        assert!(events.is_empty());
    }

    #[test]
    fn test_for_project_filters_correctly() {
        let dir = tempdir().unwrap();
        let log = SyncLog::new(dir.path()).unwrap();

        log.append(&make_event(SyncEventKind::Push, "project-a")).unwrap();
        log.append(&make_event(SyncEventKind::Push, "project-b")).unwrap();
        log.append(&make_event(SyncEventKind::Pull, "project-a")).unwrap();

        let for_a = log.for_project("project-a").unwrap();
        assert_eq!(for_a.len(), 2);
        let for_b = log.for_project("project-b").unwrap();
        assert_eq!(for_b.len(), 1);
    }

    #[test]
    fn test_append_persists_across_instances() {
        let dir = tempdir().unwrap();
        {
            let log = SyncLog::new(dir.path()).unwrap();
            log.append(&make_event(SyncEventKind::Push, "proj")).unwrap();
        }
        // Re-open
        let log2 = SyncLog::new(dir.path()).unwrap();
        let events = log2.read_all().unwrap();
        assert_eq!(events.len(), 1);
        assert_eq!(events[0].kind, SyncEventKind::Push);
    }
}
