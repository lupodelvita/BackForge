package handlers_test

import (
	"bytes"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"

	"github.com/backforge/code-generator/internal/handlers"
	"github.com/backforge/code-generator/internal/schema"
)

func makeReqBody(t *testing.T, state schema.ProjectState) *bytes.Buffer {
	t.Helper()
	b, err := json.Marshal(map[string]any{"state": state})
	if err != nil {
		t.Fatal(err)
	}
	return bytes.NewBuffer(b)
}

func simpleState() schema.ProjectState {
	return schema.ProjectState{
		Meta: schema.ProjectMeta{Name: "testapp", Version: 1},
		Schema: schema.ProjectSchema{
			Tables: []schema.Table{
				{
					ID:   "t1",
					Name: "users",
					Fields: []schema.Field{
						{ID: "f1", Name: "id", FieldType: schema.FieldTypeUUID, PrimaryKey: true, Nullable: false},
						{ID: "f2", Name: "email", FieldType: schema.FieldTypeText, Nullable: false},
					},
				},
			},
		},
	}
}

// ---- /generate/sql ----

func TestGenerateSQLHandler_Success(t *testing.T) {
	req := httptest.NewRequest(http.MethodPost, "/generate/sql", makeReqBody(t, simpleState()))
	w := httptest.NewRecorder()
	handlers.GenerateSQL(w, req)

	if w.Code != http.StatusOK {
		t.Fatalf("expected 200, got %d: %s", w.Code, w.Body.String())
	}
	var resp handlers.GenerateFilesResponse
	_ = json.NewDecoder(w.Body).Decode(&resp)
	if _, ok := resp.Files["001_create_users.sql"]; !ok {
		t.Errorf("missing SQL file in response: %+v", resp.Files)
	}
}

func TestGenerateSQLHandler_InvalidJSON(t *testing.T) {
	req := httptest.NewRequest(http.MethodPost, "/generate/sql", bytes.NewBufferString("{invalid"))
	w := httptest.NewRecorder()
	handlers.GenerateSQL(w, req)
	if w.Code != http.StatusBadRequest {
		t.Errorf("expected 400, got %d", w.Code)
	}
}

func TestGenerateSQLHandler_MissingName(t *testing.T) {
	state := schema.ProjectState{Meta: schema.ProjectMeta{Name: ""}}
	req := httptest.NewRequest(http.MethodPost, "/generate/sql", makeReqBody(t, state))
	w := httptest.NewRecorder()
	handlers.GenerateSQL(w, req)
	if w.Code != http.StatusBadRequest {
		t.Errorf("expected 400 for missing name, got %d", w.Code)
	}
}

// ---- /generate/handlers ----

func TestGenerateHandlersHandler_Success(t *testing.T) {
	req := httptest.NewRequest(http.MethodPost, "/generate/handlers", makeReqBody(t, simpleState()))
	w := httptest.NewRecorder()
	handlers.GenerateHandlers(w, req)

	if w.Code != http.StatusOK {
		t.Fatalf("expected 200, got %d: %s", w.Code, w.Body.String())
	}
	var resp handlers.GenerateFilesResponse
	_ = json.NewDecoder(w.Body).Decode(&resp)
	if _, ok := resp.Files["users_handler.go"]; !ok {
		t.Error("missing users_handler.go")
	}
	if _, ok := resp.Files["router.go"]; !ok {
		t.Error("missing router.go")
	}
}

func TestGenerateHandlersHandler_RouterContainsRoutes(t *testing.T) {
	req := httptest.NewRequest(http.MethodPost, "/generate/handlers", makeReqBody(t, simpleState()))
	w := httptest.NewRecorder()
	handlers.GenerateHandlers(w, req)

	var resp handlers.GenerateFilesResponse
	_ = json.NewDecoder(w.Body).Decode(&resp)
	router := resp.Files["router.go"]
	if !strings.Contains(router, "/users") {
		t.Errorf("router.go missing /users route:\n%s", router)
	}
}

