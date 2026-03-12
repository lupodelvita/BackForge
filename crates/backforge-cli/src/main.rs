mod commands;

use clap::{Parser, Subcommand};
use anyhow::Result;
use std::path::PathBuf;

#[derive(Parser)]
#[command(name = "backforge")]
#[command(about = "BackForge — backend builder platform", version = "0.1.0")]
struct Cli {
    #[command(subcommand)]
    command: Commands,
}

#[derive(Subcommand)]
enum Commands {
    /// Управление проектами
    Project {
        #[command(subcommand)]
        action: ProjectAction,
    },
    /// Управление объектным хранилищем
    Storage {
        #[command(subcommand)]
        action: StorageAction,
    },
    /// Деплой проекта в Docker или облако
    Deploy {
        #[command(subcommand)]
        action: DeployAction,
    },
}

#[derive(Subcommand)]
enum ProjectAction {
    Create {
        name: String,
        #[arg(short, long, default_value = "")]
        description: String,
    },
    List,
    Info { name: String },
}

#[derive(Subcommand)]
enum StorageAction {
    BucketCreate { project: String, bucket: String },
    BucketList { project: String },
    BucketDelete { project: String, bucket: String },
    Upload {
        project: String,
        bucket: String,
        key: String,
        file: PathBuf,
        #[arg(short, long)]
        content_type: Option<String>,
    },
    Download {
        project: String,
        bucket: String,
        key: String,
        output: PathBuf,
    },
    List { project: String, bucket: String },
    Delete { project: String, bucket: String, key: String },
}

#[derive(Subcommand)]
enum DeployAction {
    /// Деплой проекта (по умолчанию: local Docker)
    Run {
        /// Имя проекта
        project: String,
        /// Целевая платформа: local | cloud | edge
        #[arg(short, long, default_value = "local")]
        target: String,
        /// Порт на котором будет доступен backend
        #[arg(short, long, default_value_t = 3000)]
        port: u16,
    },
    /// Список активных деплойментов
    List,
    /// Статус конкретного деплоймента
    Status { id: String },
    /// Остановить деплоймент
    Stop { id: String },
    /// Показать сгенерированный Dockerfile
    Dockerfile { id: String },
}

#[tokio::main]
async fn main() -> Result<()> {
    tracing_subscriber::fmt()
        .with_env_filter(
            tracing_subscriber::EnvFilter::from_default_env()
                .add_directive("backforge=info".parse()?),
        )
        .init();

    let cli = Cli::parse();

    match cli.command {
        Commands::Project { action } => match action {
            ProjectAction::Create { name, description } => {
                commands::project::cmd_create(name, description)?;
            }
            ProjectAction::List => {
                commands::project::cmd_list()?;
            }
            ProjectAction::Info { name } => {
                commands::project::cmd_info(name)?;
            }
        },
        Commands::Storage { action } => match action {
            StorageAction::BucketCreate { project, bucket } => {
                commands::storage::cmd_bucket_create(project, bucket).await?;
            }
            StorageAction::BucketList { project } => {
                commands::storage::cmd_bucket_list(project).await?;
            }
            StorageAction::BucketDelete { project, bucket } => {
                commands::storage::cmd_bucket_delete(project, bucket).await?;
            }
            StorageAction::Upload { project, bucket, key, file, content_type } => {
                commands::storage::cmd_upload(project, bucket, key, file, content_type).await?;
            }
            StorageAction::Download { project, bucket, key, output } => {
                commands::storage::cmd_download(project, bucket, key, output).await?;
            }
            StorageAction::List { project, bucket } => {
                commands::storage::cmd_list(project, bucket).await?;
            }
            StorageAction::Delete { project, bucket, key } => {
                commands::storage::cmd_delete(project, bucket, key).await?;
            }
        },
        Commands::Deploy { action } => match action {
            DeployAction::Run { project, target, port } => {
                commands::deploy::cmd_deploy(project, target, port).await?;
            }
            DeployAction::List => {
                commands::deploy::cmd_deploy_list().await?;
            }
            DeployAction::Status { id } => {
                commands::deploy::cmd_deploy_status(id).await?;
            }
            DeployAction::Stop { id } => {
                commands::deploy::cmd_deploy_stop(id).await?;
            }
            DeployAction::Dockerfile { id } => {
                commands::deploy::cmd_deploy_dockerfile(id).await?;
            }
        },
    }

    Ok(())
}
