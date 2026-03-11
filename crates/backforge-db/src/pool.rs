use sqlx::{postgres::PgPoolOptions, PgPool};
use crate::DbResult;

/// Конфигурация подключения к PostgreSQL
#[derive(Debug, Clone)]
pub struct DbConfig {
    pub url: String,
    pub max_connections: u32,
    pub min_connections: u32,
    pub connect_timeout_secs: u64,
}

impl DbConfig {
    pub fn new(url: impl Into<String>) -> Self {
        Self {
            url: url.into(),
            max_connections: 10,
            min_connections: 2,
            connect_timeout_secs: 30,
        }
    }

    /// Создать из переменных окружения
    pub fn from_env() -> Self {
        let url = std::env::var("DATABASE_URL")
            .unwrap_or_else(|_| "postgresql://postgres:postgres@localhost:5432/backforge".to_string());
        Self::new(url)
    }
}

/// Connection pool для PostgreSQL
pub struct DbPool {
    pub pool: PgPool,
    pub config: DbConfig,
}

impl DbPool {
    /// Создать новый pool и подключиться
    pub async fn connect(config: DbConfig) -> DbResult<Self> {
        let pool = PgPoolOptions::new()
            .max_connections(config.max_connections)
            .min_connections(config.min_connections)
            .acquire_timeout(std::time::Duration::from_secs(config.connect_timeout_secs))
            .connect(&config.url)
            .await?;

        tracing::info!(
            "Connected to PostgreSQL (max_conn={})",
            config.max_connections
        );

        Ok(Self { pool, config })
    }

    /// Проверить соединение
    pub async fn health_check(&self) -> DbResult<()> {
        sqlx::query("SELECT 1").execute(&self.pool).await?;
        Ok(())
    }

    /// Получить количество активных соединений
    pub fn active_connections(&self) -> u32 {
        self.pool.size()
    }
}
