package generators_test

import (
	"strings"
	"testing"

	"github.com/backforge/code-generator/internal/generators"
	"github.com/backforge/code-generator/internal/schema"
)

func usersTableForQueries() schema.Table {
	return schema.Table{
		Name: "users",
		Fields: []schema.Field{
			{Name: "id", FieldType: schema.FieldTypeUUID, PrimaryKey: true},
			{Name: "email", FieldType: schema.FieldTypeText, Nullable: false},
			{Name: "name", FieldType: schema.FieldTypeText, Nullable: true},
		},
	}
}

func TestGenerateQueries_FileExists(t *testing.T) {
	state := &schema.ProjectState{
		Meta:   schema.ProjectMeta{Name: "myapp"},
		Schema: schema.ProjectSchema{Tables: []schema.Table{usersTableForQueries()}},
	}
	files := generators.GenerateQueries(state)
	if _, ok := files["users_queries.go"]; !ok {
		t.Error("expected users_queries.go in output")
	}
}

func TestGenerateQueries_SelectAll(t *testing.T) {
	state := &schema.ProjectState{
		Meta:   schema.ProjectMeta{Name: "myapp"},
		Schema: schema.ProjectSchema{Tables: []schema.Table{usersTableForQueries()}},
	}
	src := generators.GenerateQueries(state)["users_queries.go"]

	if !strings.Contains(src, "SelectAllUsers") {
		t.Error("expected SelectAllUsers constant")
	}
	if !strings.Contains(src, "SELECT id, email, name FROM users") {
		t.Errorf("expected SELECT … FROM users, got:\n%s", src)
	}
}

func TestGenerateQueries_SelectByID_Parameterized(t *testing.T) {
	state := &schema.ProjectState{
		Meta:   schema.ProjectMeta{Name: "myapp"},
		Schema: schema.ProjectSchema{Tables: []schema.Table{usersTableForQueries()}},
	}
	src := generators.GenerateQueries(state)["users_queries.go"]

	if !strings.Contains(src, "SelectUsersByID") {
		t.Error("expected SelectUsersByID constant")
	}
	// Must use $1 — no string interpolation
	if !strings.Contains(src, "WHERE id = $1") {
		t.Errorf("expected 'WHERE id = $1', got:\n%s", src)
	}
}

func TestGenerateQueries_InsertParamCount(t *testing.T) {
	state := &schema.ProjectState{
		Meta:   schema.ProjectMeta{Name: "myapp"},
		Schema: schema.ProjectSchema{Tables: []schema.Table{usersTableForQueries()}},
	}
	src := generators.GenerateQueries(state)["users_queries.go"]

	// 2 data fields (email, name) → VALUES ($1, $2)
	if !strings.Contains(src, "VALUES ($1, $2)") {
		t.Errorf("expected 'VALUES ($1, $2)', got:\n%s", src)
	}
}

func TestGenerateQueries_UpdateWhereParam(t *testing.T) {
	state := &schema.ProjectState{
		Meta:   schema.ProjectMeta{Name: "myapp"},
		Schema: schema.ProjectSchema{Tables: []schema.Table{usersTableForQueries()}},
	}
	src := generators.GenerateQueries(state)["users_queries.go"]

	// 2 data fields → SET x=$1, y=$2 WHERE id=$3
	if !strings.Contains(src, "WHERE id = $3") {
		t.Errorf("expected 'WHERE id = $3' in UPDATE, got:\n%s", src)
	}
}

func TestGenerateQueries_Delete(t *testing.T) {
	state := &schema.ProjectState{
		Meta:   schema.ProjectMeta{Name: "myapp"},
		Schema: schema.ProjectSchema{Tables: []schema.Table{usersTableForQueries()}},
	}
	src := generators.GenerateQueries(state)["users_queries.go"]

	if !strings.Contains(src, "DeleteUsers") {
		t.Error("expected DeleteUsers constant")
	}
	if !strings.Contains(src, "DELETE FROM users WHERE id = $1") {
		t.Errorf("expected 'DELETE FROM users WHERE id = $1', got:\n%s", src)
	}
}

func TestGenerateQueries_NoPKOnly_NoInsertUpdate(t *testing.T) {
	// Table with only a primary key — no INSERT/UPDATE should be generated
	table := schema.Table{
		Name:   "counters",
		Fields: []schema.Field{{Name: "id", FieldType: schema.FieldTypeInteger, PrimaryKey: true}},
	}
	state := &schema.ProjectState{
		Meta:   schema.ProjectMeta{Name: "myapp"},
		Schema: schema.ProjectSchema{Tables: []schema.Table{table}},
	}
	src := generators.GenerateQueries(state)["counters_queries.go"]

	if strings.Contains(src, "InsertCounters") {
		t.Error("should not generate InsertCounters when there are no data fields")
	}
	// SELECT and DELETE must still be present
	if !strings.Contains(src, "SelectAllCounters") {
		t.Error("expected SelectAllCounters")
	}
	if !strings.Contains(src, "DeleteCounters") {
		t.Error("expected DeleteCounters")
	}
}

func TestGenerateQueries_NoStringInterpolation(t *testing.T) {
	// Security: verify the generated source never uses fmt.Sprintf or string
	// concatenation with user-controlled values inside the SQL constants.
	// The query strings must only contain backtick SQL with $N placeholders.
	state := &schema.ProjectState{
		Meta:   schema.ProjectMeta{Name: "myapp"},
		Schema: schema.ProjectSchema{Tables: []schema.Table{usersTableForQueries()}},
	}
	src := generators.GenerateQueries(state)["users_queries.go"]

	// The file should not contain "%s" or "%d" inside the SQL constant strings
	// (those would enable injection via Sprint formatting at runtime).
	if strings.Contains(src, `%s`) {
		t.Error("generated queries must not contain percent-s format verbs (SQL injection risk)")
	}
	if strings.Contains(src, `%d`) {
		t.Error("generated queries must not contain percent-d format verbs (SQL injection risk)")
	}
}
