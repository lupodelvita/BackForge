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
}

#[derive(Subcommand)]
enum ProjectAction {
    /// Создать новый проект
    Create {
        name: String,
        #[arg(short, long, default_value = "")]
        description: String,
    },
    /// Список всех проектов
    List,
    /// Информация о проекте
    Info {
        name: String,
    },
}

#[derive(Subcommand)]
enum StorageAction {
    /// Создать bucket
    BucketCreate {
        project: String,
        bucket: String,
    },
    /// Список bucket'ов проекта
    BucketList {
        project: String,
    },
    /// Удалить bucket
    BucketDelete {
        project: String,
        bucket: String,
    },
    /// Загрузить файл в хранилище
    Upload {
        project: String,
        bucket: String,
        key: String,
        file: PathBuf,
        #[arg(short, long)]
        content_type: Option<String>,
    },
    /// Скачать объект из хранилища
    Download {
        project: String,
        bucket: String,
        key: String,
        output: PathBuf,
    },
    /// Список объектов в bucket'е
    List {
        project: String,
        bucket: String,
    },
    /// Удалить объект
    Delete {
        project: String,
        bucket: String,
        key: String,
    },
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
    }

    Ok(())
}
