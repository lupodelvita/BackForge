use anyhow::{Context, Result};
use reqwest::Client;
use serde::Deserialize;
use std::env;

fn analyzer_url() -> String {
    env::var("BACKFORGE_ANALYZER_URL").unwrap_or_else(|_| "http://localhost:8081".into())
}

// ── response types ─────────────────────────────────────────────────────────────

#[derive(Deserialize, Debug)]
struct PluginInfo {
    name: String,
    description: String,
    patterns: Vec<String>,
}

#[derive(Deserialize, Debug)]
struct PluginsResponse {
    plugins: Vec<PluginInfo>,
}

#[derive(Deserialize, Debug)]
struct DetectResponse {
    framework: Option<String>,
    confidence: f64,
    matched_patterns: Vec<String>,
}

// ── plugin list ───────────────────────────────────────────────────────────────

/// `backforge plugin list` — list available framework plugins from frontend-analyzer.
pub async fn cmd_plugin_list() -> Result<()> {
    let url = format!("{}/plugins", analyzer_url());
    let client = Client::new();
    let resp = client
        .get(&url)
        .send()
        .await
        .map_err(|e| anyhow::anyhow!("frontend-analyzer unreachable: {}", e))?;

    if !resp.status().is_success() {
        anyhow::bail!(
            "frontend-analyzer error ({}): {}",
            resp.status(),
            resp.text().await?
        );
    }

    let body: PluginsResponse = resp
        .json()
        .await
        .with_context(|| "failed to parse plugins response")?;

    println!("Available framework plugins ({}):", body.plugins.len());
    println!("{:-<50}", "");
    for p in &body.plugins {
        println!("  {}  —  {}", p.name, p.description);
        for pat in &p.patterns {
            println!("      pattern: {}", pat);
        }
    }
    Ok(())
}

// ── plugin detect ─────────────────────────────────────────────────────────────

/// `backforge plugin detect <file>` — detect which framework a source file uses.
pub async fn cmd_plugin_detect(file: String) -> Result<()> {
    let code = std::fs::read_to_string(&file)
        .with_context(|| format!("cannot read file: {}", file))?;

    let url = format!("{}/plugins/detect", analyzer_url());
    let client = Client::new();
    let resp = client
        .post(&url)
        .json(&serde_json::json!({ "code": code }))
        .send()
        .await
        .map_err(|e| anyhow::anyhow!("frontend-analyzer unreachable: {}", e))?;

    if !resp.status().is_success() {
        anyhow::bail!(
            "frontend-analyzer error ({}): {}",
            resp.status(),
            resp.text().await?
        );
    }

    let body: DetectResponse = resp
        .json()
        .await
        .with_context(|| "failed to parse detect response")?;

    match &body.framework {
        Some(fw) => {
            println!("Detected framework: {} (confidence: {:.0}%)", fw, body.confidence * 100.0);
            if !body.matched_patterns.is_empty() {
                println!("Matched patterns:");
                for p in &body.matched_patterns {
                    println!("  - {}", p);
                }
            }
        }
        None => {
            println!("No framework detected (confidence: {:.0}%)", body.confidence * 100.0);
        }
    }
    Ok(())
}
