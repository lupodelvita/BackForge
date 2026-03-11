use thiserror::Error;

#[derive(Debug, Error)]
pub enum MigrationError {
    #[error("Migration failed: {reason}")]
    Failed { reason: String },

    #[error("Cannot apply migration: would cause data loss in '{table}.{column}'")]
    DataLossRisk { table: String, column: String },

    #[error("Database error: {0}")]
    Database(#[from] sqlx::Error),

    #[error("Core error: {0}")]
    Core(#[from] backforge_core::CoreError),
}

pub type MigrationResult<T> = Result<T, MigrationError>;
