package handlers

import (
	"encoding/json"
	"net/http"
	"os"
	"path/filepath"
	"runtime"

	"github.com/go-chi/chi/v5"
)

// projectsRoot returns the platform-specific root directory for BackForge projects,
// mirroring the logic in the Rust CLI (dirs::data_local_dir).
func projectsRoot() string {
	if dir := os.Getenv("BACKFORGE_PROJECTS_DIR"); dir != "" {
		return dir
	}
	if runtime.GOOS == "windows" {
		if localAppData := os.Getenv("LOCALAPPDATA"); localAppData != "" {
			return filepath.Join(localAppData, "backforge", "projects")
		}
	}
	homeDir, _ := os.UserHomeDir()
	return filepath.Join(homeDir, ".local", "share", "backforge", "projects")
}

// ListProjects handles GET /projects
func ListProjects(w http.ResponseWriter, r *http.Request) {
	root := projectsRoot()
	entries, err := os.ReadDir(root)
	if err != nil {
		writeJSON(w, http.StatusOK, map[string]any{"projects": []string{}})
		return
	}

	var names []string
	for _, e := range entries {
		if e.IsDir() {
			stateFile := filepath.Join(root, e.Name(), "project_state.json")
			if _, statErr := os.Stat(stateFile); statErr == nil {
				names = append(names, e.Name())
			}
		}
	}
	if names == nil {
		names = []string{}
	}
	writeJSON(w, http.StatusOK, map[string]any{"projects": names})
}

// GetProject handles GET /projects/{name}
func GetProject(w http.ResponseWriter, r *http.Request) {
	name := chi.URLParam(r, "name")
	path := filepath.Join(projectsRoot(), name, "project_state.json")

	data, err := os.ReadFile(path)
	if err != nil {
		if os.IsNotExist(err) {
			errorJSON(w, http.StatusNotFound, "project not found: "+name)
		} else {
			errorJSON(w, http.StatusInternalServerError, err.Error())
		}
		return
	}
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(http.StatusOK)
	_, _ = w.Write(data)
}

// PutProject handles PUT /projects/{name}
// Body: raw ProjectState JSON — written verbatim to disk.
func PutProject(w http.ResponseWriter, r *http.Request) {
	name := chi.URLParam(r, "name")

	var body json.RawMessage
	if err := json.NewDecoder(r.Body).Decode(&body); err != nil {
		errorJSON(w, http.StatusBadRequest, "invalid JSON: "+err.Error())
		return
	}

	dir := filepath.Join(projectsRoot(), name)
	if err := os.MkdirAll(dir, 0o755); err != nil {
		errorJSON(w, http.StatusInternalServerError, "mkdir failed: "+err.Error())
		return
	}

	pretty, _ := json.MarshalIndent(body, "", "  ")
	path := filepath.Join(dir, "project_state.json")
	if err := os.WriteFile(path, pretty, 0o644); err != nil {
		errorJSON(w, http.StatusInternalServerError, "write failed: "+err.Error())
		return
	}

	writeJSON(w, http.StatusOK, map[string]string{"status": "saved", "project": name})
}
