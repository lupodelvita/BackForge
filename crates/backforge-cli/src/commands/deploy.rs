use anyhow::{Context, Result};
use serde::{Deserialize, Serialize};
use std::path::PathBuf;

const DEFAULT_DEPLOY_URL: &str = "http://localhost:8082";

fn deploy_url() -> String {
    std::env::var("BACKFORGE_DEPLOY_URL").unwrap_or_else(|_| DEFAULT_DEPLOY_URL.to_string())
}

#[derive(Serialize)]
struct DeployRequest {
    project_name: String,
    target: String,
    port: u16,
}

#[derive(Deserialize, Debug)]
struct DeploymentRecord {
    id: String,
    project_name: String,
    target: String,
    status: String,
    port: u16,
    url: String,
    #[serde(default)]
    error: String,
}

pub async fn cmd_deploy(project: String, target: String, port: u16) -> Result<()> {
    let url = format!("{}/deployments", deploy_url());

    let client = reqwest::Client::new();
    let resp = client
        .post(&url)
        .json(&DeployRequest {
            project_name: project.clone(),
            target: target.clone(),
            port,
        })
        .send()
        .await
        .with_context(|| format!(
            "Could not reach deployment service at {}. Is it running? Try: docker compose up -d",
            deploy_url()
        ))?;

    let status = resp.status();
    let body = resp.text().await.unwrap_or_default();

    if !status.is_success() {
        anyhow::bail!("Deployment service returned {}: {}", status, body.trim());
    }

    let record: DeploymentRecord = serde_json::from_str(&body)
        .with_context(|| format!("unexpected response: {}", body))?;

    println!("✓ Deployment started for project '{}'", record.project_name);
    println!("  ID:     {}", record.id);
    println!("  Target: {}", record.target);
    println!("  Status: {} (building in background)", record.status);
    println!("  Port:   {}", record.port);
    println!();
    println!("  Poll status:     backforge deploy status {}", record.id);
    println!("  View Dockerfile: backforge deploy dockerfile {}", record.id);
    Ok(())
}

pub async fn cmd_deploy_list() -> Result<()> {
    let url = format!("{}/deployments", deploy_url());
    let resp = reqwest::get(&url)
        .await
        .with_context(|| format!("Could not reach deployment service at {}", deploy_url()))?;

    let records: Vec<DeploymentRecord> = resp.json().await.context("invalid response")?;
    if records.is_empty() {
        println!("No deployments found.");
    } else {
        println!("{:<26}  {:<20}  {:<8}  {:<10}  {}", "ID", "PROJECT", "TARGET", "STATUS", "URL");
        println!("{}", "-".repeat(80));
        for r in &records {
            println!("{:<26}  {:<20}  {:<8}  {:<10}  {}", r.id, r.project_name, r.target, r.status, r.url);
        }
    }
    Ok(())
}

pub async fn cmd_deploy_status(id: String) -> Result<()> {
    let url = format!("{}/deployments/{}", deploy_url(), id);
    let resp = reqwest::get(&url)
        .await
        .with_context(|| format!("Could not reach deployment service at {}", deploy_url()))?;

    if resp.status() == reqwest::StatusCode::NOT_FOUND {
        anyhow::bail!("Deployment '{}' not found", id);
    }

    let record: DeploymentRecord = resp.json().await.context("invalid response")?;
    println!("Deployment: {}", record.id);
    println!("  Project: {}", record.project_name);
    println!("  Target:  {}", record.target);
    println!("  Status:  {}", record.status);
    println!("  Port:    {}", record.port);
    println!("  URL:     {}", record.url);
    if !record.error.is_empty() {
        println!("  Error:   {}", record.error);
    }
    Ok(())
}

pub async fn cmd_deploy_stop(id: String) -> Result<()> {
    let url = format!("{}/deployments/{}", deploy_url(), id);
    let client = reqwest::Client::new();
    let resp = client
        .delete(&url)
        .send()
        .await
        .with_context(|| format!("Could not reach deployment service at {}", deploy_url()))?;

    if resp.status() == reqwest::StatusCode::NOT_FOUND {
        anyhow::bail!("Deployment '{}' not found", id);
    }
    if !resp.status().is_success() {
        let body = resp.text().await.unwrap_or_default();
        anyhow::bail!("Failed to stop deployment: {}", body.trim());
    }
    println!("✓ Deployment '{}' stopped and removed", id);
    Ok(())
}

pub async fn cmd_deploy_dockerfile(id: String) -> Result<()> {
    let url = format!("{}/deployments/{}/dockerfile", deploy_url(), id);
    let resp = reqwest::get(&url)
        .await
        .with_context(|| format!("Could not reach deployment service at {}", deploy_url()))?;

    if resp.status() == reqwest::StatusCode::NOT_FOUND {
        anyhow::bail!("Deployment '{}' not found", id);
    }
    let text = resp.text().await.context("invalid response")?;
    print!("{}", text);
    Ok(())
}

/// Return the path to a project's directory (for validation in tests).
#[allow(dead_code)]
pub fn project_path(project: &str) -> PathBuf {
    crate::commands::project::projects_dir().join(project)
}
