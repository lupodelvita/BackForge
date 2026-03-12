package template

import (
	"encoding/json"
	"os"
	"path/filepath"
	"strings"
	"testing"

	"github.com/backforge/deployment/internal/state"
)

func makeTestState(name string, tables ...string) *state.ProjectState {
	ts := make([]state.Table, len(tables))
	for i, t := range tables {
		ts[i] = state.Table{ID: "id-" + t, Name: t}
	}
	return &state.ProjectState{
		Meta:   state.ProjectMeta{ID: "uuid-1", Name: name, Version: 1},
		Schema: state.ProjectSchema{Tables: ts},
	}
}

func TestRenderDockerfile_ContainsProjectName(t *testing.T) {
	out, err := RenderDockerfile("shop", "local", 3000)
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if !strings.Contains(out, "shop") {
		t.Errorf("Dockerfile does not contain project name 'shop'\n%s", out)
	}
	if !strings.Contains(out, "3000") {
		t.Errorf("Dockerfile does not contain port 3000\n%s", out)
	}
	if !strings.Contains(out, "EXPOSE 3000") {
		t.Errorf("Dockerfile missing EXPOSE directive\n%s", out)
	}
}

func TestRenderDockerfile_ContainsTarget(t *testing.T) {
	out, err := RenderDockerfile("myapp", "local", 4000)
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if !strings.Contains(out, "local") {
		t.Errorf("Dockerfile does not contain target 'local'\n%s", out)
	}
}

func TestServerGoSource_IsValidGo(t *testing.T) {
	// Just verify it contains key identifiers
	if !strings.Contains(serverGoSource, "package main") {
		t.Error("server.go missing 'package main'")
	}
	if !strings.Contains(serverGoSource, "http.ListenAndServe") {
		t.Error("server.go missing ListenAndServe")
	}
	if !strings.Contains(serverGoSource, "/health") {
		t.Error("server.go missing /health endpoint")
	}
}

func TestGenerateBuildContext_CreatesFiles(t *testing.T) {
	ps := makeTestState("acme", "users", "products")
	raw, _ := json.Marshal(ps)

	ctx, err := GenerateBuildContext(ps, raw, "local", 3000)
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	defer os.RemoveAll(ctx.Dir)

	for _, name := range []string{"Dockerfile", "server.go", "project_state.json"} {
		path := filepath.Join(ctx.Dir, name)
		if _, err := os.Stat(path); os.IsNotExist(err) {
			t.Errorf("expected file %s to exist in build context", name)
		}
	}
}

func TestGenerateBuildContext_DockerfileContainsProjectName(t *testing.T) {
	ps := makeTestState("inventory")
	raw, _ := json.Marshal(ps)

	ctx, err := GenerateBuildContext(ps, raw, "local", 8080)
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	defer os.RemoveAll(ctx.Dir)

	content, err := os.ReadFile(filepath.Join(ctx.Dir, "Dockerfile"))
	if err != nil {
		t.Fatalf("read Dockerfile: %v", err)
	}
	if !strings.Contains(string(content), "inventory") {
		t.Errorf("generated Dockerfile missing project name:\n%s", content)
	}
}
