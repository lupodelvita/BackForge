use thiserror::Error;

#[derive(Debug, Error)]
pub enum DbError {
    #[error("Database connection error: {0}")]
    Connection(#[from] sqlx::Error),

    #[error("Redis error: {0}")]
    Redis(#[from] redis::RedisError),

    #[error("Migration error: {reason}")]
    Migration { reason: String },

    #[error("Schema error: {reason}")]
    Schema { reason: String },

    #[error("Core error: {0}")]
    Core(#[from] backforge_core::CoreError),
}

pub type DbResult<T> = Result<T, DbError>;
