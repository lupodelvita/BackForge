use redis::{aio::ConnectionManager, AsyncCommands, Client};
use serde::{de::DeserializeOwned, Serialize};
use crate::DbResult;

pub struct CacheConfig {
    pub url: String,
    pub default_ttl_secs: u64,
}

impl CacheConfig {
    pub fn new(url: impl Into<String>) -> Self {
        Self {
            url: url.into(),
            default_ttl_secs: 3600, // 1 час
        }
    }

    pub fn from_env() -> Self {
        let url = std::env::var("REDIS_URL")
            .unwrap_or_else(|_| "redis://127.0.0.1:6379".to_string());
        Self::new(url)
    }
}

/// Redis cache layer для hot data
pub struct CachePool {
    manager: ConnectionManager,
    pub config: CacheConfig,
}

impl CachePool {
    pub async fn connect(config: CacheConfig) -> DbResult<Self> {
        let client = Client::open(config.url.as_str())?;
        let manager = ConnectionManager::new(client).await?;
        tracing::info!("Connected to Redis at {}", config.url);
        Ok(Self { manager, config })
    }

    /// Записать значение в кеш с TTL
    pub async fn set<T: Serialize>(
        &mut self,
        key: &str,
        value: &T,
        ttl_secs: Option<u64>,
    ) -> DbResult<()> {
        let json = serde_json::to_string(value)
            .map_err(backforge_core::CoreError::Serialization)?;
        let ttl = ttl_secs.unwrap_or(self.config.default_ttl_secs);
        self.manager.set_ex::<_, _, ()>(key, json, ttl).await?;
        Ok(())
    }

    /// Получить значение из кеша
    pub async fn get<T: DeserializeOwned>(&mut self, key: &str) -> DbResult<Option<T>> {
        let result: Option<String> = self.manager.get(key).await?;
        match result {
            Some(json) => {
                let value = serde_json::from_str(&json)
                    .map_err(backforge_core::CoreError::Serialization)?;
                Ok(Some(value))
            }
            None => Ok(None),
        }
    }

    /// Удалить ключ из кеша
    pub async fn del(&mut self, key: &str) -> DbResult<()> {
        self.manager.del::<_, ()>(key).await?;
        Ok(())
    }

    /// Проверить соединение
    pub async fn health_check(&mut self) -> DbResult<()> {
        redis::cmd("PING")
            .query_async::<_, String>(&mut self.manager)
            .await?;
        Ok(())
    }
}
