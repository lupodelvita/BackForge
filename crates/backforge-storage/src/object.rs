use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};
use uuid::Uuid;
use std::path::PathBuf;
use crate::{StorageError, StorageResult};
use crate::hash::hash_bytes;

/// Метаданные объекта (хранятся рядом с файлом)
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ObjectMeta {
    pub id: Uuid,
    pub bucket_id: Uuid,
    pub key: String,
    /// SHA-256 содержимого — для дедупликации
    pub sha256: String,
    pub size_bytes: u64,
    pub content_type: Option<String>,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
}

/// Возвращается при загрузке объекта
#[derive(Debug)]
pub struct ObjectData {
    pub meta: ObjectMeta,
    pub bytes: Vec<u8>,
}

/// Управляет объектами внутри одного bucket'а
pub struct ObjectStore {
    /// <storage_root>/<project>/<bucket>/
    pub bucket_dir: PathBuf,
    pub bucket_id: Uuid,
}

impl ObjectStore {
    pub fn new(bucket_dir: impl Into<PathBuf>, bucket_id: Uuid) -> Self {
        Self { bucket_dir: bucket_dir.into(), bucket_id }
    }

    fn validate_key(key: &str) -> StorageResult<()> {
        if key.is_empty() || key.contains("..") || key.starts_with('/') {
            return Err(StorageError::InvalidKey { key: key.to_string() });
        }
        Ok(())
    }

    fn object_path(&self, key: &str) -> PathBuf {
        // Используем хеш ключа как имя файла чтобы избежать конфликтов с /
        let hashed = format!("{:x}", md5_simple(key));
        self.bucket_dir.join("objects").join(&hashed)
    }

    fn meta_path(&self, key: &str) -> PathBuf {
        let hashed = format!("{:x}", md5_simple(key));
        self.bucket_dir.join("meta").join(format!("{}.json", hashed))
    }

    pub async fn put(&self, key: &str, data: &[u8], content_type: Option<String>) -> StorageResult<ObjectMeta> {
        Self::validate_key(key)?;

        tokio::fs::create_dir_all(self.bucket_dir.join("objects")).await?;
        tokio::fs::create_dir_all(self.bucket_dir.join("meta")).await?;

        let sha256 = hash_bytes(data);
        let now = Utc::now();

        // Читаем существующий мета если есть (обновление)
        let existing_id = if let Ok(old) = self.get_meta(key).await {
            old.id
        } else {
            Uuid::new_v4()
        };

        let meta = ObjectMeta {
            id: existing_id,
            bucket_id: self.bucket_id,
            key: key.to_string(),
            sha256,
            size_bytes: data.len() as u64,
            content_type,
            created_at: now,
            updated_at: now,
        };

        tokio::fs::write(self.object_path(key), data).await?;
        tokio::fs::write(self.meta_path(key), serde_json::to_string_pretty(&meta)?).await?;

        tracing::info!("Stored object '{}' ({} bytes)", key, meta.size_bytes);
        Ok(meta)
    }

    pub async fn get(&self, key: &str) -> StorageResult<ObjectData> {
        Self::validate_key(key)?;
        let meta = self.get_meta(key).await?;
        let bytes = tokio::fs::read(self.object_path(key)).await.map_err(|_| {
            StorageError::ObjectNotFound { bucket: self.bucket_id.to_string(), key: key.to_string() }
        })?;
        Ok(ObjectData { meta, bytes })
    }

    pub async fn get_meta(&self, key: &str) -> StorageResult<ObjectMeta> {
        let path = self.meta_path(key);
        if !path.exists() {
            return Err(StorageError::ObjectNotFound {
                bucket: self.bucket_id.to_string(),
                key: key.to_string(),
            });
        }
        let raw = tokio::fs::read_to_string(path).await?;
        Ok(serde_json::from_str(&raw)?)
    }

