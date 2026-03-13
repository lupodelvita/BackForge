use thiserror::Error;

#[derive(Debug, Error)]
pub enum VersionError {
    #[error("version {version} not found for project '{project}'")]
    VersionNotFound { project: String, version: u32 },

    #[error("project '{project}' has no version history")]
    NoHistory { project: String },

    #[error("IO error: {0}")]
    Io(#[from] std::io::Error),

    #[error("serialization error: {0}")]
    Json(#[from] serde_json::Error),

    #[error("invalid version number: {0}")]
    InvalidVersion(String),
}

pub type VersionResult<T> = Result<T, VersionError>;
