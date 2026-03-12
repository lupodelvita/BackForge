use anyhow::{Context, Result};
use backforge_storage::StorageEngine;
use std::path::PathBuf;
use dirs::home_dir;

fn default_storage_root() -> PathBuf {
    home_dir()
        .unwrap_or_else(|| PathBuf::from("."))
        .join(".backforge")
        .join("storage")
}

pub async fn cmd_bucket_create(project: String, bucket: String) -> Result<()> {
    let engine = StorageEngine::new(default_storage_root());
    engine
        .create_bucket(&project, &bucket)
        .await
        .with_context(|| format!("Failed to create bucket '{bucket}' in project '{project}'"))?;
    println!("✓ Bucket '{}' created in project '{}'", bucket, project);
    Ok(())
}

pub async fn cmd_bucket_list(project: String) -> Result<()> {
    let engine = StorageEngine::new(default_storage_root());
    let buckets = engine
        .list_buckets(&project)
        .await
        .with_context(|| format!("Failed to list buckets for project '{project}'"))?;
    if buckets.is_empty() {
        println!("No buckets found for project '{}'.", project);
    } else {
        println!("Buckets in project '{}':", project);
        for b in &buckets {
            println!("  - {} ({})", b.name, b.id);
        }
    }
    Ok(())
}

pub async fn cmd_bucket_delete(project: String, bucket: String) -> Result<()> {
    let engine = StorageEngine::new(default_storage_root());
    engine
        .delete_bucket(&project, &bucket)
        .await
        .with_context(|| format!("Failed to delete bucket '{bucket}' in project '{project}'"))?;
    println!("✓ Bucket '{}' deleted from project '{}'", bucket, project);
    Ok(())
}

pub async fn cmd_upload(
    project: String,
    bucket: String,
    key: String,
    file: PathBuf,
    content_type: Option<String>,
) -> Result<()> {
    let engine = StorageEngine::new(default_storage_root());
    let meta = engine
        .upload_file(&project, &bucket, &key, &file, content_type)
        .await
        .with_context(|| format!("Failed to upload '{}' to {}/{}/{}", file.display(), project, bucket, key))?;
    println!(
        "✓ Uploaded '{}' → {}/{}/{} ({} bytes, SHA-256: {})",
        file.display(),
        project,
        bucket,
        key,
        meta.size_bytes,
        &meta.sha256[..16]
    );
    Ok(())
}

pub async fn cmd_download(
    project: String,
    bucket: String,
    key: String,
    output: PathBuf,
) -> Result<()> {
    let engine = StorageEngine::new(default_storage_root());
    let (meta, bytes) = engine
        .download(&project, &bucket, &key)
        .await
        .with_context(|| format!("Failed to download {}/{}/{}", project, bucket, key))?;
    tokio::fs::write(&output, &bytes)
        .await
        .with_context(|| format!("Failed to write to '{}'", output.display()))?;
    println!(
        "✓ Downloaded {}/{}/{} → '{}' ({} bytes)",
        project,
        bucket,
        key,
        output.display(),
        meta.size_bytes
    );
    Ok(())
}

pub async fn cmd_list(project: String, bucket: String) -> Result<()> {
    let engine = StorageEngine::new(default_storage_root());
    let objects = engine
        .list_objects(&project, &bucket)
        .await
        .with_context(|| format!("Failed to list objects in {}/{}", project, bucket))?;
    if objects.is_empty() {
        println!("No objects in {}/{}.", project, bucket);
    } else {
        println!("Objects in {}/{}:", project, bucket);
        for obj in &objects {
            println!("  {:40}  {:>10} bytes  {}", obj.key, obj.size_bytes, obj.created_at.format("%Y-%m-%d %H:%M:%S"));
        }
    }
    Ok(())
}

pub async fn cmd_delete(project: String, bucket: String, key: String) -> Result<()> {
    let engine = StorageEngine::new(default_storage_root());
    engine
        .delete_object(&project, &bucket, &key)
        .await
        .with_context(|| format!("Failed to delete {}/{}/{}", project, bucket, key))?;
    println!("✓ Deleted {}/{}/{}", project, bucket, key);
    Ok(())
}
