use thiserror::Error;

#[derive(Debug, Error)]
pub enum CoreError {
    #[error("Project not found: {id}")]
    ProjectNotFound { id: String },

    #[error("Project already exists: {name}")]
    ProjectAlreadyExists { name: String },

    #[error("Invalid project state: {reason}")]
    InvalidProjectState { reason: String },

    #[error("IO error: {0}")]
    Io(#[from] std::io::Error),

    #[error("Serialization error: {0}")]
    Serialization(#[from] serde_json::Error),

    #[error("Config error: {reason}")]
    Config { reason: String },
}

pub type CoreResult<T> = Result<T, CoreError>;
