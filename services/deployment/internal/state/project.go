package state

import "time"

// ProjectState mirrors crates/backforge-core/src/project/state.rs
type ProjectState struct {
	Meta   ProjectMeta   `json:"meta"`
	Schema ProjectSchema `json:"schema"`
}

type ProjectMeta struct {
	ID          string    `json:"id"`
	Name        string    `json:"name"`
	Description string    `json:"description"`
	CreatedAt   time.Time `json:"created_at"`
	UpdatedAt   time.Time `json:"updated_at"`
	Version     int       `json:"version"`
}

type ProjectSchema struct {
	Tables []Table `json:"tables"`
}

type Table struct {
	ID     string  `json:"id"`
	Name   string  `json:"name"`
	Fields []Field `json:"fields"`
}

type Field struct {
	ID        string `json:"id"`
	Name      string `json:"name"`
	FieldType string `json:"field_type"`
	Nullable  bool   `json:"nullable"`
	Unique    bool   `json:"unique"`
	PrimaryKey bool  `json:"primary_key"`
}
