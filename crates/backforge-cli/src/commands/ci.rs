use anyhow::{Context, Result};
use reqwest::Client;
use serde::{Deserialize, Serialize};
use serde_json::Value;
use std::env;
use std::fs;
use std::path::PathBuf;

fn codegen_url() -> String {
    env::var("BACKFORGE_CODEGEN_URL").unwrap_or_else(|_| "http://localhost:8084".into())
}

fn projects_root() -> PathBuf {
    dirs::data_local_dir()
        .unwrap_or_else(|| PathBuf::from("/tmp"))
        .join("backforge")
        .join("projects")
}

fn load_project_state(project: &str) -> Result<Value> {
    let path = projects_root().join(project).join("project_state.json");
    let raw = fs::read_to_string(&path)
        .with_context(|| format!("project '{}' not found at {}", project, path.display()))?;
    Ok(serde_json::from_str(&raw)?)
}

// ── response types ─────────────────────────────────────────────────────────────

#[derive(Deserialize, Serialize, Debug)]
struct CheckResult {
    name: String,
    passed: bool,
    #[serde(default)]
    message: String,
}

#[derive(Deserialize, Serialize, Debug)]
struct ValidationReport {
    project: String,
    valid: bool,
    checks: Vec<CheckResult>,
}

#[derive(Deserialize, Debug)]
struct ValidateResponse {
    report: ValidationReport,
    #[allow(dead_code)]
    files: std::collections::HashMap<String, String>,
}

// ── ci validate ───────────────────────────────────────────────────────────────

/// `backforge ci validate <project>` — generate all artefacts and run CI checks.
pub async fn cmd_ci_validate(project: String) -> Result<()> {
    let state = load_project_state(&project)?;
    println!("running CI validation for '{}'...", project);

    let url = format!("{}/generate/validate", codegen_url());
    let client = Client::new();
    let resp = client
        .post(&url)
        .json(&serde_json::json!({ "state": state }))
        .send()
        .await
        .map_err(|e| anyhow::anyhow!("code-generator unreachable: {}", e))?;

    let status = resp.status();
    let body: ValidateResponse = resp
        .json()
        .await
        .with_context(|| "failed to parse validation response")?;

    print_report(&body.report);

    if !body.report.valid {
        anyhow::bail!("CI validation failed for project '{}'", project);
    }

    println!();
    if status.is_success() {
        println!("CI passed — all checks green.");
    }
    Ok(())
}

// ── ci report ─────────────────────────────────────────────────────────────────

/// `backforge ci report <project>` — same as validate but saves a JSON report file.
pub async fn cmd_ci_report(project: String) -> Result<()> {
    let state = load_project_state(&project)?;
    println!("generating CI report for '{}'...", project);

    let url = format!("{}/generate/validate", codegen_url());
    let client = Client::new();
    let resp = client
        .post(&url)
        .json(&serde_json::json!({ "state": state }))
        .send()
        .await
        .map_err(|e| anyhow::anyhow!("code-generator unreachable: {}", e))?;

    let body: ValidateResponse = resp
        .json()
        .await
        .with_context(|| "failed to parse validation response")?;

    let out_dir = projects_root().join(&project).join("ci");
    fs::create_dir_all(&out_dir)?;
    let report_path = out_dir.join("report.json");
    fs::write(&report_path, serde_json::to_string_pretty(&body.report)?)?;
    println!("report saved → {}", report_path.display());

    print_report(&body.report);
    Ok(())
}

// ── helpers ───────────────────────────────────────────────────────────────────

fn print_report(report: &ValidationReport) {
    println!();
    println!("CI Report — project: {}", report.project);
    println!("Status: {}", if report.valid { "PASS ✓" } else { "FAIL ✗" });
    println!("{:-<55}", "");
    for c in &report.checks {
        let icon = if c.passed { "✓" } else { "✗" };
        if c.message.is_empty() {
            println!("  [{}] {}", icon, c.name);
        } else {
            println!("  [{}] {}  —  {}", icon, c.name, c.message);
        }
    }
    println!("{:-<55}", "");
}
