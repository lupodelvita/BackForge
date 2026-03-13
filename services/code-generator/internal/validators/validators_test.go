package validators

import (
	"strings"
	"testing"
)

// ─── openapi ──────────────────────────────────────────────────────────────────

var validOpenAPI = `
openapi: "3.0.3"
info:
  title: Test API
  version: "1.0.0"
paths:
  /users:
    get:
      operationId: listUsers
      responses:
        "200":
          description: ok
  /users/{id}:
    get:
      operationId: getUser
      responses:
        "200":
          description: ok
`

func TestValidateOpenAPI_Valid(t *testing.T) {
	results := ValidateOpenAPI(validOpenAPI)
	for _, r := range results {
		if !r.Passed {
			t.Errorf("expected check %q to pass, got: %s", r.Name, r.Message)
		}
	}
}

func TestValidateOpenAPI_MissingPaths(t *testing.T) {
	src := `
openapi: "3.0.3"
info:
  title: No Paths
  version: "1.0.0"
`
	results := ValidateOpenAPI(src)
	found := false
	for _, r := range results {
		if strings.Contains(r.Name, "paths") && !r.Passed {
			found = true
		}
	}
	if !found {
		t.Error("expected openapi:paths check to fail when paths is empty")
	}
}

func TestValidateOpenAPI_DuplicateOperationID(t *testing.T) {
	src := `
openapi: "3.0.3"
info:
  title: Dupe
  version: "1.0.0"
paths:
  /a:
    get:
      operationId: sameId
  /b:
    get:
      operationId: sameId
`
	results := ValidateOpenAPI(src)
	found := false
	for _, r := range results {
		if strings.Contains(r.Name, "operationId") && !r.Passed {
			found = true
		}
	}
	if !found {
		t.Error("expected operationId uniqueness check to fail on duplicates")
	}
}

func TestValidateOpenAPI_InvalidYAML(t *testing.T) {
	results := ValidateOpenAPI(": : :")
	if len(results) == 0 || results[0].Passed {
		t.Error("expected parse failure for invalid YAML")
	}
}

// ─── go syntax ───────────────────────────────────────────────────────────────

func TestValidateGoFiles_Valid(t *testing.T) {
	files := map[string]string{
		"main.go": `package main
import "fmt"
func main() { fmt.Println("hello") }`,
	}
	results := ValidateGoFiles(files)
	for _, r := range results {
		if !r.Passed {
			t.Errorf("expected %q to pass: %s", r.Name, r.Message)
		}
	}
}

func TestValidateGoFiles_SyntaxError(t *testing.T) {
	files := map[string]string{
		"bad.go": `package main
func main( { `,
	}
	results := ValidateGoFiles(files)
	found := false
	for _, r := range results {
		if strings.Contains(r.Name, "bad.go") && !r.Passed {
			found = true
		}
	}
	if !found {
		t.Error("expected syntax error to be detected in bad.go")
	}
}

func TestValidateGoFiles_SkipsNonGo(t *testing.T) {
	files := map[string]string{
		"schema.sql": "CREATE TABLE t (id TEXT PRIMARY KEY);",
	}
	results := ValidateGoFiles(files)
	if len(results) != 1 || results[0].Name != "go:syntax" || !results[0].Passed {
		t.Error("expected no-files pass check when no .go files provided")
	}
}

// ─── sql ──────────────────────────────────────────────────────────────────────

func TestValidateSQLFiles_Valid(t *testing.T) {
	files := map[string]string{
		"001_create.sql": "CREATE TABLE users (id UUID PRIMARY KEY, name TEXT NOT NULL);",
	}
	results := ValidateSQLFiles(files)
	for _, r := range results {
		if !r.Passed {
			t.Errorf("expected %q to pass: %s", r.Name, r.Message)
		}
	}
}

func TestValidateSQLFiles_Empty(t *testing.T) {
	files := map[string]string{"empty.sql": "   "}
	results := ValidateSQLFiles(files)
	found := false
	for _, r := range results {
		if strings.Contains(r.Name, "not-empty") && !r.Passed {
			found = true
		}
	}
	if !found {
		t.Error("expected not-empty check to fail on whitespace-only file")
	}
}

func TestValidateSQLFiles_UnsafeDrop(t *testing.T) {
	files := map[string]string{
		"drop.sql": "DROP TABLE users;",
	}
	results := ValidateSQLFiles(files)
	found := false
	for _, r := range results {
		if strings.Contains(r.Name, "safe-drop") && !r.Passed {
			found = true
		}
	}
	if !found {
		t.Error("expected safe-drop check to fail for DROP TABLE without IF EXISTS")
	}
}

func TestValidateSQLFiles_SafeDrop(t *testing.T) {
	files := map[string]string{
		"safe.sql": "DROP TABLE IF EXISTS users;",
	}
	results := ValidateSQLFiles(files)
	for _, r := range results {
		if strings.Contains(r.Name, "safe-drop") && !r.Passed {
			t.Errorf("expected safe-drop to pass but got: %s", r.Message)
		}
	}
}

// ─── runner ───────────────────────────────────────────────────────────────────

func TestRunAll_Valid(t *testing.T) {
	files := map[string]string{
		"001_users.sql": "CREATE TABLE users (id UUID PRIMARY KEY, name TEXT);",
		"handler.go": `package handlers
import "net/http"
func Get(w http.ResponseWriter, r *http.Request) {}`,
		"openapi.yaml": validOpenAPI,
	}
	report := RunAll("test-project", files)
	if !report.Valid {
		for _, c := range report.Checks {
			if !c.Passed {
				t.Logf("FAIL: %s — %s", c.Name, c.Message)
			}
		}
		t.Error("expected RunAll to return a valid report")
	}
	if report.Project != "test-project" {
		t.Errorf("unexpected project name: %s", report.Project)
	}
}

func TestRunAll_MissingOpenAPI(t *testing.T) {
	files := map[string]string{
		"001_users.sql": "CREATE TABLE users (id UUID PRIMARY KEY);",
	}
	report := RunAll("no-spec", files)
	if report.Valid {
		t.Error("expected report to be invalid when openapi.yaml is missing")
	}
}
