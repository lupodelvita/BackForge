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
    /// Синхронизация проекта с удалённым сервером
    Sync {
        #[command(subcommand)]
        action: SyncAction,
    },
    /// Генерация кода из project_state (SQL, Go handlers, OpenAPI)
    Generate {
        #[command(subcommand)]
        action: GenerateAction,
    },
    /// Версионирование project_state (история, rollback, diff)
    Version {
        #[command(subcommand)]
        action: VersionAction,
    },
    /// Мониторинг запросов (латентность, ошибки, статистика)
    Metrics {
        #[command(subcommand)]
        action: MetricsAction,
    },
    /// Безопасность: RBAC-политики и audit log
    Security {
        #[command(subcommand)]
        action: SecurityAction,
    },
    /// Миграции БД: генерация, применение, статус, откат
    Migrate {
        #[command(subcommand)]
        action: MigrateAction,
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
enum SyncAction {
    /// Отправить локальный снимок на sync-сервер
    Push { project: String },
    /// Получить последний снимок с sync-сервера
    Pull { project: String },
    /// Показать состояние синхронизации проекта
    Status { project: String },
    /// История синхронизаций проекта
    History { project: String },
}

#[derive(Subcommand)]
enum GenerateAction {
    /// Генерировать PostgreSQL DDL миграции
    Sql { project: String },
    /// Генерировать Go CRUD-обработчики
    Handlers { project: String },
    /// Генерировать OpenAPI 3.0 спецификацию
    Openapi { project: String },
    /// Генерировать всё (SQL + handlers + OpenAPI)
    All { project: String },
}

#[derive(Subcommand)]
enum MetricsAction {
    /// Показать статистику маршрутов (все или по проекту)
    Show {
        #[arg(short, long)]
        project: Option<String>,
    },
    /// Сводка по проектам
    Summary,
}

#[derive(Subcommand)]
enum SecurityAction {
    /// Показать RBAC-политики проекта (разрешения ролей)
    PermissionsShow { project: String },
    /// Проверить конкретное разрешение
    PermissionsCheck {
        project: String,
        #[arg(long)]
        role: String,
        #[arg(long)]
        action: String,
        #[arg(long)]
        resource: String,
    },
    /// Показать audit log проекта
    AuditShow {
        project: String,
        /// Число последних записей (по умолчанию 20)
        #[arg(short, long, default_value_t = 20)]
        last: usize,
    },
    /// Число записей в audit log
    AuditCount { project: String },
}

#[derive(Subcommand)]
enum MigrateAction {
    /// Сгенерировать SQL-миграцию из диффа схем (offline, БД не нужна)
    Generate {
        project: String,
        /// Описание миграции (e.g. "add_users_table")
        #[arg(short, long, default_value = "migration")]
        description: String,
        /// Сравнивать с указанной версией project_schema (default: последняя версия)
        #[arg(long)]
        from_version: Option<u32>,
    },
    /// Применить все ожидающие миграции (требует DATABASE_URL)
    Run { project: String },
    /// Показать применённые / ожидающие миграции (требует DATABASE_URL)
    Status { project: String },
    /// Убрать последнюю миграцию из таблицы отслеживания (требует DATABASE_URL)
    Rollback { project: String },
}

#[derive(Subcommand)]
enum VersionAction {
    /// Сохранить текущий project_state как снимок
    Commit {
        project: String,
        #[arg(short, long)]
        message: Option<String>,
    },
    /// История версий проекта
    History { project: String },
    /// Откатить project_state к указанной версии
    Rollback { project: String, version: u32 },
    /// Diff между двумя версиями
    Diff { project: String, from: u32, to: u32 },
    /// Подробности конкретного снимка
    Show { project: String, version: u32 },
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
        Commands::Sync { action } => match action {
            SyncAction::Push { project } => {
                commands::sync::cmd_sync_push(project).await?;
            }
            SyncAction::Pull { project } => {
                commands::sync::cmd_sync_pull(project).await?;
            }
            SyncAction::Status { project } => {
                commands::sync::cmd_sync_status(project).await?;
            }
            SyncAction::History { project } => {
                commands::sync::cmd_sync_history(project).await?;
            }
        },
        Commands::Generate { action } => match action {
            GenerateAction::Sql { project } => {
                commands::generate::cmd_generate_sql(project).await?;
            }
            GenerateAction::Handlers { project } => {
                commands::generate::cmd_generate_handlers(project).await?;
            }
            GenerateAction::Openapi { project } => {
                commands::generate::cmd_generate_openapi(project).await?;
            }
            GenerateAction::All { project } => {
                commands::generate::cmd_generate_all(project).await?;
            }
        },
        Commands::Version { action } => match action {
            VersionAction::Commit { project, message } => {
                commands::versions::cmd_version_commit(project, message)?;
            }
            VersionAction::History { project } => {
                commands::versions::cmd_version_history(project)?;
            }
            VersionAction::Rollback { project, version } => {
                commands::versions::cmd_version_rollback(project, version)?;
            }
            VersionAction::Diff { project, from, to } => {
                commands::versions::cmd_version_diff(project, from, to)?;
            }
            VersionAction::Show { project, version } => {
                commands::versions::cmd_version_show(project, version)?;
            }
        },
        Commands::Metrics { action } => match action {
            MetricsAction::Show { project } => {
                commands::metrics::cmd_metrics_show(project).await?;
            }
            MetricsAction::Summary => {
                commands::metrics::cmd_metrics_summary().await?;
            }
        },
        Commands::Security { action } => match action {
            SecurityAction::PermissionsShow { project } => {
                commands::security::cmd_permissions_show(project)?;
            }
            SecurityAction::PermissionsCheck { project, role, action, resource } => {
                commands::security::cmd_permissions_check(project, role, action, resource)?;
            }
            SecurityAction::AuditShow { project, last } => {
                commands::security::cmd_audit_show(project, last)?;
            }
            SecurityAction::AuditCount { project } => {
                commands::security::cmd_audit_count(project)?;
            }
        },
        Commands::Migrate { action } => match action {
            MigrateAction::Generate { project, description, from_version } => {
                commands::migrate::cmd_generate(project, description, from_version)?;
            }
            MigrateAction::Run { project } => {
                commands::migrate::cmd_run(project).await?;
            }
            MigrateAction::Status { project } => {
                commands::migrate::cmd_status(project).await?;
            }
            MigrateAction::Rollback { project } => {
                commands::migrate::cmd_rollback(project).await?;
            }
        },
    }

    Ok(())
}
