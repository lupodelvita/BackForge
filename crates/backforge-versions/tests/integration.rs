use backforge_core::project::{Field, FieldType, Table};
use backforge_core::ProjectState;
use backforge_versions::{ChangeKind, StateDiff, VersionStore};

fn make_project(name: &str) -> ProjectState {
    ProjectState::new(name, "integration test project")
}

fn add_table(state: &mut ProjectState, table_name: &str) {
    let mut t = Table::new(table_name);
    t.add_field(Field::new("id", FieldType::Uuid).primary_key());
    state.schema.tables.push(t);
}

#[test]
fn test_empty_store_has_no_versions() {
    let dir = tempfile::tempdir().unwrap();
    let store = VersionStore::new(dir.path().join("shop"));
    assert!(store.history().unwrap().is_empty());
    assert_eq!(store.latest_version().unwrap(), None);
}

#[test]
fn test_single_commit_stores_snapshot() {
    let dir = tempfile::tempdir().unwrap();
    let store = VersionStore::new(dir.path().join("shop"));

    let mut state = make_project("shop");
    add_table(&mut state, "users");

    let ver = store.commit(&state, Some("initial schema".into())).unwrap();
    assert_eq!(ver, 1);
    assert_eq!(store.latest_version().unwrap(), Some(1));

    let history = store.history().unwrap();
    assert_eq!(history.len(), 1);
    assert_eq!(history[0].version, 1);
    assert_eq!(history[0].message.as_deref(), Some("initial schema"));
}

#[test]
fn test_restore_returns_identical_state() {
    let dir = tempfile::tempdir().unwrap();
    let store = VersionStore::new(dir.path().join("blog"));

    let mut state = make_project("blog");
    add_table(&mut state, "posts");
    add_table(&mut state, "comments");

    store.commit(&state, None).unwrap();
    let restored = store.restore(1, "blog").unwrap();

    assert_eq!(restored.meta.name, "blog");
    assert_eq!(restored.schema.tables.len(), 2);
    let names: Vec<_> = restored.schema.tables.iter().map(|t| t.name.as_str()).collect();
    assert!(names.contains(&"posts"));
    assert!(names.contains(&"comments"));
}

#[test]
fn test_multiple_versions_increment() {
    let dir = tempfile::tempdir().unwrap();
    let store = VersionStore::new(dir.path().join("app"));

    let mut state = make_project("app");
    let v1 = store.commit(&state, Some("v1".into())).unwrap();

    add_table(&mut state, "users");
    let v2 = store.commit(&state, Some("v2".into())).unwrap();

    add_table(&mut state, "orders");
    let v3 = store.commit(&state, Some("v3".into())).unwrap();

    assert_eq!(v1, 1);
    assert_eq!(v2, 2);
    assert_eq!(v3, 3);
    assert_eq!(store.latest_version().unwrap(), Some(3));

    let history = store.history().unwrap();
    assert_eq!(history.len(), 3);
}

#[test]
fn test_restore_old_version_not_latest() {
    let dir = tempfile::tempdir().unwrap();
    let store = VersionStore::new(dir.path().join("app"));

    let mut state = make_project("app");
    store.commit(&state, Some("empty".into())).unwrap(); // v1: no tables

    add_table(&mut state, "users");
    store.commit(&state, Some("added users".into())).unwrap(); // v2: 1 table

    // Restore v1 — should have no tables
    let v1_state = store.restore(1, "app").unwrap();
    assert!(v1_state.schema.tables.is_empty());

    // Latest (v2) still has 1 table
    let v2_state = store.restore(2, "app").unwrap();
    assert_eq!(v2_state.schema.tables.len(), 1);
}

#[test]
fn test_restore_nonexistent_version_fails() {
    let dir = tempfile::tempdir().unwrap();
    let store = VersionStore::new(dir.path().join("app"));

    let state = make_project("app");
    store.commit(&state, None).unwrap();

    let result = store.restore(99, "app");
    assert!(result.is_err());
}

#[test]
fn test_diff_detects_added_table() {
    let dir = tempfile::tempdir().unwrap();
    let store = VersionStore::new(dir.path().join("shop"));

    let v1 = make_project("shop");
    store.commit(&v1, None).unwrap();

    let mut v2 = v1.clone();
    add_table(&mut v2, "products");
    store.commit(&v2, None).unwrap();

    let snap1 = store.restore(1, "shop").unwrap();
    let snap2 = store.restore(2, "shop").unwrap();

    let diff = StateDiff::compute(1, &snap1, 2, &snap2);
    assert!(!diff.is_empty());
    assert_eq!(diff.table_changes.len(), 1);
    assert_eq!(diff.table_changes[0].kind, ChangeKind::Added);
    assert_eq!(diff.table_changes[0].table_name, "products");
}

#[test]
fn test_diff_empty_between_identical_states() {
    let dir = tempfile::tempdir().unwrap();
    let store = VersionStore::new(dir.path().join("shop"));

    let mut state = make_project("shop");
    add_table(&mut state, "items");
    store.commit(&state, None).unwrap();
    store.commit(&state, None).unwrap(); // same state again

    let s1 = store.restore(1, "shop").unwrap();
    let s2 = store.restore(2, "shop").unwrap();

    let diff = StateDiff::compute(1, &s1, 2, &s2);
    assert!(diff.is_empty());
}
