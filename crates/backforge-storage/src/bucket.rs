use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};
use uuid::Uuid;
use std::path::PathBuf;
use crate::{StorageError, StorageResult};

/// Метаданные bucket'а (хранятся на диске как bucket.json)
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Bucket {
    pub id: Uuid,
    pub project_name: String,
    pub name: String,
    pub created_at: DateTime<Utc>,
    pub description: Option<String>,
}

impl Bucket {
    pub fn new(project_name: impl Into<String>, name: impl Into<String>) -> Self {
        Self {
            id: Uuid::new_v4(),
            project_name: project_name.into(),
            name: name.into(),
            created_at: Utc::now(),
            description: None,
        }
    }
}

/// Менеджер bucket'ов (работает с файловой системой)
pub struct BucketManager {
    /// Корневая папка хранилища: <storage_root>/<project>/<bucket>/
    pub storage_root: PathBuf,
}

impl BucketManager {
    pub fn new(storage_root: impl Into<PathBuf>) -> Self {
        Self { storage_root: storage_root.into() }
    }

    fn bucket_dir(&self, project_name: &str, bucket_name: &str) -> PathBuf {
        self.storage_root.join(project_name).join(bucket_name)
    }

    fn meta_path(&self, project_name: &str, bucket_name: &str) -> PathBuf {
        self.bucket_dir(project_name, bucket_name).join("bucket.json")
    }

    pub async fn create(&self, project_name: &str, bucket_name: &str) -> StorageResult<Bucket> {
        let dir = self.bucket_dir(project_name, bucket_name);
        if dir.exists() {
            return Err(StorageError::BucketAlreadyExists { name: bucket_name.to_string() });
        }

        tokio::fs::create_dir_all(&dir).await?;

        let bucket = Bucket::new(project_name, bucket_name);
        let json = serde_json::to_string_pretty(&bucket)?;
        tokio::fs::write(self.meta_path(project_name, bucket_name), json).await?;
        tracing::info!("Created bucket {}/{}", project_name, bucket_name);
        Ok(bucket)
    }

    pub async fn get(&self, project_name: &str, bucket_name: &str) -> StorageResult<Bucket> {
        let meta_path = self.meta_path(project_name, bucket_name);
        if !meta_path.exists() {
            return Err(StorageError::BucketNotFound { name: bucket_name.to_string() });
        }
        let raw = tokio::fs::read_to_string(meta_path).await?;
        Ok(serde_json::from_str(&raw)?)
    }

    pub async fn list(&self, project_name: &str) -> StorageResult<Vec<Bucket>> {
        let project_dir = self.storage_root.join(project_name);
        if !project_dir.exists() {
            return Ok(vec![]);
        }

        let mut buckets = vec![];
        let mut entries = tokio::fs::read_dir(&project_dir).await?;
        while let Some(entry) = entries.next_entry().await? {
            let meta_path = entry.path().join("bucket.json");
            if meta_path.exists() {
                let raw = tokio::fs::read_to_string(meta_path).await?;
                if let Ok(b) = serde_json::from_str::<Bucket>(&raw) {
                    buckets.push(b);
                }
            }
        }
        Ok(buckets)
    }

    pub async fn delete(&self, project_name: &str, bucket_name: &str) -> StorageResult<()> {
        let dir = self.bucket_dir(project_name, bucket_name);
        if !dir.exists() {
            return Err(StorageError::BucketNotFound { name: bucket_name.to_string() });
        }
        tokio::fs::remove_dir_all(dir).await?;
        tracing::info!("Deleted bucket {}/{}", project_name, bucket_name);
        Ok(())
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use tempfile::tempdir;

    #[tokio::test]
    async fn test_create_and_get_bucket() {
        let dir = tempdir().unwrap();
        let mgr = BucketManager::new(dir.path());

        let bucket = mgr.create("my-app", "avatars").await.unwrap();
        assert_eq!(bucket.name, "avatars");
        assert_eq!(bucket.project_name, "my-app");

        let loaded = mgr.get("my-app", "avatars").await.unwrap();
        assert_eq!(loaded.id, bucket.id);
    }

    #[tokio::test]
    async fn test_duplicate_bucket_fails() {
        let dir = tempdir().unwrap();
        let mgr = BucketManager::new(dir.path());
        mgr.create("my-app", "photos").await.unwrap();
        let err = mgr.create("my-app", "photos").await.unwrap_err();
        assert!(matches!(err, StorageError::BucketAlreadyExists { .. }));
    }

    #[tokio::test]
    async fn test_list_buckets() {
        let dir = tempdir().unwrap();
        let mgr = BucketManager::new(dir.path());
        mgr.create("proj", "b1").await.unwrap();
        mgr.create("proj", "b2").await.unwrap();
        mgr.create("other", "b3").await.unwrap();

        let list = mgr.list("proj").await.unwrap();
        assert_eq!(list.len(), 2);
    }

    #[tokio::test]
    async fn test_delete_bucket() {
        let dir = tempdir().unwrap();
        let mgr = BucketManager::new(dir.path());
        mgr.create("proj", "to-delete").await.unwrap();
        mgr.delete("proj", "to-delete").await.unwrap();
        let err = mgr.get("proj", "to-delete").await.unwrap_err();
        assert!(matches!(err, StorageError::BucketNotFound { .. }));
    }
}
