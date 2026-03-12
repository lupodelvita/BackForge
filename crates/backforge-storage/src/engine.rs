use std::path::{Path, PathBuf};
use tokio::io::AsyncReadExt;
use uuid::Uuid;
use crate::StorageResult;
use crate::bucket::{Bucket, BucketManager};
use crate::object::{ObjectMeta, ObjectStore};

/// Главная точка входа в Storage Engine.
/// Оркестрирует BucketManager и ObjectStore, предоставляя
/// единый API для всей файловой системы хранилища.
pub struct StorageEngine {
    bucket_mgr: BucketManager,
    storage_root: PathBuf,
}

impl StorageEngine {
    pub fn new(storage_root: impl Into<PathBuf>) -> Self {
        let root: PathBuf = storage_root.into();
        Self {
            bucket_mgr: BucketManager::new(root.clone()),
            storage_root: root,
        }
    }

    // ─── Bucket operations ───────────────────────────────────────

    pub async fn create_bucket(&self, project: &str, name: &str) -> StorageResult<Bucket> {
        self.bucket_mgr.create(project, name).await
    }

    pub async fn list_buckets(&self, project: &str) -> StorageResult<Vec<Bucket>> {
        self.bucket_mgr.list(project).await
    }

    pub async fn delete_bucket(&self, project: &str, name: &str) -> StorageResult<()> {
        self.bucket_mgr.delete(project, name).await
    }

    // ─── Object operations ───────────────────────────────────────

    fn object_store(&self, project: &str, bucket: &str, bucket_id: Uuid) -> ObjectStore {
        ObjectStore::new(self.storage_root.join(project).join(bucket), bucket_id)
    }

    pub async fn upload(
        &self,
        project: &str,
        bucket_name: &str,
        key: &str,
        data: &[u8],
        content_type: Option<String>,
    ) -> StorageResult<ObjectMeta> {
        let bucket = self.bucket_mgr.get(project, bucket_name).await?;
        let store = self.object_store(project, bucket_name, bucket.id);
        store.put(key, data, content_type).await
    }

    /// Upload из файла на диске (zero-copy streaming через tokio)
    pub async fn upload_file(
        &self,
        project: &str,
        bucket_name: &str,
        key: &str,
        file_path: &Path,
        content_type: Option<String>,
    ) -> StorageResult<ObjectMeta> {
        let bucket = self.bucket_mgr.get(project, bucket_name).await?;
        let store = self.object_store(project, bucket_name, bucket.id);

        // Читаем файл через tokio::fs (async I/O)
        let mut file = tokio::fs::File::open(file_path).await?;
        let mut data = Vec::new();
        file.read_to_end(&mut data).await?;

        store.put(key, &data, content_type).await
    }

    pub async fn download(
        &self,
        project: &str,
        bucket_name: &str,
        key: &str,
    ) -> StorageResult<(ObjectMeta, Vec<u8>)> {
        let bucket = self.bucket_mgr.get(project, bucket_name).await?;
        let store = self.object_store(project, bucket_name, bucket.id);
        let obj = store.get(key).await?;
        Ok((obj.meta, obj.bytes))
    }

    pub async fn get_meta(
        &self,
        project: &str,
        bucket_name: &str,
        key: &str,
    ) -> StorageResult<ObjectMeta> {
        let bucket = self.bucket_mgr.get(project, bucket_name).await?;
        let store = self.object_store(project, bucket_name, bucket.id);
        store.get_meta(key).await
    }

    pub async fn delete_object(
        &self,
        project: &str,
        bucket_name: &str,
        key: &str,
    ) -> StorageResult<()> {
        let bucket = self.bucket_mgr.get(project, bucket_name).await?;
        let store = self.object_store(project, bucket_name, bucket.id);
        store.delete(key).await
    }

    pub async fn list_objects(
        &self,
        project: &str,
        bucket_name: &str,
    ) -> StorageResult<Vec<ObjectMeta>> {
        let bucket = self.bucket_mgr.get(project, bucket_name).await?;
        let store = self.object_store(project, bucket_name, bucket.id);
        store.list().await
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::StorageError;
    use tempfile::tempdir;

    #[tokio::test]
    async fn test_upload_and_download() {
        let dir = tempdir().unwrap();
        let engine = StorageEngine::new(dir.path());

        engine.create_bucket("app", "media").await.unwrap();
        engine.upload("app", "media", "hello.txt", b"Hello, BackForge!", Some("text/plain".into())).await.unwrap();

        let (meta, bytes) = engine.download("app", "media", "hello.txt").await.unwrap();
        assert_eq!(bytes, b"Hello, BackForge!");
        assert_eq!(meta.key, "hello.txt");
        assert_eq!(meta.size_bytes, 17);
    }

    #[tokio::test]
    async fn test_upload_to_nonexistent_bucket_fails() {
        let dir = tempdir().unwrap();
        let engine = StorageEngine::new(dir.path());
        let err = engine.upload("app", "nosuchbucket", "f", b"data", None).await.unwrap_err();
        assert!(matches!(err, StorageError::BucketNotFound { .. }));
    }

    #[tokio::test]
    async fn test_delete_object_and_list() {
        let dir = tempdir().unwrap();
        let engine = StorageEngine::new(dir.path());
        engine.create_bucket("app", "docs").await.unwrap();
        engine.upload("app", "docs", "a.txt", b"a", None).await.unwrap();
        engine.upload("app", "docs", "b.txt", b"b", None).await.unwrap();

        let list = engine.list_objects("app", "docs").await.unwrap();
        assert_eq!(list.len(), 2);

        engine.delete_object("app", "docs", "a.txt").await.unwrap();
        let list2 = engine.list_objects("app", "docs").await.unwrap();
        assert_eq!(list2.len(), 1);
        assert_eq!(list2[0].key, "b.txt");
    }

    #[tokio::test]
    async fn test_upload_file_from_disk() {
        use tokio::io::AsyncWriteExt;
        let dir = tempdir().unwrap();
        let engine = StorageEngine::new(dir.path());
        engine.create_bucket("app", "uploads").await.unwrap();

        let file_path = dir.path().join("sample.txt");
        let mut f = tokio::fs::File::create(&file_path).await.unwrap();
        f.write_all(b"file content from disk").await.unwrap();
        f.flush().await.unwrap();
        drop(f);

        engine.upload_file("app", "uploads", "sample.txt", &file_path, None).await.unwrap();
        let (_, bytes) = engine.download("app", "uploads", "sample.txt").await.unwrap();
        assert_eq!(bytes, b"file content from disk");
    }
}