    pub async fn delete(&self, key: &str) -> StorageResult<()> {
        Self::validate_key(key)?;
        // Проверяем что объект существует
        self.get_meta(key).await?;
        let _ = tokio::fs::remove_file(self.object_path(key)).await;
        let _ = tokio::fs::remove_file(self.meta_path(key)).await;
        tracing::info!("Deleted object '{}'", key);
        Ok(())
    }

    pub async fn list(&self) -> StorageResult<Vec<ObjectMeta>> {
        let meta_dir = self.bucket_dir.join("meta");
        if !meta_dir.exists() {
            return Ok(vec![]);
        }
        let mut objects = vec![];
        let mut entries = tokio::fs::read_dir(&meta_dir).await?;
        while let Some(entry) = entries.next_entry().await? {
            if entry.path().extension().map(|e| e == "json").unwrap_or(false) {
                let raw = tokio::fs::read_to_string(entry.path()).await?;
                if let Ok(m) = serde_json::from_str::<ObjectMeta>(&raw) {
                    objects.push(m);
                }
            }
        }
        objects.sort_by(|a, b| a.created_at.cmp(&b.created_at));
        Ok(objects)
    }
}

/// Очень простой детерминированный хеш ключа для имени файла (не для безопасности)
fn md5_simple(s: &str) -> u64 {
    let mut h: u64 = 0xcbf29ce484222325;
    for b in s.bytes() {
        h ^= b as u64;
        h = h.wrapping_mul(0x100000001b3);
    }
    h
}

#[cfg(test)]
mod tests {
    use super::*;
    use tempfile::tempdir;

    fn make_store(dir: &tempfile::TempDir, bucket_id: Uuid) -> ObjectStore {
        ObjectStore::new(dir.path().join("bucket"), bucket_id)
    }

    #[tokio::test]
    async fn test_put_and_get_object() {
        let dir = tempdir().unwrap();
        let store = make_store(&dir, Uuid::new_v4());

        let meta = store.put("avatar.png", b"fake-png-data", Some("image/png".into())).await.unwrap();
        assert_eq!(meta.key, "avatar.png");
        assert_eq!(meta.size_bytes, 13);
        assert!(meta.content_type.as_deref() == Some("image/png"));

        let obj = store.get("avatar.png").await.unwrap();
        assert_eq!(obj.bytes, b"fake-png-data");
    }

    #[tokio::test]
    async fn test_sha256_dedup_detection() {
        let dir = tempdir().unwrap();
        let store = make_store(&dir, Uuid::new_v4());

        let m1 = store.put("file.txt", b"same-content", None).await.unwrap();
        let m2 = store.put("file.txt", b"same-content", None).await.unwrap();
        // Обновление того же ключа — id сохраняется
        assert_eq!(m1.id, m2.id);
        assert_eq!(m1.sha256, m2.sha256);
    }

    #[tokio::test]
    async fn test_delete_object() {
        let dir = tempdir().unwrap();
        let store = make_store(&dir, Uuid::new_v4());

        store.put("to-delete.txt", b"data", None).await.unwrap();
        store.delete("to-delete.txt").await.unwrap();
        let err = store.get("to-delete.txt").await.unwrap_err();
        assert!(matches!(err, StorageError::ObjectNotFound { .. }));
    }

    #[tokio::test]
    async fn test_invalid_key_rejected() {
        let dir = tempdir().unwrap();
        let store = make_store(&dir, Uuid::new_v4());
        let err = store.put("../escape.txt", b"data", None).await.unwrap_err();
        assert!(matches!(err, StorageError::InvalidKey { .. }));
    }

    #[tokio::test]
    async fn test_list_objects() {
        let dir = tempdir().unwrap();
        let store = make_store(&dir, Uuid::new_v4());
        store.put("a.txt", b"a", None).await.unwrap();
        store.put("b.txt", b"b", None).await.unwrap();
        let list = store.list().await.unwrap();
        assert_eq!(list.len(), 2);
    }
}
