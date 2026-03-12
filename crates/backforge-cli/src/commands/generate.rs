use anyhow::Result;
use reqwest::Client;
use serde_json::Value;
use std::env;
use std::path::PathBuf;
use std::fs;

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
        .map_err(|_| anyhow::anyhow!("project '{}' not found at {}", project, path.display()))?;
    Ok(serde_json::from_str(&raw)?)
}

async fn call_generate(endpoint: &str, state: &Value) -> Result<std::collections::HashMap<String, String>> {
    let url = format!("{}/generate/{}", codegen_url(), endpoint);
    let client = Client::new();
    let resp = client
        .post(&url)
        .json(&serde_json::json!({ "state": state }))
        .send()
        .await
        .map_err(|e| anyhow::anyhow!("code-generator unreachable: {}", e))?;

    if !resp.status().is_success() {
        anyhow::bail!("code-generator error ({}): {}", resp.status(), resp.text().await?);
    }

    let body: Value = resp.json().await?;
    let files: std::collections::HashMap<String, String> =
        serde_json::from_value(body["files"].clone())?;
    Ok(files)
}

fn write_output_files(
    project: &str,
    subdir: &str,
    files: std::collections::HashMap<String, String>,
) -> Result<()> {
    let out_dir = projects_root().join(project).join("generated").join(subdir);
    fs::create_dir_all(&out_dir)?;
    for (name, content) in &files {
        let path = out_dir.join(name);
        fs::write(&path, content)?;
        println!("  wrote {}", path.display());
    }
    Ok(())
}

/// `backforge generate sql <project>` — generate PostgreSQL DDL migrations
pub async fn cmd_generate_sql(project: String) -> Result<()> {
    let state = load_project_state(&project)?;
    println!("generating SQL for '{}'...", project);
    let files = call_generate("sql", &state).await?;
    println!("generated {} file(s):", files.len());
    write_output_files(&project, "sql", files)?;
    Ok(())
}

/// `backforge generate handlers <project>` — generate Go CRUD handler files
pub async fn cmd_generate_handlers(project: String) -> Result<()> {
    let state = load_project_state(&project)?;
    println!("generating Go handlers for '{}'...", project);
    let files = call_generate("handlers", &state).await?;
    println!("generated {} file(s):", files.len());
    write_output_files(&project, "handlers", files)?;
    Ok(())
}

/// `backforge generate openapi <project>` — generate OpenAPI 3.0 YAML spec
pub async fn cmd_generate_openapi(project: String) -> Result<()> {
    let state = load_project_state(&project)?;
    println!("generating OpenAPI spec for '{}'...", project);
    let files = call_generate("openapi", &state).await?;
    println!("generated {} file(s):", files.len());
    write_output_files(&project, "openapi", files)?;
    Ok(())
}

/// `backforge generate all <project>` — generate SQL + handlers + OpenAPI in one call
pub async fn cmd_generate_all(project: String) -> Result<()> {
    let state = load_project_state(&project)?;
    println!("generating all artifacts for '{}'...", project);
    let files = call_generate("all", &state).await?;
    println!("generated {} file(s):", files.len());
    // Route each file to its subdir based on extension
    let mut sql_files = std::collections::HashMap::new();
    let mut handler_files = std::collections::HashMap::new();
    let mut openapi_files = std::collections::HashMap::new();
    for (name, content) in files {
        if name.ends_with(".sql") {
            sql_files.insert(name, content);
        } else if name.ends_with(".yaml") || name.ends_with(".yml") {
            openapi_files.insert(name, content);
        } else {
            handler_files.insert(name, content);
        }
    }
    write_output_files(&project, "sql", sql_files)?;
    write_output_files(&project, "handlers", handler_files)?;
    write_output_files(&project, "openapi", openapi_files)?;
    println!("done. output: {}", projects_root().join(&project).join("generated").display());
    Ok(())
}
