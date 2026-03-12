use thiserror::Error;

#[derive(Debug, Error)]
pub enum SyncError {
    #[error("project '{name}' not found locally")]
    ProjectNotFound { name: String },

    #[error("sync conflict: local clock {local:?} and remote clock {remote:?} are concurrent")]
    Conflict {
        local: Vec<(String, u64)>,
        remote: Vec<(String, u64)>,
    },

    #[error("sync server unreachable at {url}: {reason}")]
    ServerUnreachable { url: String, reason: String },

    #[error("server returned error {status}: {body}")]
    ServerError { status: u16, body: String },

    #[error("serialization error: {0}")]
    Serialization(#[from] serde_json::Error),

    #[error("io error: {0}")]
    Io(#[from] std::io::Error),

    #[error(transparent)]
    Other(#[from] anyhow::Error),
}

pub type SyncResult<T> = Result<T, SyncError>;
