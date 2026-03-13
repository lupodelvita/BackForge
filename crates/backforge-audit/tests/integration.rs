use backforge_audit::entry::{AuditAction, AuditEntry};
use backforge_audit::log::AuditLog;

fn make_log_in(dir: &tempfile::TempDir) -> AuditLog {
    AuditLog::new(dir.path())
}

#[test]
fn test_empty_log_returns_zero() {
    let dir = tempfile::tempdir().unwrap();
    let log = make_log_in(&dir);
    assert_eq!(log.count().unwrap(), 0);
    assert!(log.read_all().unwrap().is_empty());
}

#[test]
fn test_multi_entry_append_and_read() {
    let dir = tempfile::tempdir().unwrap();
    let log = make_log_in(&dir);

    let actions = vec![
        AuditAction::ProjectCreated,
        AuditAction::SchemaChanged,
        AuditAction::VersionCommitted { version: 1 },
        AuditAction::DeployStarted { target: "local".into() },
        AuditAction::DeployCompleted { target: "local".into() },
    ];
    for action in &actions {
        let entry = AuditEntry::new("shop", "alice", action.clone());
        log.append(&entry).unwrap();
    }

    let all = log.read_all().unwrap();
    assert_eq!(all.len(), 5);
    for entry in &all {
        assert_eq!(entry.project, "shop");
        assert_eq!(entry.actor, "alice");
    }
}

#[test]
fn test_read_recent_returns_last_n_in_order() {
    let dir = tempfile::tempdir().unwrap();
    let log = make_log_in(&dir);

    for i in 0u32..10 {
        let entry = AuditEntry::new("proj", "bot", AuditAction::VersionCommitted { version: i });
        log.append(&entry).unwrap();
    }

    let recent = log.read_recent(3).unwrap();
    assert_eq!(recent.len(), 3);
    // Last 3 should be versions 7, 8, 9
    if let AuditAction::VersionCommitted { version } = recent[0].action {
        assert_eq!(version, 7);
    } else {
        panic!("wrong action");
    }
    if let AuditAction::VersionCommitted { version } = recent[2].action {
        assert_eq!(version, 9);
    } else {
        panic!("wrong action");
    }
}

#[test]
fn test_log_survives_process_restart() {
    let dir = tempfile::tempdir().unwrap();
    let path = dir.path().join("audit.jsonl");

    // first "process": append two entries
    {
        let log = AuditLog::with_path(&path);
        log.append(&AuditEntry::new("p", "u", AuditAction::ProjectCreated)).unwrap();
        log.append(&AuditEntry::new("p", "u", AuditAction::SchemaChanged)).unwrap();
    }

    // second "process": re-open and verify entries are still there + append more
    {
        let log = AuditLog::with_path(&path);
        let all = log.read_all().unwrap();
        assert_eq!(all.len(), 2);
        log.append(&AuditEntry::new("p", "u", AuditAction::CodeGenerated { artifact: "sql".into() })).unwrap();
        assert_eq!(log.count().unwrap(), 3);
    }
}

#[test]
fn test_file_upload_download_audit_entries() {
    let dir = tempfile::tempdir().unwrap();
    let log = make_log_in(&dir);

    log.append(&AuditEntry::new(
        "files-project",
        "user1",
        AuditAction::FileUploaded { bucket: "avatars".into(), key: "user1.png".into() },
    )).unwrap();
    log.append(&AuditEntry::new(
        "files-project",
        "user1",
        AuditAction::FileDeleted { bucket: "avatars".into(), key: "user1.png".into() },
    )).unwrap();

    let all = log.read_all().unwrap();
    assert_eq!(all.len(), 2);

    if let AuditAction::FileUploaded { bucket, key } = &all[0].action {
        assert_eq!(bucket, "avatars");
        assert_eq!(key, "user1.png");
    } else {
        panic!("expected FileUploaded");
    }
    if let AuditAction::FileDeleted { bucket, key } = &all[1].action {
        assert_eq!(bucket, "avatars");
        assert_eq!(key, "user1.png");
    } else {
        panic!("expected FileDeleted");
    }
}

#[test]
fn test_count_matches_read_all_len() {
    let dir = tempfile::tempdir().unwrap();
    let log = make_log_in(&dir);

    for _ in 0..7 {
        log.append(&AuditEntry::new("x", "y", AuditAction::SchemaChanged)).unwrap();
    }
    assert_eq!(log.count().unwrap(), log.read_all().unwrap().len());
}
