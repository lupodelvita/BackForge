use std::path::{Path, PathBuf};
use std::fs;
use serde::{Serialize, Deserialize};
use chrono::Utc;

use crate::clock::VectorClock;
use crate::error::{SyncError, SyncResult};
use crate::log::{SyncEvent, SyncEventKind, SyncLog};
use crate::snapshot::ProjectSnapshot;

/// Persisted per-project sync state (clock at last successful sync).
#[derive(Debug, Clone, Serialize, Deserialize, Default)]
pub struct SyncState {
    pub last_clock: VectorClock,
    pub last_snapshot_id: Option<String>,
    pub last_remote_sha256: Option<String>,
}

/// Orchestrates push/pull/conflict detection for a project.
pub struct SyncEngine {
    /// Root for storing sync state files, e.g. ~/.backforge/sync/
    sync_root: PathBuf,
    /// Root where project dirs live, e.g. ~/.local/share/backforge/projects/
    projects_root: PathBuf,
    /// Node identifier (hostname or UUID)
    node_id: String,
    /// Remote sync server base URL
    remote_url: String,
    log: SyncLog,
}

impl SyncEngine {
    pub fn new(
        sync_root: impl AsRef<Path>,
        projects_root: impl AsRef<Path>,
        node_id: impl Into<String>,
        remote_url: impl Into<String>,
    ) -> SyncResult<Self> {
        let sync_root = sync_root.as_ref().to_path_buf();
        fs::create_dir_all(&sync_root)?;
        let log = SyncLog::new(&sync_root)?;
        Ok(Self {
            sync_root,
            projects_root: projects_root.as_ref().to_path_buf(),
            node_id: node_id.into(),
            remote_url: remote_url.into(),
            log,
        })
    }

    fn state_path(&self, project: &str) -> PathBuf {
        self.sync_root.join(format!("{}.sync.json", project))
    }

    fn project_state_path(&self, project: &str) -> PathBuf {
        self.projects_root.join(project).join("project_state.json")
    }

    pub fn load_sync_state(&self, project: &str) -> SyncResult<SyncState> {
        let path = self.state_path(project);
        if !path.exists() {
            return Ok(SyncState::default());
        }
        let raw = fs::read_to_string(&path)?;
        Ok(serde_json::from_str(&raw)?)
    }

    pub fn save_sync_state(&self, project: &str, state: &SyncState) -> SyncResult<()> {
        let path = self.state_path(project);
        fs::write(path, serde_json::to_string_pretty(state)?)?;
        Ok(())
    }

    /// Build a snapshot from the local project_state.json.
    pub fn build_local_snapshot(&self, project: &str) -> SyncResult<ProjectSnapshot> {
        let ps_path = self.project_state_path(project);
        let content = fs::read(&ps_path).map_err(|_| SyncError::ProjectNotFound {
            name: project.to_string(),
        })?;
        let mut state = self.load_sync_state(project)?;
        state.last_clock.increment(&self.node_id);
        let snap = ProjectSnapshot::new(
            project,
            &self.node_id,
            state.last_clock.clone(),
            content,
        );
        Ok(snap)
    }

    /// Push: send local snapshot to remote.
    /// Returns the snapshot that was pushed.
    /// If local and remote diverge (concurrent clocks) → SyncError::Conflict.
    pub async fn push(&self, project: &str) -> SyncResult<ProjectSnapshot> {
        let snap = self.build_local_snapshot(project)?;
        let state = self.load_sync_state(project)?;

        // Fetch remote state to check for conflicts
        let remote_opt = self.fetch_remote(project).await?;
        if let Some(remote) = &remote_opt {
            if snap.clock.concurrent(&remote.clock) {
                // Don't push — write conflict event and return error
                let _ = self.log.append(&SyncEvent {
                    kind: SyncEventKind::Conflict,
                    project_name: project.to_string(),
                    snapshot_id: snap.id.to_string(),
                    sha256: snap.sha256.clone(),
                    remote_url: self.remote_url.clone(),
                    timestamp: Utc::now(),
                    note: Some("concurrent clocks detected during push".into()),
                });
                return Err(SyncError::Conflict {
                    local: snap.clock.to_sorted_pairs(),
                    remote: remote.clock.to_sorted_pairs(),
                });
            }
            // If remote dominates local — warn but proceed (force push for now)
        }

        self.upload_remote(project, &snap).await?;

        // Save updated sync state
        let mut new_state = state;
        new_state.last_clock = snap.clock.clone();
        new_state.last_snapshot_id = Some(snap.id.to_string());
        new_state.last_remote_sha256 = Some(snap.sha256.clone());
        self.save_sync_state(project, &new_state)?;

        self.log.append(&SyncEvent {
            kind: SyncEventKind::Push,
            project_name: project.to_string(),
            snapshot_id: snap.id.to_string(),
            sha256: snap.sha256.clone(),
            remote_url: self.remote_url.clone(),
            timestamp: Utc::now(),
            note: None,
        })?;

        Ok(snap)
    }

