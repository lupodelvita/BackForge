use anyhow::Result;
use reqwest::Client;
use serde_json::Value;
use std::env;

fn sync_url() -> String {
    env::var("BACKFORGE_SYNC_URL").unwrap_or_else(|_| "http://localhost:8083".into())
}

pub async fn cmd_sync_push(project: String) -> Result<()> {
    let url = format!("{}/sync/{}", sync_url(), project);

    // Read local project_state.json
    let projects_root = dirs::data_local_dir()
        .unwrap_or_else(|| std::path::PathBuf::from("/tmp"))
        .join("backforge")
        .join("projects");
    let state_path = projects_root.join(&project).join("project_state.json");
    let content = std::fs::read(&state_path)
        .map_err(|_| anyhow::anyhow!("project '{}' not found at {}", project, state_path.display()))?;

    // Build minimal snapshot payload
    let id = uuid::Uuid::new_v4().to_string();
    let sha256 = {
        use sha2::{Sha256, Digest};
        let mut h = Sha256::new();
        h.update(&content);
        format!("{:x}", h.finalize())
    };

    // Load persisted clock
    let sync_root = dirs::data_local_dir()
        .unwrap_or_else(|| std::path::PathBuf::from("/tmp"))
        .join("backforge")
        .join("sync");
    std::fs::create_dir_all(&sync_root)?;
    let clock_path = sync_root.join(format!("{}.clock.json", project));
    let mut clock: std::collections::HashMap<String, u64> = if clock_path.exists() {
        serde_json::from_str(&std::fs::read_to_string(&clock_path)?)?
    } else {
        std::collections::HashMap::new()
    };

    let node_id = std::env::var("HOSTNAME").unwrap_or_else(|_| "local".to_string());
    *clock.entry(node_id.clone()).or_insert(0) += 1;

    let payload = serde_json::json!({
        "id": id,
        "project_name": project,
        "node_id": node_id,
        "clock": clock,
        "sha256": sha256,
        "content": content,
        "created_at": chrono::Utc::now().to_rfc3339(),
    });

    let client = Client::new();
    let resp = client.put(&url).json(&payload).send().await
        .map_err(|e| anyhow::anyhow!("sync server unreachable: {}", e))?;

    if !resp.status().is_success() {
        anyhow::bail!("push failed ({}): {}", resp.status(), resp.text().await?);
    }

    // Persist updated clock
    std::fs::write(&clock_path, serde_json::to_string_pretty(&clock)?)?;

    println!("✓ pushed '{}' (snapshot {}, sha {})", project, &id[..8], &sha256[..12]);
    Ok(())
}

pub async fn cmd_sync_pull(project: String) -> Result<()> {
    let url = format!("{}/sync/{}", sync_url(), project);
    let resp = reqwest::get(&url).await
        .map_err(|e| anyhow::anyhow!("sync server unreachable: {}", e))?;

    if resp.status().as_u16() == 404 {
        println!("no remote snapshot found for '{}'", project);
        return Ok(());
    }
    if !resp.status().is_success() {
        anyhow::bail!("pull failed ({}): {}", resp.status(), resp.text().await?);
    }

    let snap: Value = resp.json().await?;
    let content_bytes: Vec<u8> = serde_json::from_value(snap["content"].clone())?;

    let projects_root = dirs::data_local_dir()
        .unwrap_or_else(|| std::path::PathBuf::from("/tmp"))
        .join("backforge")
        .join("projects");
    let project_dir = projects_root.join(&project);
    std::fs::create_dir_all(&project_dir)?;
    std::fs::write(project_dir.join("project_state.json"), &content_bytes)?;

    let sha = snap["sha256"].as_str().unwrap_or("?");
    let id = snap["id"].as_str().unwrap_or("?");
    println!("✓ pulled '{}' (snapshot {}, sha {})", project, &id[..8.min(id.len())], &sha[..12.min(sha.len())]);
    Ok(())
}

pub async fn cmd_sync_status(project: String) -> Result<()> {
    let url = format!("{}/sync/{}", sync_url(), project);
    let resp = reqwest::get(&url).await
        .map_err(|e| anyhow::anyhow!("sync server unreachable: {}", e))?;

    if resp.status().as_u16() == 404 {
        println!("remote: no snapshot yet for '{}'", project);
        return Ok(());
    }
    if !resp.status().is_success() {
        anyhow::bail!("status check failed ({})", resp.status());
    }

    let snap: Value = resp.json().await?;
    println!("remote snapshot for '{}':", project);
    println!("  id:         {}", snap["id"].as_str().unwrap_or("?"));
    println!("  sha256:     {}", snap["sha256"].as_str().unwrap_or("?"));
    println!("  node:       {}", snap["node_id"].as_str().unwrap_or("?"));
    println!("  created_at: {}", snap["created_at"].as_str().unwrap_or("?"));
    println!("  clock:      {}", snap["clock"]);
    Ok(())
}

pub async fn cmd_sync_history(project: String) -> Result<()> {
    let url = format!("{}/sync/{}/history", sync_url(), project);
    let resp = reqwest::get(&url).await
        .map_err(|e| anyhow::anyhow!("sync server unreachable: {}", e))?;

    if !resp.status().is_success() {
        anyhow::bail!("history failed ({}): {}", resp.status(), resp.text().await?);
    }

    let metas: Vec<Value> = resp.json().await?;
    if metas.is_empty() {
        println!("no sync history for '{}'", project);
        return Ok(());
    }

    println!("{:<38} {:<20} {}", "SNAPSHOT ID", "CREATED AT", "SHA256");
    println!("{}", "-".repeat(80));
    for m in &metas {
        let id = m["id"].as_str().unwrap_or("?");
        let created = m["created_at"].as_str().unwrap_or("?");
        let sha = m["sha256"].as_str().unwrap_or("?");
        println!("{:<38} {:<20} {}", id, &created[..19.min(created.len())], &sha[..12.min(sha.len())]);
    }
    Ok(())
}
