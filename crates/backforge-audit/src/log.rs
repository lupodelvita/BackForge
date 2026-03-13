use std::fs::{File, OpenOptions};
use std::io::{BufRead, BufReader, Write};
use std::path::{Path, PathBuf};

use crate::entry::AuditEntry;
use crate::error::AuditResult;

/// Append-only лог событий, хранящийся как `.jsonl` файл на диске.
///
/// Каждая строка — один JSON-объект `AuditEntry`.  Запись только добавляется
/// в конец файла (O_APPEND), что исключает потерю данных при сбое.
pub struct AuditLog {
    log_path: PathBuf,
}

impl AuditLog {
    /// Создать/открыть лог для проекта в директории `project_dir`.
    /// Файл будет называться `audit.jsonl`.
    pub fn new(project_dir: impl AsRef<Path>) -> Self {
        Self {
            log_path: project_dir.as_ref().join("audit.jsonl"),
        }
    }

    /// Создать/открыть лог по явному пути к файлу.
    pub fn with_path(log_path: impl Into<PathBuf>) -> Self {
        Self {
            log_path: log_path.into(),
        }
    }

    /// Путь к файлу лога.
    pub fn path(&self) -> &Path {
        &self.log_path
    }

    /// Добавить запись в конец лога.
    pub fn append(&self, entry: &AuditEntry) -> AuditResult<()> {
        let mut file = OpenOptions::new()
            .create(true)
            .append(true)
            .open(&self.log_path)?;

        let line = serde_json::to_string(entry)?;
        writeln!(file, "{}", line)?;
        Ok(())
    }

    /// Прочитать все записи из лога.
    pub fn read_all(&self) -> AuditResult<Vec<AuditEntry>> {
        if !self.log_path.exists() {
            return Ok(Vec::new());
        }

        let file = File::open(&self.log_path)?;
        let reader = BufReader::new(file);
        let mut entries = Vec::new();

        for line in reader.lines() {
            let line = line?;
            let trimmed = line.trim();
            if trimmed.is_empty() {
                continue;
            }
            entries.push(serde_json::from_str(trimmed)?);
        }

        Ok(entries)
    }

    /// Прочитать последние `n` записей (сохраняя хронологический порядок).
    pub fn read_recent(&self, n: usize) -> AuditResult<Vec<AuditEntry>> {
        let mut all = self.read_all()?;
        if all.len() > n {
            all.drain(..all.len() - n);
        }
        Ok(all)
    }

    /// Вернуть количество записей в логе без полной загрузки в память.
    pub fn count(&self) -> AuditResult<usize> {
        if !self.log_path.exists() {
            return Ok(0);
        }
        let file = File::open(&self.log_path)?;
        let reader = BufReader::new(file);
        let count = reader
            .lines()
            .filter(|l| l.as_ref().map(|s| !s.trim().is_empty()).unwrap_or(false))
            .count();
        Ok(count)
    }

    /// Очистить лог (создаёт пустой файл).
    ///
    /// **Необратимо**. Используйте только в тестах.
    #[cfg(test)]
    pub fn clear(&self) -> AuditResult<()> {
        use std::fs;
        if self.log_path.exists() {
            fs::remove_file(&self.log_path)?;
        }
        Ok(())
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::entry::AuditAction;
    use tempfile::tempdir;

    fn make_log(dir: &Path) -> AuditLog {
        AuditLog::new(dir)
    }

    #[test]
    fn test_append_and_read_all() {
        let dir = tempdir().unwrap();
        let log = make_log(dir.path());

        let e1 = AuditEntry::new("proj", "cli", AuditAction::ProjectCreated);
        let e2 = AuditEntry::new("proj", "cli", AuditAction::SchemaChanged);

        log.append(&e1).unwrap();
        log.append(&e2).unwrap();

        let all = log.read_all().unwrap();
        assert_eq!(all.len(), 2);
        assert_eq!(all[0].action, AuditAction::ProjectCreated);
        assert_eq!(all[1].action, AuditAction::SchemaChanged);
    }

    #[test]
    fn test_read_recent_returns_last_n() {
        let dir = tempdir().unwrap();
        let log = make_log(dir.path());

        for i in 0..5u32 {
            let e = AuditEntry::new(
                "proj",
                "cli",
                AuditAction::VersionCommitted { version: i },
            );
            log.append(&e).unwrap();
        }

        let recent = log.read_recent(3).unwrap();
        assert_eq!(recent.len(), 3);
        // last 3 are versions 2, 3, 4
        assert_eq!(
            recent[0].action,
            AuditAction::VersionCommitted { version: 2 }
        );
        assert_eq!(
            recent[2].action,
            AuditAction::VersionCommitted { version: 4 }
        );
    }

    #[test]
    fn test_read_all_empty_when_no_file() {
        let dir = tempdir().unwrap();
        let log = make_log(dir.path());
        let all = log.read_all().unwrap();
        assert!(all.is_empty());
    }

    #[test]
    fn test_count() {
        let dir = tempdir().unwrap();
        let log = make_log(dir.path());

        assert_eq!(log.count().unwrap(), 0);

        log.append(&AuditEntry::new("p", "u", AuditAction::ProjectCreated))
            .unwrap();
        log.append(&AuditEntry::new("p", "u", AuditAction::SchemaChanged))
            .unwrap();

        assert_eq!(log.count().unwrap(), 2);
    }

    #[test]
    fn test_entries_survive_round_trip() {
        let dir = tempdir().unwrap();
        let log = make_log(dir.path());

        let original = AuditEntry::new(
            "myproject",
            "alice",
            AuditAction::DeployStarted {
                target: "production".into(),
            },
        );
        let id = original.id;
        let ts = original.timestamp;

        log.append(&original).unwrap();
        let entries = log.read_all().unwrap();
        assert_eq!(entries.len(), 1);
        assert_eq!(entries[0].id, id);
        assert_eq!(entries[0].project, "myproject");
        assert_eq!(entries[0].actor, "alice");
        assert_eq!(entries[0].timestamp, ts);
        matches!(
            &entries[0].action,
            AuditAction::DeployStarted { target } if target == "production"
        );
    }

    #[test]
    fn test_custom_action() {
        let dir = tempdir().unwrap();
        let log = make_log(dir.path());

        let entry = AuditEntry::new(
            "proj",
            "system",
            AuditAction::Custom {
                event: "backup_created".into(),
                details: Some("size=1234".into()),
            },
        );
        log.append(&entry).unwrap();

        let all = log.read_all().unwrap();
        assert_eq!(all.len(), 1);
        if let AuditAction::Custom { event, details } = &all[0].action {
            assert_eq!(event, "backup_created");
            assert_eq!(details.as_deref(), Some("size=1234"));
        } else {
            panic!("expected Custom action");
        }
    }
}
