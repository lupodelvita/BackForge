use anyhow::Result;
use reqwest::Client;
use serde::Deserialize;
use std::env;

fn metrics_url() -> String {
    env::var("BACKFORGE_METRICS_URL").unwrap_or_else(|_| "http://localhost:8085".into())
}

#[derive(Debug, Deserialize)]
struct RouteStats {
    project: String,
    method: String,
    route: String,
    requests: i64,
    errors: i64,
    avg_duration_ms: f64,
    max_duration_ms: f64,
}

#[derive(Debug, Deserialize)]
struct ProjectSummary {
    project: String,
    total_routes: i64,
    total_requests: i64,
    total_errors: i64,
    avg_duration_ms: f64,
}

#[derive(Debug, Deserialize)]
struct AllResponse {
    stats: Vec<RouteStats>,
}

#[derive(Debug, Deserialize)]
struct ProjectResponse {
    project: String,
    stats: Vec<RouteStats>,
}

#[derive(Debug, Deserialize)]
struct SummaryResponse {
    projects: Vec<ProjectSummary>,
}

/// `backforge metrics show [--project <name>]` — показать статистику маршрутов
pub async fn cmd_metrics_show(project: Option<String>) -> Result<()> {
    let client = Client::new();
    let url = match &project {
        Some(p) => format!("{}/metrics/project/{}", metrics_url(), p),
        None => format!("{}/metrics/json", metrics_url()),
    };

    let resp = client
        .get(&url)
        .send()
        .await
        .map_err(|e| anyhow::anyhow!("metrics service unreachable: {}", e))?;

    if !resp.status().is_success() {
        anyhow::bail!("metrics error ({})", resp.status());
    }

    if let Some(p) = &project {
        let data: ProjectResponse = resp.json().await?;
        println!("Metrics for project '{}':", p);
        print_route_table(&data.stats);
    } else {
        let data: AllResponse = resp.json().await?;
        println!("All route metrics:");
        print_route_table(&data.stats);
    }
    Ok(())
}

/// `backforge metrics summary` — сводка по проектам
pub async fn cmd_metrics_summary() -> Result<()> {
    let client = Client::new();
    let url = format!("{}/metrics/summary", metrics_url());

    let resp = client
        .get(&url)
        .send()
        .await
        .map_err(|e| anyhow::anyhow!("metrics service unreachable: {}", e))?;

    if !resp.status().is_success() {
        anyhow::bail!("metrics error ({})", resp.status());
    }

    let data: SummaryResponse = resp.json().await?;
    if data.projects.is_empty() {
        println!("No metrics recorded yet.");
        return Ok(());
    }

    println!(
        "{:<20}  {:>7}  {:>8}  {:>7}  {:>10}",
        "PROJECT", "ROUTES", "REQUESTS", "ERRORS", "AVG_MS"
    );
    println!("{}", "-".repeat(60));
    for p in &data.projects {
        println!(
            "{:<20}  {:>7}  {:>8}  {:>7}  {:>10.2}",
            p.project, p.total_routes, p.total_requests, p.total_errors, p.avg_duration_ms
        );
    }
    Ok(())
}

fn print_route_table(stats: &[RouteStats]) {
    if stats.is_empty() {
        println!("  (no data)");
        return;
    }
    println!(
        "  {:<8}  {:<30}  {:>8}  {:>6}  {:>8}  {:>8}",
        "METHOD", "ROUTE", "REQUESTS", "ERRORS", "AVG_MS", "MAX_MS"
    );
    println!("  {}", "-".repeat(76));
    for s in stats {
        println!(
            "  {:<8}  {:<30}  {:>8}  {:>6}  {:>8.2}  {:>8.2}",
            s.method, s.route, s.requests, s.errors, s.avg_duration_ms, s.max_duration_ms
        );
    }
}
