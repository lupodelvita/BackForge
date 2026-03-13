package handlers

import (
	"context"
	"encoding/json"
	"fmt"
	"net/http"
	"os"
	"time"

	"github.com/backforge/deployment/internal/deploy"
	"github.com/backforge/deployment/internal/state"
	tmpl "github.com/backforge/deployment/internal/template"
	"github.com/backforge/deployment/internal/store"
	"github.com/go-chi/chi/v5"
)

// DeploymentHandler wires together store, deployer registry, and project lookup.
type DeploymentHandler struct {
	Store        *store.Store
	Deployers    map[string]deploy.Deployer // target → Deployer
	ProjectsRoot string
}

type createRequest struct {
	ProjectName string `json:"project_name"`
	Target      string `json:"target"` // "local", "cloud", "edge"
	Port        int    `json:"port"`
}

func writeJSON(w http.ResponseWriter, status int, v interface{}) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(status)
	json.NewEncoder(w).Encode(v)
}

func writeError(w http.ResponseWriter, status int, msg string) {
	writeJSON(w, status, map[string]string{"error": msg})
}

// POST /deployments
func (h *DeploymentHandler) Create(w http.ResponseWriter, r *http.Request) {
	var req createRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		writeError(w, http.StatusBadRequest, "invalid request body")
		return
	}
	if req.ProjectName == "" {
		writeError(w, http.StatusBadRequest, "project_name is required")
		return
	}
	if req.Target == "" {
		req.Target = "local"
	}
	if req.Port == 0 {
		req.Port = 3000
	}
	if req.Target != "local" && req.Target != "cloud" && req.Target != "edge" {
		writeError(w, http.StatusBadRequest, "target must be 'local', 'cloud', or 'edge'")
		return
	}

	// Build the target deployer
	deployer, ok := h.Deployers[req.Target]
	if !ok {
		writeError(w, http.StatusBadRequest, fmt.Sprintf("target '%s' is not available in this environment", req.Target))
		return
	}

	// Load project_state.json
	statePath := fmt.Sprintf("%s/%s/project_state.json", h.ProjectsRoot, req.ProjectName)
	rawState, err := os.ReadFile(statePath)
	if err != nil {
		writeError(w, http.StatusNotFound, fmt.Sprintf("project '%s' not found", req.ProjectName))
		return
	}
	var ps state.ProjectState
	if err := json.Unmarshal(rawState, &ps); err != nil {
		writeError(w, http.StatusInternalServerError, "invalid project_state.json")
		return
	}

	// Create deployment record
	record := &deploy.DeploymentRecord{
		ID:          newID(),
		ProjectName: req.ProjectName,
		Target:      req.Target,
		Status:      deploy.StatusPending,
		Port:        req.Port,
		CreatedAt:   time.Now().UTC(),
		UpdatedAt:   time.Now().UTC(),
	}
	if err := h.Store.Save(record); err != nil {
		writeError(w, http.StatusInternalServerError, "failed to save deployment record")
		return
	}

	// Generate build context and deploy asynchronously
	buildCtx, err := tmpl.GenerateBuildContext(&ps, rawState, req.Target, req.Port)
	if err != nil {
		record.Status = deploy.StatusFailed
		record.Error = err.Error()
		h.Store.Save(record)
		writeError(w, http.StatusInternalServerError, "failed to generate build context")
		return
	}

	go func() {
		defer os.RemoveAll(buildCtx.Dir)
		ctx, cancel := context.WithTimeout(context.Background(), 10*time.Minute)
		defer cancel()

		if err := deployer.Deploy(ctx, record, buildCtx.Dir); err != nil {
			record.Status = deploy.StatusFailed
			if record.Error == "" {
				record.Error = err.Error()
			}
		}
		h.Store.Save(record)
	}()

	writeJSON(w, http.StatusAccepted, record)
}

// GET /deployments
func (h *DeploymentHandler) List(w http.ResponseWriter, r *http.Request) {
	records, err := h.Store.List()
	if err != nil {
		writeError(w, http.StatusInternalServerError, err.Error())
		return
	}
	if records == nil {
		records = []*deploy.DeploymentRecord{}
	}
	writeJSON(w, http.StatusOK, records)
}

// GET /deployments/{id}
func (h *DeploymentHandler) Get(w http.ResponseWriter, r *http.Request) {
	id := chi.URLParam(r, "id")
	record, err := h.Store.Load(id)
	if err != nil {
		writeError(w, http.StatusNotFound, fmt.Sprintf("deployment '%s' not found", id))
		return
	}
	writeJSON(w, http.StatusOK, record)
}

// DELETE /deployments/{id}
func (h *DeploymentHandler) Delete(w http.ResponseWriter, r *http.Request) {
	id := chi.URLParam(r, "id")
	record, err := h.Store.Load(id)
	if err != nil {
		writeError(w, http.StatusNotFound, fmt.Sprintf("deployment '%s' not found", id))
		return
	}

	if record.Status == deploy.StatusRunning {
		deployer, ok := h.Deployers[record.Target]
		if !ok {
			writeError(w, http.StatusInternalServerError, fmt.Sprintf("no deployer for target '%s'", record.Target))
			return
		}
		ctx, cancel := context.WithTimeout(r.Context(), 30*time.Second)
		defer cancel()
		if err := deployer.Stop(ctx, record); err != nil {
			writeError(w, http.StatusInternalServerError, fmt.Sprintf("failed to stop deployment: %v", err))
			return
		}
		h.Store.Save(record)
	}

	if err := h.Store.Delete(id); err != nil {
		writeError(w, http.StatusInternalServerError, "failed to delete record")
		return
	}
	w.WriteHeader(http.StatusNoContent)
}

// GET /deployments/{id}/dockerfile — preview generated Dockerfile
func (h *DeploymentHandler) PreviewDockerfile(w http.ResponseWriter, r *http.Request) {
	id := chi.URLParam(r, "id")
	record, err := h.Store.Load(id)
	if err != nil {
		writeError(w, http.StatusNotFound, fmt.Sprintf("deployment '%s' not found", id))
		return
	}
	content, err := tmpl.RenderDockerfile(record.ProjectName, record.Target, record.Port)
	if err != nil {
		writeError(w, http.StatusInternalServerError, "failed to render Dockerfile")
		return
	}
	w.Header().Set("Content-Type", "text/plain; charset=utf-8")
	w.WriteHeader(http.StatusOK)
	w.Write([]byte(content))
}

// newID generates a simple time-based ID (no external deps).
func newID() string {
	return fmt.Sprintf("%d", time.Now().UnixNano())
}
