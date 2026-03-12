use sha2::{Digest, Sha256};
use std::path::Path;
use tokio::io::AsyncReadExt;
use crate::StorageResult;

/// Вычислить SHA-256 хеш файла (возвращает hex-строку)
pub async fn hash_file(path: &Path) -> StorageResult<String> {
    let mut file = tokio::fs::File::open(path).await?;
    let mut hasher = Sha256::new();
    let mut buf = vec![0u8; 64 * 1024]; // 64 KB chunks

    loop {
        let n = file.read(&mut buf).await?;
        if n == 0 {
            break;
        }
        hasher.update(&buf[..n]);
    }

    Ok(hex::encode(hasher.finalize()))
}

/// Вычислить SHA-256 хеш байтов в памяти
pub fn hash_bytes(data: &[u8]) -> String {
    let mut hasher = Sha256::new();
    hasher.update(data);
    hex::encode(hasher.finalize())
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_hash_bytes_deterministic() {
        let data = b"hello world";
        let h1 = hash_bytes(data);
        let h2 = hash_bytes(data);
        assert_eq!(h1, h2);
        assert_eq!(h1.len(), 64); // SHA-256 = 32 bytes = 64 hex chars
    }

    #[test]
    fn test_hash_bytes_different_inputs() {
        let h1 = hash_bytes(b"hello");
        let h2 = hash_bytes(b"world");
        assert_ne!(h1, h2);
    }

    #[tokio::test]
    async fn test_hash_file() {
        use tokio::io::AsyncWriteExt;
        let dir = tempfile::tempdir().unwrap();
        let path = dir.path().join("test.txt");
        let mut f = tokio::fs::File::create(&path).await.unwrap();
        f.write_all(b"hello world").await.unwrap();
        f.flush().await.unwrap();
        drop(f);

        let file_hash = hash_file(&path).await.unwrap();
        let bytes_hash = hash_bytes(b"hello world");
        assert_eq!(file_hash, bytes_hash);
    }
}
