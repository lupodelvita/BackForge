package handlers

import (
	"encoding/json"
	"errors"
	"net/http"

	"github.com/backforge/sync-server/internal/store"
	"github.com/go-chi/chi/v5"
)

type Handler struct {
	store *store.Store
}

func New(s *store.Store) *Handler {
	return &Handler{store: s}
}

// PUT /sync/{project}
func (h *Handler) PutSnapshot(w http.ResponseWriter, r *http.Request) {
	project := chi.URLParam(r, "project")
	if project == "" {
		http.Error(w, "project name required", http.StatusBadRequest)
		return
	}

	var snap store.Snapshot
	if err := json.NewDecoder(r.Body).Decode(&snap); err != nil {
		http.Error(w, "invalid JSON: "+err.Error(), http.StatusBadRequest)
		return
	}
	// Ensure ProjectName matches the URL segment
	snap.ProjectName = project

	if snap.ID == "" {
		http.Error(w, "snapshot.id is required", http.StatusBadRequest)
		return
	}

	if err := h.store.Put(&snap); err != nil {
		http.Error(w, "store error: "+err.Error(), http.StatusInternalServerError)
		return
	}

	writeJSON(w, http.StatusCreated, map[string]string{"status": "ok", "id": snap.ID})
}

// GET /sync/{project}
func (h *Handler) GetLatest(w http.ResponseWriter, r *http.Request) {
	project := chi.URLParam(r, "project")
	snap, err := h.store.GetLatest(project)
	if errors.Is(err, store.ErrNotFound) {
		http.Error(w, "not found", http.StatusNotFound)
		return
	}
	if err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}
	writeJSON(w, http.StatusOK, snap)
}

// GET /sync/{project}/history
func (h *Handler) GetHistory(w http.ResponseWriter, r *http.Request) {
	project := chi.URLParam(r, "project")
	metas, err := h.store.History(project)
	if errors.Is(err, store.ErrNotFound) {
		// Return empty list rather than 404 for history
		writeJSON(w, http.StatusOK, []store.SnapshotMeta{})
		return
	}
	if err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}
	writeJSON(w, http.StatusOK, metas)
}

// DELETE /sync/{project}
func (h *Handler) DeleteProject(w http.ResponseWriter, r *http.Request) {
	project := chi.URLParam(r, "project")
	if err := h.store.Delete(project); errors.Is(err, store.ErrNotFound) {
		http.Error(w, "not found", http.StatusNotFound)
		return
	} else if err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}
	w.WriteHeader(http.StatusNoContent)
}

func writeJSON(w http.ResponseWriter, status int, v any) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(status)
	_ = json.NewEncoder(w).Encode(v)
}
