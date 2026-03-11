use serde::{Deserialize, Serialize};
use uuid::Uuid;

/// Тип поля таблицы
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "snake_case")]
pub enum FieldType {
    Text,
    Integer,
    BigInt,
    Float,
    Boolean,
    Uuid,
    Timestamp,
    Json,
    Bytes,
}

/// Одно поле таблицы
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Field {
    pub id: Uuid,
    pub name: String,
    pub field_type: FieldType,
    pub nullable: bool,
    pub unique: bool,
    pub primary_key: bool,
    pub default_value: Option<String>,
}

impl Field {
    pub fn new(name: impl Into<String>, field_type: FieldType) -> Self {
        Self {
            id: Uuid::new_v4(),
            name: name.into(),
            field_type,
            nullable: true,
            unique: false,
            primary_key: false,
            default_value: None,
        }
    }

    pub fn primary_key(mut self) -> Self {
        self.primary_key = true;
        self.nullable = false;
        self
    }

    pub fn not_null(mut self) -> Self {
        self.nullable = false;
        self
    }
}

/// Таблица в схеме
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Table {
    pub id: Uuid,
    pub name: String,
    pub fields: Vec<Field>,
    pub indexes: Vec<Index>,
}

impl Table {
    pub fn new(name: impl Into<String>) -> Self {
        Self {
            id: Uuid::new_v4(),
            name: name.into(),
            fields: Vec::new(),
            indexes: Vec::new(),
        }
    }

    pub fn add_field(&mut self, field: Field) -> &mut Self {
        self.fields.push(field);
        self
    }
}

/// Индекс таблицы
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Index {
    pub id: Uuid,
    pub name: String,
    pub fields: Vec<String>,
    pub unique: bool,
}

/// Вся схема проекта (все таблицы)
#[derive(Debug, Clone, Serialize, Deserialize, Default)]
pub struct ProjectSchema {
    pub tables: Vec<Table>,
}