    /// Pull: download remote snapshot and apply it locally.
    /// Returns None if remote has no snapshot yet (first pull on new server).
    pub async fn pull(&self, project: &str) -> SyncResult<Option<ProjectSnapshot>> {
        let remote_opt = self.fetch_remote(project).await?;
        let remote = match remote_opt {
            None => return Ok(None),
            Some(r) => r,
        };

        let state = self.load_sync_state(project)?;

        // Check for conflict: local has changes the remote doesn't know about
        let local_snap_opt = self.build_local_snapshot(project).ok();
        if let Some(ref local_snap) = local_snap_opt {
            if local_snap.clock.concurrent(&remote.clock) {
                let _ = self.log.append(&SyncEvent {
                    kind: SyncEventKind::Conflict,
                    project_name: project.to_string(),
                    snapshot_id: remote.id.to_string(),
                    sha256: remote.sha256.clone(),
                    remote_url: self.remote_url.clone(),
                    timestamp: Utc::now(),
                    note: Some("concurrent clocks detected during pull".into()),
                });
                return Err(SyncError::Conflict {
                    local: local_snap.clock.to_sorted_pairs(),
                    remote: remote.clock.to_sorted_pairs(),
                });
            }
        }

        // Write remote content to project_state.json
        let ps_path = self.project_state_path(project);
        if let Some(parent) = ps_path.parent() {
            fs::create_dir_all(parent)?;
        }
        fs::write(&ps_path, &remote.content)?;

        // Update sync state: merge clocks
        let merged_clock = state.last_clock.merge(&remote.clock);
        let new_state = SyncState {
            last_clock: merged_clock,
            last_snapshot_id: Some(remote.id.to_string()),
            last_remote_sha256: Some(remote.sha256.clone()),
        };
        self.save_sync_state(project, &new_state)?;

        self.log.append(&SyncEvent {
            kind: SyncEventKind::Pull,
            project_name: project.to_string(),
            snapshot_id: remote.id.to_string(),
            sha256: remote.sha256.clone(),
            remote_url: self.remote_url.clone(),
            timestamp: Utc::now(),
            note: None,
        })?;

        Ok(Some(remote))
    }

    async fn fetch_remote(&self, project: &str) -> SyncResult<Option<ProjectSnapshot>> {
        let url = format!("{}/sync/{}", self.remote_url.trim_end_matches('/'), project);
        let resp = reqwest::get(&url).await.map_err(|e| SyncError::ServerUnreachable {
            url: url.clone(),
            reason: e.to_string(),
        })?;

        if resp.status().as_u16() == 404 {
            return Ok(None);
        }
        if !resp.status().is_success() {
            let status = resp.status().as_u16();
            let body = resp.text().await.unwrap_or_default();
            return Err(SyncError::ServerError { status, body });
        }

        let snap: ProjectSnapshot = resp.json().await.map_err(|e| SyncError::Other(e.into()))?;
        Ok(Some(snap))
    }

    async fn upload_remote(&self, project: &str, snap: &ProjectSnapshot) -> SyncResult<()> {
        let url = format!("{}/sync/{}", self.remote_url.trim_end_matches('/'), project);
        let client = reqwest::Client::new();
        let resp = client.put(&url).json(snap).send().await.map_err(|e| {
            SyncError::ServerUnreachable {
                url: url.clone(),
                reason: e.to_string(),
            }
        })?;

        if !resp.status().is_success() {
            let status = resp.status().as_u16();
            let body = resp.text().await.unwrap_or_default();
            return Err(SyncError::ServerError { status, body });
        }
        Ok(())
    }

    /// Return the log events for a project.
    pub fn history(&self, project: &str) -> SyncResult<Vec<SyncEvent>> {
        self.log.for_project(project)
    }

    /// Return the current sync state for a project.
    pub fn status(&self, project: &str) -> SyncResult<SyncState> {
        self.load_sync_state(project)
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use tempfile::tempdir;

    fn make_engine(sync_dir: &Path, projects_dir: &Path) -> SyncEngine {
        SyncEngine::new(sync_dir, projects_dir, "test-node", "http://localhost:9999")
            .unwrap()
    }

    fn write_project(projects_dir: &Path, project: &str, content: &[u8]) {
        let dir = projects_dir.join(project);
        fs::create_dir_all(&dir).unwrap();
        fs::write(dir.join("project_state.json"), content).unwrap();
    }

    #[test]
    fn test_build_local_snapshot() {
        let sync = tempdir().unwrap();
        let projects = tempdir().unwrap();
        write_project(projects.path(), "shop", b"{\"meta\":{\"name\":\"shop\"}}");

        let engine = make_engine(sync.path(), projects.path());
        let snap = engine.build_local_snapshot("shop").unwrap();

        assert_eq!(snap.project_name, "shop");
        assert_eq!(snap.node_id, "test-node");
        assert_eq!(snap.clock.get("test-node"), 1);
    }

    #[test]
    fn test_build_snapshot_missing_project() {
        let sync = tempdir().unwrap();
        let projects = tempdir().unwrap();
        let engine = make_engine(sync.path(), projects.path());
        let err = engine.build_local_snapshot("ghost").unwrap_err();
        assert!(matches!(err, SyncError::ProjectNotFound { .. }));
    }

    #[test]
    fn test_save_and_load_sync_state() {
        let sync = tempdir().unwrap();
        let projects = tempdir().unwrap();
        let engine = make_engine(sync.path(), projects.path());

        let mut state = SyncState::default();
        state.last_clock.increment("test-node");
        state.last_snapshot_id = Some("snap-1".into());
        engine.save_sync_state("my-proj", &state).unwrap();

        let loaded = engine.load_sync_state("my-proj").unwrap();
        assert_eq!(loaded.last_clock.get("test-node"), 1);
        assert_eq!(loaded.last_snapshot_id, Some("snap-1".into()));
    }

    #[test]
    fn test_status_returns_default_for_new_project() {
        let sync = tempdir().unwrap();
        let projects = tempdir().unwrap();
        let engine = make_engine(sync.path(), projects.path());

        let status = engine.status("new-proj").unwrap();
        assert_eq!(status.last_clock.get("any-node"), 0);
        assert!(status.last_snapshot_id.is_none());
    }

    #[test]
    fn test_history_empty_initially() {
        let sync = tempdir().unwrap();
        let projects = tempdir().unwrap();
        let engine = make_engine(sync.path(), projects.path());
        let events = engine.history("proj").unwrap();
        assert!(events.is_empty());
    }
}
