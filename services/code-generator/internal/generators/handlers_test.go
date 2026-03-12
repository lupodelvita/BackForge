package generators_test

import (
	"strings"
	"testing"

	"github.com/backforge/code-generator/internal/generators"
	"github.com/backforge/code-generator/internal/schema"
)

// ---- Handlers Generator Tests ----

func TestGenerateHandlers_CreatesFilePerTable(t *testing.T) {
	state := makeState(
		makeTable("users", field("id", schema.FieldTypeUUID, true, false)),
		makeTable("posts", field("id", schema.FieldTypeUUID, true, false)),
	)
	files := generators.GenerateHandlers(state)
	if _, ok := files["users_handler.go"]; !ok {
		t.Error("expected users_handler.go")
	}
	if _, ok := files["posts_handler.go"]; !ok {
		t.Error("expected posts_handler.go")
	}
}

func TestGenerateHandlers_ContainsCRUDFunctions(t *testing.T) {
	state := makeState(makeTable("users",
		field("id", schema.FieldTypeUUID, true, false),
		field("name", schema.FieldTypeText, false, false),
	))
	files := generators.GenerateHandlers(state)
	src := files["users_handler.go"]

	for _, fn := range []string{"ListUsers", "GetUsers", "CreateUsers", "UpdateUsers", "DeleteUsers"} {
		if !strings.Contains(src, fn) {
			t.Errorf("missing function %s", fn)
		}
	}
}

func TestGenerateHandlers_TypeStructDefined(t *testing.T) {
	state := makeState(makeTable("products",
		field("id", schema.FieldTypeUUID, true, false),
		field("price", schema.FieldTypeFloat, false, false),
	))
	files := generators.GenerateHandlers(state)
	src := files["products_handler.go"]

	if !strings.Contains(src, "type Product struct") {
		t.Errorf("missing Product struct:\n%s", src)
	}
	if !strings.Contains(src, "Price float64") {
		t.Errorf("missing Price field:\n%s", src)
	}
}

func TestGenerateHandlers_NullableFieldUsesPointer(t *testing.T) {
	state := makeState(makeTable("articles",
		field("id", schema.FieldTypeUUID, true, false),
		field("subtitle", schema.FieldTypeText, false, true), // nullable
	))
	files := generators.GenerateHandlers(state)
	src := files["articles_handler.go"]
	if !strings.Contains(src, "*string") {
		t.Errorf("nullable text field should use *string:\n%s", src)
	}
}

func TestGenerateHandlers_EmptySchema(t *testing.T) {
	state := makeState()
	files := generators.GenerateHandlers(state)
	if len(files) != 0 {
		t.Errorf("expected 0 handler files for empty schema, got %d", len(files))
	}
}

func TestGenerateHandlers_PKUsedInURLParam(t *testing.T) {
	state := makeState(makeTable("orders",
		field("order_id", schema.FieldTypeUUID, true, false),
		field("amount", schema.FieldTypeFloat, false, false),
	))
	files := generators.GenerateHandlers(state)
	src := files["orders_handler.go"]
	if !strings.Contains(src, `chi.URLParam(r, "order_id")`) {
		t.Errorf("expected order_id as URL param:\n%s", src)
	}
}

// ---- Router Generator Tests ----

func TestGenerateRouter_RegistersAllTables(t *testing.T) {
	state := makeState(
		makeTable("users", field("id", schema.FieldTypeUUID, true, false)),
		makeTable("comments", field("id", schema.FieldTypeUUID, true, false)),
	)
	src := generators.GenerateRouter(state)
	for _, route := range []string{"/users", "/comments"} {
		if !strings.Contains(src, route) {
			t.Errorf("missing route %s in router:\n%s", route, src)
		}
	}
}

func TestGenerateRouter_ContainsChiRouter(t *testing.T) {
	state := makeState(makeTable("items", field("id", schema.FieldTypeUUID, true, false)))
	src := generators.GenerateRouter(state)
	if !strings.Contains(src, "chi.NewRouter()") {
		t.Errorf("missing chi.NewRouter():\n%s", src)
	}
}