func TestGenerateHandlersHandler_InvalidJSON(t *testing.T) {
	req := httptest.NewRequest(http.MethodPost, "/generate/handlers", bytes.NewBufferString("not json"))
	w := httptest.NewRecorder()
	handlers.GenerateHandlers(w, req)
	if w.Code != http.StatusBadRequest {
		t.Errorf("expected 400, got %d", w.Code)
	}
}

// ---- /generate/openapi ----

func TestGenerateOpenAPIHandler_Success(t *testing.T) {
	req := httptest.NewRequest(http.MethodPost, "/generate/openapi", makeReqBody(t, simpleState()))
	w := httptest.NewRecorder()
	handlers.GenerateOpenAPI(w, req)

	if w.Code != http.StatusOK {
		t.Fatalf("expected 200, got %d: %s", w.Code, w.Body.String())
	}
	var resp handlers.GenerateFilesResponse
	_ = json.NewDecoder(w.Body).Decode(&resp)
	yaml, ok := resp.Files["openapi.yaml"]
	if !ok {
		t.Fatal("missing openapi.yaml")
	}
	if !strings.Contains(yaml, "openapi: 3.0.3") {
		t.Errorf("openapi.yaml missing version header:\n%s", yaml)
	}
}

func TestGenerateOpenAPIHandler_InvalidJSON(t *testing.T) {
	req := httptest.NewRequest(http.MethodPost, "/generate/openapi", bytes.NewBufferString("{bad"))
	w := httptest.NewRecorder()
	handlers.GenerateOpenAPI(w, req)
	if w.Code != http.StatusBadRequest {
		t.Errorf("expected 400, got %d", w.Code)
	}
}

// ---- /generate/all ----

func TestGenerateAllHandler_Success(t *testing.T) {
	req := httptest.NewRequest(http.MethodPost, "/generate/all", makeReqBody(t, simpleState()))
	w := httptest.NewRecorder()
	handlers.GenerateAll(w, req)

	if w.Code != http.StatusOK {
		t.Fatalf("expected 200, got %d: %s", w.Code, w.Body.String())
	}
	var resp handlers.GenerateFilesResponse
	_ = json.NewDecoder(w.Body).Decode(&resp)

	for _, expected := range []string{"001_create_users.sql", "users_handler.go", "router.go", "openapi.yaml"} {
		if _, ok := resp.Files[expected]; !ok {
			t.Errorf("missing file %s in /generate/all response", expected)
		}
	}
}

func TestGenerateAllHandler_MultipleTablesAllFiles(t *testing.T) {
	state := schema.ProjectState{
		Meta: schema.ProjectMeta{Name: "shop", Version: 1},
		Schema: schema.ProjectSchema{
			Tables: []schema.Table{
				{ID: "t1", Name: "products", Fields: []schema.Field{{ID: "f1", Name: "id", FieldType: schema.FieldTypeUUID, PrimaryKey: true}}},
				{ID: "t2", Name: "orders", Fields: []schema.Field{{ID: "f2", Name: "id", FieldType: schema.FieldTypeUUID, PrimaryKey: true}}},
			},
		},
	}
	req := httptest.NewRequest(http.MethodPost, "/generate/all", makeReqBody(t, state))
	w := httptest.NewRecorder()
	handlers.GenerateAll(w, req)

	var resp handlers.GenerateFilesResponse
	_ = json.NewDecoder(w.Body).Decode(&resp)
	for _, f := range []string{
		"001_create_products.sql", "002_create_orders.sql",
		"products_handler.go", "orders_handler.go",
		"router.go", "openapi.yaml",
	} {
		if _, ok := resp.Files[f]; !ok {
			t.Errorf("missing file %s", f)
		}
	}
}

func TestGenerateAllHandler_InvalidJSON(t *testing.T) {
	req := httptest.NewRequest(http.MethodPost, "/generate/all", bytes.NewBufferString(""))
	w := httptest.NewRecorder()
	handlers.GenerateAll(w, req)
	if w.Code != http.StatusBadRequest {
		t.Errorf("expected 400, got %d", w.Code)
	}
}
