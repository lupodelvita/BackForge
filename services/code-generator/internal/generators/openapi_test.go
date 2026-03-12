package generators_test

import (
	"strings"
	"testing"

	"github.com/backforge/code-generator/internal/generators"
	"github.com/backforge/code-generator/internal/schema"
)

// ---- OpenAPI Generator Tests ----

func TestGenerateOpenAPI_ContainsOpenAPIVersion(t *testing.T) {
	state := makeState(makeTable("users", field("id", schema.FieldTypeUUID, true, false)))
	out, err := generators.GenerateOpenAPI(state)
	if err != nil {
		t.Fatal(err)
	}
	if !strings.Contains(out, "openapi: 3.0.3") {
		t.Errorf("missing openapi version:\n%s", out)
	}
}

func TestGenerateOpenAPI_ContainsProjectTitle(t *testing.T) {
	state := &schema.ProjectState{
		Meta:   schema.ProjectMeta{Name: "my-shop", Version: 1},
		Schema: schema.ProjectSchema{Tables: []schema.Table{makeTable("items", field("id", schema.FieldTypeUUID, true, false))}},
	}
	out, _ := generators.GenerateOpenAPI(state)
	if !strings.Contains(out, "my-shop") {
		t.Errorf("missing project name:\n%s", out)
	}
}

func TestGenerateOpenAPI_CollectionPathExists(t *testing.T) {
	state := makeState(makeTable("orders", field("id", schema.FieldTypeUUID, true, false)))
	out, _ := generators.GenerateOpenAPI(state)
	if !strings.Contains(out, "/orders") {
		t.Errorf("missing /orders path:\n%s", out)
	}
}

func TestGenerateOpenAPI_ItemPathExists(t *testing.T) {
	state := makeState(makeTable("orders", field("id", schema.FieldTypeUUID, true, false)))
	out, _ := generators.GenerateOpenAPI(state)
	if !strings.Contains(out, "/orders/{id}") {
		t.Errorf("missing /orders/{id} path:\n%s", out)
	}
}

func TestGenerateOpenAPI_SchemaComponentGenerated(t *testing.T) {
	state := makeState(makeTable("products",
		field("id", schema.FieldTypeUUID, true, false),
		field("price", schema.FieldTypeFloat, false, false),
	))
	out, _ := generators.GenerateOpenAPI(state)
	if !strings.Contains(out, "Product:") {
		t.Errorf("missing Product schema component:\n%s", out)
	}
}

func TestGenerateOpenAPI_FieldTypesMapping(t *testing.T) {
	state := makeState(makeTable("items",
		field("id", schema.FieldTypeUUID, true, false),
		field("count", schema.FieldTypeInteger, false, false),
		field("active", schema.FieldTypeBoolean, false, false),
		field("score", schema.FieldTypeFloat, false, false),
	))
	out, _ := generators.GenerateOpenAPI(state)
	for _, expected := range []string{"uuid", "integer", "boolean", "number"} {
		if !strings.Contains(out, expected) {
			t.Errorf("missing OpenAPI type %q:\n%s", expected, out)
		}
	}
}

func TestGenerateOpenAPI_EmptySchema(t *testing.T) {
	state := makeState()
	out, err := generators.GenerateOpenAPI(state)
	if err != nil {
		t.Fatal(err)
	}
	if !strings.Contains(out, "openapi: 3.0.3") {
		t.Error("empty schema should still produce valid OpenAPI header")
	}
}

func TestGenerateOpenAPI_CustomPKInPath(t *testing.T) {
	state := makeState(makeTable("invoices",
		field("invoice_id", schema.FieldTypeUUID, true, false),
		field("amount", schema.FieldTypeFloat, false, false),
	))
	out, _ := generators.GenerateOpenAPI(state)
	if !strings.Contains(out, "{invoice_id}") {
		t.Errorf("expected {invoice_id} in path:\n%s", out)
	}
}

func TestGenerateOpenAPI_OperationIDsPresent(t *testing.T) {
	state := makeState(makeTable("posts", field("id", schema.FieldTypeUUID, true, false)))
	out, _ := generators.GenerateOpenAPI(state)
	for _, opID := range []string{"listPosts", "createPost", "getPost", "updatePost", "deletePost"} {
		if !strings.Contains(out, opID) {
			t.Errorf("missing operationId %s:\n%s", opID, out)
		}
	}
}
