package generators_test

import (
	"strings"
	"testing"

	"github.com/backforge/code-generator/internal/generators"
	"github.com/backforge/code-generator/internal/schema"
)

func makeState(tables ...schema.Table) *schema.ProjectState {
	return &schema.ProjectState{
		Meta:   schema.ProjectMeta{Name: "testproj", Version: 1},
		Schema: schema.ProjectSchema{Tables: tables},
	}
}

func makeTable(name string, fields ...schema.Field) schema.Table {
	return schema.Table{ID: "t1", Name: name, Fields: fields}
}

func field(name string, ft schema.FieldType, pk, nullable bool) schema.Field {
	return schema.Field{ID: "f1", Name: name, FieldType: ft, PrimaryKey: pk, Nullable: nullable}
}

// ---- SQL Generator Tests ----

func TestGenerateSQL_BasicTable(t *testing.T) {
	state := makeState(makeTable("users",
		field("id", schema.FieldTypeUUID, true, false),
		field("name", schema.FieldTypeText, false, false),
	))
	files := generators.GenerateSQL(state)
	sql, ok := files["001_create_users.sql"]
	if !ok {
		t.Fatal("expected 001_create_users.sql")
	}
	if !strings.Contains(sql, "CREATE TABLE IF NOT EXISTS users") {
		t.Error("missing CREATE TABLE")
	}
	if !strings.Contains(sql, "id UUID PRIMARY KEY") {
		t.Errorf("missing PK column, got:\n%s", sql)
	}
	if !strings.Contains(sql, "name TEXT NOT NULL") {
		t.Errorf("missing NOT NULL column, got:\n%s", sql)
	}
}

func TestGenerateSQL_NullableField(t *testing.T) {
	state := makeState(makeTable("posts",
		field("id", schema.FieldTypeUUID, true, false),
		field("body", schema.FieldTypeText, false, true),
	))
	files := generators.GenerateSQL(state)
	sql := files["001_create_posts.sql"]
	if strings.Contains(sql, "body TEXT NOT NULL") {
		t.Error("nullable field must not have NOT NULL")
	}
	if !strings.Contains(sql, "body TEXT") {
		t.Error("missing body column")
	}
}

func TestGenerateSQL_AllFieldTypes(t *testing.T) {
	types := []struct {
		ft  schema.FieldType
		pg  string
	}{
		{schema.FieldTypeText, "TEXT"},
		{schema.FieldTypeInteger, "INTEGER"},
		{schema.FieldTypeBigInt, "BIGINT"},
		{schema.FieldTypeFloat, "DOUBLE PRECISION"},
		{schema.FieldTypeBoolean, "BOOLEAN"},
		{schema.FieldTypeUUID, "UUID"},
		{schema.FieldTypeTimestamp, "TIMESTAMPTZ"},
		{schema.FieldTypeJSON, "JSONB"},
		{schema.FieldTypeBytes, "BYTEA"},
	}
	for _, tt := range types {
		state := makeState(makeTable("t", field("col", tt.ft, false, true)))
		files := generators.GenerateSQL(state)
		sql := files["001_create_t.sql"]
		if !strings.Contains(sql, tt.pg) {
			t.Errorf("field type %s: expected PG type %s in:\n%s", tt.ft, tt.pg, sql)
		}
	}
}

func TestGenerateSQL_WithIndex(t *testing.T) {
	table := schema.Table{
		ID:   "t1",
		Name: "orders",
		Fields: []schema.Field{
			field("id", schema.FieldTypeUUID, true, false),
			field("user_id", schema.FieldTypeUUID, false, false),
		},
		Indexes: []schema.Index{
			{ID: "i1", Name: "idx_orders_user_id", Fields: []string{"user_id"}, Unique: false},
		},
	}
	state := makeState(table)
	files := generators.GenerateSQL(state)
	sql := files["001_create_orders.sql"]
	if !strings.Contains(sql, "CREATE INDEX IF NOT EXISTS idx_orders_user_id ON orders (user_id)") {
		t.Errorf("missing index DDL:\n%s", sql)
	}
}

func TestGenerateSQL_UniqueIndex(t *testing.T) {
	table := schema.Table{
		ID:   "t1",
		Name: "emails",
		Fields: []schema.Field{
			field("id", schema.FieldTypeUUID, true, false),
			field("email", schema.FieldTypeText, false, false),
		},
		Indexes: []schema.Index{
			{ID: "i1", Name: "idx_emails_email", Fields: []string{"email"}, Unique: true},
		},
	}
	state := makeState(table)
	files := generators.GenerateSQL(state)
	sql := files["001_create_emails.sql"]
	if !strings.Contains(sql, "CREATE UNIQUE INDEX IF NOT EXISTS idx_emails_email") {
		t.Errorf("missing unique index:\n%s", sql)
	}
}

func TestGenerateSQL_MultipleTablesGetSequentialFiles(t *testing.T) {
	state := makeState(
		makeTable("users", field("id", schema.FieldTypeUUID, true, false)),
		makeTable("posts", field("id", schema.FieldTypeUUID, true, false)),
		makeTable("comments", field("id", schema.FieldTypeUUID, true, false)),
	)
	files := generators.GenerateSQL(state)
	for _, name := range []string{"001_create_users.sql", "002_create_posts.sql", "003_create_comments.sql"} {
		if _, ok := files[name]; !ok {
			t.Errorf("expected file %s", name)
		}
	}
}

func TestGenerateSQL_EmptySchema(t *testing.T) {
	state := makeState()
	files := generators.GenerateSQL(state)
	if len(files) != 0 {
		t.Errorf("expected 0 files for empty schema, got %d", len(files))
	}
}

func TestGenerateSQL_DefaultValue(t *testing.T) {
	defVal := "NOW()"
	table := schema.Table{
		ID:   "t1",
		Name: "events",
		Fields: []schema.Field{
			{ID: "f1", Name: "created_at", FieldType: schema.FieldTypeTimestamp, Nullable: false, DefaultValue: &defVal},
		},
	}
	state := makeState(table)
	files := generators.GenerateSQL(state)
	sql := files["001_create_events.sql"]
	if !strings.Contains(sql, "DEFAULT NOW()") {
		t.Errorf("missing default value:\n%s", sql)
	}
}
