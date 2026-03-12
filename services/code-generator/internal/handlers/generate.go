package handlers

import (
	"encoding/json"
	"net/http"

	"github.com/backforge/code-generator/internal/generators"
	"github.com/backforge/code-generator/internal/schema"
)

// GenerateRequest is the request body for all /generate/* endpoints.
type GenerateRequest struct {
	State schema.ProjectState `json:"state"`
}

// GenerateFilesResponse contains a map of filename → file content.
type GenerateFilesResponse struct {
	Files map[string]string `json:"files"`
}

// GenerateSQL handles POST /generate/sql
// Body: { "state": <ProjectState JSON> }
// Returns: { "files": { "001_create_users.sql": "...", ... } }
func GenerateSQL(w http.ResponseWriter, r *http.Request) {
	var req GenerateRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		errorJSON(w, http.StatusBadRequest, "invalid JSON: "+err.Error())
		return
	}
	if req.State.Meta.Name == "" {
		errorJSON(w, http.StatusBadRequest, "state.meta.name is required")
		return
	}
	files := generators.GenerateSQL(&req.State)
	writeJSON(w, http.StatusOK, GenerateFilesResponse{Files: files})
}

// GenerateHandlers handles POST /generate/handlers
// Returns Go source files: one handler per table + router.go
func GenerateHandlers(w http.ResponseWriter, r *http.Request) {
	var req GenerateRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		errorJSON(w, http.StatusBadRequest, "invalid JSON: "+err.Error())
		return
	}
	if req.State.Meta.Name == "" {
		errorJSON(w, http.StatusBadRequest, "state.meta.name is required")
		return
	}
	files := generators.GenerateHandlers(&req.State)
	files["router.go"] = generators.GenerateRouter(&req.State)
	writeJSON(w, http.StatusOK, GenerateFilesResponse{Files: files})
}

// GenerateOpenAPI handles POST /generate/openapi
// Returns { "files": { "openapi.yaml": "..." } }
func GenerateOpenAPI(w http.ResponseWriter, r *http.Request) {
	var req GenerateRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		errorJSON(w, http.StatusBadRequest, "invalid JSON: "+err.Error())
		return
	}
	if req.State.Meta.Name == "" {
		errorJSON(w, http.StatusBadRequest, "state.meta.name is required")
		return
	}
	spec, err := generators.GenerateOpenAPI(&req.State)
	if err != nil {
		errorJSON(w, http.StatusInternalServerError, "generation failed: "+err.Error())
		return
	}
	writeJSON(w, http.StatusOK, GenerateFilesResponse{Files: map[string]string{
		"openapi.yaml": spec,
	}})
}

// GenerateAll handles POST /generate/all
// Returns SQL + Go handlers + OpenAPI in one call.
func GenerateAll(w http.ResponseWriter, r *http.Request) {
	var req GenerateRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		errorJSON(w, http.StatusBadRequest, "invalid JSON: "+err.Error())
		return
	}
	if req.State.Meta.Name == "" {
		errorJSON(w, http.StatusBadRequest, "state.meta.name is required")
		return
	}

	files := make(map[string]string)

	for k, v := range generators.GenerateSQL(&req.State) {
		files[k] = v
	}
	for k, v := range generators.GenerateHandlers(&req.State) {
		files[k] = v
	}
	files["router.go"] = generators.GenerateRouter(&req.State)

	spec, err := generators.GenerateOpenAPI(&req.State)
	if err != nil {
		errorJSON(w, http.StatusInternalServerError, "openapi generation failed: "+err.Error())
		return
	}
	files["openapi.yaml"] = spec

	writeJSON(w, http.StatusOK, GenerateFilesResponse{Files: files})
}

func writeJSON(w http.ResponseWriter, status int, v any) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(status)
	_ = json.NewEncoder(w).Encode(v)
}

func errorJSON(w http.ResponseWriter, status int, msg string) {
	writeJSON(w, status, map[string]string{"error": msg})
}
