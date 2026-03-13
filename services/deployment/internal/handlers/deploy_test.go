package handlers

import (
	"bytes"
	"context"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"os"
	"path/filepath"
	"strings"
	"testing"

	"github.com/backforge/deployment/internal/deploy"
	"github.com/backforge/deployment/internal/store"
	"github.com/go-chi/chi/v5"
)

// noopDeployer does nothing — used for handler tests that don't need docker.
type noopDeployer struct{ err error }

func (n *noopDeployer) Deploy(_ context.Context, record *deploy.DeploymentRecord, _ string) error {
	if n.err != nil {
		record.Status = deploy.StatusFailed
		record.Error = n.err.Error()
		return n.err
	}
	record.Status = deploy.StatusRunning
	record.ContainerID = "mock-container"
	record.URL = "http://localhost:3000"
	return nil
}

func (n *noopDeployer) Stop(_ context.Context, record *deploy.DeploymentRecord) error {
	record.Status = deploy.StatusStopped
	return n.err
}

// chiParam injects chi URL params into a request.
func chiParam(req *http.Request, key, val string) *http.Request {
	rctx := chi.NewRouteContext()
	rctx.URLParams.Add(key, val)
	return req.WithContext(context.WithValue(req.Context(), chi.RouteCtxKey, rctx))
}

// makeHandler creates a DeploymentHandler with a temp store and temp project dir.
func makeHandler(t *testing.T, d deploy.Deployer) (*DeploymentHandler, string) {
	t.Helper()
	storeDir := t.TempDir()
	projectsRoot := t.TempDir()
	return &DeploymentHandler{
		Store: store.New(storeDir),
		Deployers: map[string]deploy.Deployer{
			"local": d,
			"cloud": d,
			"edge":  d,
		},
		ProjectsRoot: projectsRoot,
	}, projectsRoot
}

func writeProjectState(t *testing.T, projectsRoot, project string) {
	t.Helper()
	dir := filepath.Join(projectsRoot, project)
	os.MkdirAll(dir, 0755)
	raw := `{"meta":{"id":"uuid-1","name":"` + project + `","description":"","version":1},"schema":{"tables":[]}}`
	os.WriteFile(filepath.Join(dir, "project_state.json"), []byte(raw), 0644)
}

func TestCreate_InvalidJSON(t *testing.T) {
	h, _ := makeHandler(t, &noopDeployer{})
	req := httptest.NewRequest(http.MethodPost, "/deployments", strings.NewReader("{bad json"))
	rr := httptest.NewRecorder()
	h.Create(rr, req)
	if rr.Code != http.StatusBadRequest {
		t.Errorf("expected 400, got %d", rr.Code)
	}
}

func TestCreate_MissingProjectName(t *testing.T) {
	h, _ := makeHandler(t, &noopDeployer{})
	body, _ := json.Marshal(map[string]interface{}{"target": "local"})
	req := httptest.NewRequest(http.MethodPost, "/deployments", bytes.NewReader(body))
	rr := httptest.NewRecorder()
	h.Create(rr, req)
	if rr.Code != http.StatusBadRequest {
		t.Errorf("expected 400, got %d: %s", rr.Code, rr.Body.String())
	}
}

func TestCreate_ProjectNotFound(t *testing.T) {
	h, _ := makeHandler(t, &noopDeployer{})
	body, _ := json.Marshal(map[string]interface{}{"project_name": "ghost", "target": "local"})
	req := httptest.NewRequest(http.MethodPost, "/deployments", bytes.NewReader(body))
	rr := httptest.NewRecorder()
	h.Create(rr, req)
	if rr.Code != http.StatusNotFound {
		t.Errorf("expected 404, got %d", rr.Code)
	}
}

func TestCreate_ReturnsAccepted(t *testing.T) {
	h, projectsRoot := makeHandler(t, &noopDeployer{})
	writeProjectState(t, projectsRoot, "shop")

	body, _ := json.Marshal(map[string]interface{}{"project_name": "shop", "target": "local", "port": 3000})
	req := httptest.NewRequest(http.MethodPost, "/deployments", bytes.NewReader(body))
	rr := httptest.NewRecorder()
	h.Create(rr, req)

	if rr.Code != http.StatusAccepted {
		t.Errorf("expected 202, got %d: %s", rr.Code, rr.Body.String())
	}
	var record deploy.DeploymentRecord
	json.NewDecoder(rr.Body).Decode(&record)
	if record.ID == "" {
		t.Error("expected non-empty deployment ID")
	}
	if record.ProjectName != "shop" {
		t.Errorf("expected project=shop, got %s", record.ProjectName)
	}
}

func TestList_EmptyStore(t *testing.T) {
	h, _ := makeHandler(t, &noopDeployer{})
	req := httptest.NewRequest(http.MethodGet, "/deployments", nil)
	rr := httptest.NewRecorder()
	h.List(rr, req)

	if rr.Code != http.StatusOK {
		t.Errorf("expected 200, got %d", rr.Code)
	}
	var records []deploy.DeploymentRecord
	json.NewDecoder(rr.Body).Decode(&records)
	if len(records) != 0 {
		t.Errorf("expected empty list, got %d", len(records))
	}
}

func TestGet_NotFound(t *testing.T) {
	h, _ := makeHandler(t, &noopDeployer{})
	req := httptest.NewRequest(http.MethodGet, "/deployments/nope", nil)
	req = chiParam(req, "id", "nope")
	rr := httptest.NewRecorder()
	h.Get(rr, req)

	if rr.Code != http.StatusNotFound {
		t.Errorf("expected 404, got %d", rr.Code)
	}
}

func TestDelete_NotFound(t *testing.T) {
	h, _ := makeHandler(t, &noopDeployer{})
	req := httptest.NewRequest(http.MethodDelete, "/deployments/nope", nil)
	req = chiParam(req, "id", "nope")
	rr := httptest.NewRecorder()
	h.Delete(rr, req)

	if rr.Code != http.StatusNotFound {
		t.Errorf("expected 404, got %d", rr.Code)
	}
}

func TestPreviewDockerfile_NotFound(t *testing.T) {
	h, _ := makeHandler(t, &noopDeployer{})
	req := httptest.NewRequest(http.MethodGet, "/deployments/nope/dockerfile", nil)
	req = chiParam(req, "id", "nope")
	rr := httptest.NewRecorder()
	h.PreviewDockerfile(rr, req)

	if rr.Code != http.StatusNotFound {
		t.Errorf("expected 404, got %d", rr.Code)
	}
}
