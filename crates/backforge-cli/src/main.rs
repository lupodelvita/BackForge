mod commands;

use clap::{Parser, Subcommand};
use anyhow::Result;

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
}

#[derive(Subcommand)]
enum ProjectAction {
    /// Создать новый проект
    Create {
        /// Название проекта
        name: String,
        /// Описание (опционально)
        #[arg(short, long, default_value = "")]
        description: String,
    },
    /// Список всех проектов
    List,
    /// Информация о проекте
    Info {
        /// Название проекта
        name: String,
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
    }

    Ok(())
}
