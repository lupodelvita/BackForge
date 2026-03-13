package handlers

import (
	"encoding/json"
	"net/http"

	"github.com/backforge/code-generator/internal/generators"
	"github.com/backforge/code-generator/internal/validators"
)

// ValidateResponse is returned by POST /generate/validate.
type ValidateResponse struct {
	Report validators.ValidationReport `json:"report"`
	Files  map[string]string           `json:"files"`
}

// GenerateValidate handles POST /generate/validate.
// It generates all artifacts for the given ProjectState and then runs every
// validator, returning both the artefacts and the CI report in a single call.
func GenerateValidate(w http.ResponseWriter, r *http.Request) {
	var req GenerateRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		errorJSON(w, http.StatusBadRequest, "invalid JSON: "+err.Error())
		return
	}
	if req.State.Meta.Name == "" {
		errorJSON(w, http.StatusBadRequest, "state.meta.name is required")
		return
	}

	// ── generate all artefacts ─────────────────────────────────────────────
	files := make(map[string]string)
	for k, v := range generators.GenerateSQL(&req.State) {
		files[k] = v
	}
	for k, v := range generators.GenerateHandlers(&req.State) {
		files[k] = v
	}
	for k, v := range generators.GenerateQueries(&req.State) {
		files[k] = v
	}
	files["router.go"] = generators.GenerateRouter(&req.State)

	spec, err := generators.GenerateOpenAPI(&req.State)
	if err != nil {
		errorJSON(w, http.StatusInternalServerError, "openapi generation failed: "+err.Error())
		return
	}
	files["openapi.yaml"] = spec

	// ── validate ───────────────────────────────────────────────────────────
	report := validators.RunAll(req.State.Meta.Name, files)

	status := http.StatusOK
	if !report.Valid {
		status = http.StatusUnprocessableEntity
	}
	writeJSON(w, status, ValidateResponse{Report: report, Files: files})
}
