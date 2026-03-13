use backforge_core::project::schema::{Field, FieldType, Table};
use backforge_core::ProjectManager;
use std::fs;
use std::path::PathBuf;

fn temp_dir() -> PathBuf {
    let dir = std::env::temp_dir()
        .join(format!("backforge-integration-{}", uuid::Uuid::new_v4()));
    fs::create_dir_all(&dir).unwrap();
    dir
}

#[test]
fn test_full_project_workflow() {
    let dir = temp_dir();
    let manager = ProjectManager::new(&dir);

    // 1. Создать проект
    let mut state = manager
        .create_project("e-commerce", "My e-commerce backend")
        .unwrap();
    assert_eq!(state.meta.name, "e-commerce");

    // 2. Добавить таблицу users
    let mut users = Table::new("users");
    users.add_field(Field::new("id", FieldType::Uuid).primary_key());
    users.add_field(Field::new("email", FieldType::Text).not_null());
    users.add_field(Field::new("name", FieldType::Text).not_null());
    users.add_field(Field::new("created_at", FieldType::Timestamp));
    state.schema.tables.push(users);

    // 3. Добавить таблицу products
    let mut products = Table::new("products");
    products.add_field(Field::new("id", FieldType::Uuid).primary_key());
    products.add_field(Field::new("name", FieldType::Text).not_null());
    products.add_field(Field::new("price", FieldType::Float).not_null());
    state.schema.tables.push(products);

    // 4. Сохранить
    manager.save_project(&state).unwrap();

    // 5. Загрузить и проверить
    let loaded = manager.load_project("e-commerce").unwrap();
    assert_eq!(loaded.schema.tables.len(), 2);
    assert_eq!(loaded.schema.tables[0].name, "users");
    assert_eq!(loaded.schema.tables[0].fields.len(), 4);
    assert_eq!(loaded.schema.tables[1].name, "products");

    // 6. Проверить что project_state.json существует
    let state_file = dir.join("e-commerce").join("project_state.json");
    assert!(state_file.exists());

    // 7. Проверить что JSON валидный и читаемый вручную
    let raw = fs::read_to_string(state_file).unwrap();
    let parsed: serde_json::Value = serde_json::from_str(&raw).unwrap();
    assert_eq!(parsed["meta"]["name"], "e-commerce");
    assert_eq!(parsed["schema"]["tables"].as_array().unwrap().len(), 2);

    fs::remove_dir_all(dir).ok();
}

#[test]
fn test_list_projects_reflects_disk() {
    let dir = temp_dir();
    let manager = ProjectManager::new(&dir);

    assert_eq!(manager.list_projects().unwrap().len(), 0);

    manager.create_project("alpha", "").unwrap();
    manager.create_project("beta", "").unwrap();

    let mut projects = manager.list_projects().unwrap();
    projects.sort();
    assert_eq!(projects.len(), 2);
    assert_eq!(projects[0], "alpha");
    assert_eq!(projects[1], "beta");

    fs::remove_dir_all(dir).ok();
}

#[test]
fn test_update_project_persists() {
    let dir = temp_dir();
    let manager = ProjectManager::new(&dir);

    let mut state = manager.create_project("shop", "online shop").unwrap();

    // Add a table and save again (simulate update)
    let mut orders = Table::new("orders");
    orders.add_field(Field::new("id", FieldType::Uuid).primary_key());
    orders.add_field(Field::new("total", FieldType::Float).not_null());
    state.schema.tables.push(orders);
    manager.save_project(&state).unwrap();

    let reloaded = manager.load_project("shop").unwrap();
    assert_eq!(reloaded.schema.tables.len(), 1);
    assert_eq!(reloaded.schema.tables[0].name, "orders");
    assert_eq!(reloaded.schema.tables[0].fields.len(), 2);

    fs::remove_dir_all(dir).ok();
}

#[test]
fn test_duplicate_project_create_fails() {
    let dir = temp_dir();
    let manager = ProjectManager::new(&dir);

    manager.create_project("duplicate", "").unwrap();
    assert!(manager.create_project("duplicate", "").is_err());

    fs::remove_dir_all(dir).ok();
}

#[test]
fn test_load_nonexistent_project_fails() {
    let dir = temp_dir();
    let manager = ProjectManager::new(&dir);
    assert!(manager.load_project("does-not-exist").is_err());
    fs::remove_dir_all(dir).ok();
}

#[test]
fn test_project_state_json_roundtrip() {
    let dir = temp_dir();
    let manager = ProjectManager::new(&dir);

    let mut state = manager.create_project("roundtrip", "test").unwrap();
    let mut t = Table::new("items");
    t.add_field(Field::new("id", FieldType::Uuid).primary_key());
    let mut label_field = Field::new("label", FieldType::Text).not_null();
    label_field.unique = true;
    t.add_field(label_field);
    t.add_field(Field::new("count", FieldType::Integer));
    state.schema.tables.push(t);
    manager.save_project(&state).unwrap();

    // Deserialize manually from JSON
    let path = dir.join("roundtrip").join("project_state.json");
    let raw = fs::read_to_string(&path).unwrap();
    let parsed: serde_json::Value = serde_json::from_str(&raw).unwrap();

    let fields = parsed["schema"]["tables"][0]["fields"].as_array().unwrap();
    assert_eq!(fields.len(), 3);
    assert_eq!(fields[0]["name"], "id");
    assert_eq!(fields[0]["primary_key"], true);
    assert_eq!(fields[1]["name"], "label");
    assert_eq!(fields[1]["unique"], true);
    assert_eq!(fields[1]["nullable"], false);
    assert_eq!(fields[2]["name"], "count");

    fs::remove_dir_all(dir).ok();
}

