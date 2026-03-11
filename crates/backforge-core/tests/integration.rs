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
