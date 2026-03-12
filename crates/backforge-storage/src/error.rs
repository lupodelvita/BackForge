use thiserror::Error;

#[derive(Debug, Error)]
pub enum StorageError {
    #[error("Bucket not found: {name}")]
    BucketNotFound { name: String },

    #[error("Object not found: {bucket}/{key}")]
    ObjectNotFound { bucket: String, key: String },

    #[error("Bucket already exists: {name}")]
    BucketAlreadyExists { name: String },

    #[error("Object key is invalid: {key}")]
    InvalidKey { key: String },

    #[error("I/O error: {0}")]
    Io(#[from] std::io::Error),

    #[error("Database error: {0}")]
    Database(#[from] sqlx::Error),

    #[error("Serialization error: {0}")]
    Serialization(#[from] serde_json::Error),

    #[error("Core error: {0}")]
    Core(#[from] backforge_core::CoreError),
}

pub type StorageResult<T> = Result<T, StorageError>;
