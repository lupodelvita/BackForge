package handlers_test

import (
	"bytes"
	"context"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"testing"
	"time"

	"github.com/backforge/sync-server/internal/handlers"
	"github.com/backforge/sync-server/internal/store"
	"github.com/go-chi/chi/v5"
)

func setupHandler(t *testing.T) (*handlers.Handler, *store.Store) {
	t.Helper()
	s, err := store.New(t.TempDir())
	if err != nil {
		t.Fatal(err)
	}
	return handlers.New(s), s
}

func withProject(r *http.Request, project string) *http.Request {
	rctx := chi.NewRouteContext()
	rctx.URLParams.Add("project", project)
	return r.WithContext(context.WithValue(r.Context(), chi.RouteCtxKey, rctx))
}

func makeBody(t *testing.T, v any) *bytes.Buffer {
	t.Helper()
	b, err := json.Marshal(v)
	if err != nil {
		t.Fatal(err)
	}
	return bytes.NewBuffer(b)
}

func TestPutSnapshot_Created(t *testing.T) {
	h, _ := setupHandler(t)
	snap := store.Snapshot{
		ID: "s1", ProjectName: "shop", NodeID: "n1",
		Clock: json.RawMessage(`{"n1":1}`), SHA256: "aaa",
		Content: []byte(`{}`), CreatedAt: time.Now(),
	}
	req := httptest.NewRequest(http.MethodPut, "/sync/shop", makeBody(t, snap))
	req = withProject(req, "shop")
	w := httptest.NewRecorder()
	h.PutSnapshot(w, req)
	if w.Code != http.StatusCreated {
		t.Errorf("expected 201, got %d: %s", w.Code, w.Body.String())
	}
}

func TestPutSnapshot_MissingID(t *testing.T) {
	h, _ := setupHandler(t)
	snap := store.Snapshot{ProjectName: "shop", SHA256: "aaa", Content: []byte(`{}`)}
	req := httptest.NewRequest(http.MethodPut, "/sync/shop", makeBody(t, snap))
	req = withProject(req, "shop")
	w := httptest.NewRecorder()
	h.PutSnapshot(w, req)
	if w.Code != http.StatusBadRequest {
		t.Errorf("expected 400, got %d", w.Code)
	}
}

func TestGetLatest_NotFound(t *testing.T) {
	h, _ := setupHandler(t)
	req := httptest.NewRequest(http.MethodGet, "/sync/ghost", nil)
	req = withProject(req, "ghost")
	w := httptest.NewRecorder()
	h.GetLatest(w, req)
	if w.Code != http.StatusNotFound {
		t.Errorf("expected 404, got %d", w.Code)
	}
}

func TestGetLatest_Success(t *testing.T) {
	h, s := setupHandler(t)
	snap := &store.Snapshot{
		ID: "s2", ProjectName: "api", NodeID: "n1",
		Clock: json.RawMessage(`{"n1":2}`), SHA256: "bbb",
		Content: []byte(`{"x":1}`), CreatedAt: time.Now(),
	}
	_ = s.Put(snap)

	req := httptest.NewRequest(http.MethodGet, "/sync/api", nil)
	req = withProject(req, "api")
	w := httptest.NewRecorder()
	h.GetLatest(w, req)

	if w.Code != http.StatusOK {
		t.Fatalf("expected 200, got %d", w.Code)
	}
	var got store.Snapshot
	_ = json.NewDecoder(w.Body).Decode(&got)
	if got.ID != "s2" {
		t.Errorf("expected id=s2, got %s", got.ID)
	}
}

func TestGetHistory_EmptyForNewProject(t *testing.T) {
	h, _ := setupHandler(t)
	req := httptest.NewRequest(http.MethodGet, "/sync/new-proj/history", nil)
	req = withProject(req, "new-proj")
	w := httptest.NewRecorder()
	h.GetHistory(w, req)
	if w.Code != http.StatusOK {
		t.Fatalf("expected 200, got %d", w.Code)
	}
	var metas []store.SnapshotMeta
	_ = json.NewDecoder(w.Body).Decode(&metas)
	if len(metas) != 0 {
		t.Errorf("expected empty history, got %d items", len(metas))
	}
}

func TestGetHistory_ReturnsMeta(t *testing.T) {
	h, s := setupHandler(t)
	for _, id := range []string{"h1", "h2"} {
		_ = s.Put(&store.Snapshot{
			ID: id, ProjectName: "blog", NodeID: "n1",
			Clock: json.RawMessage(`{}`), SHA256: id, Content: []byte(`{}`),
			CreatedAt: time.Now(),
		})
	}
	req := httptest.NewRequest(http.MethodGet, "/sync/blog/history", nil)
	req = withProject(req, "blog")
	w := httptest.NewRecorder()
	h.GetHistory(w, req)

	var metas []store.SnapshotMeta
	_ = json.NewDecoder(w.Body).Decode(&metas)
	if len(metas) != 2 {
		t.Errorf("expected 2 history items, got %d", len(metas))
	}
}

func TestDeleteProject_Success(t *testing.T) {
	h, s := setupHandler(t)
	_ = s.Put(&store.Snapshot{
		ID: "d1", ProjectName: "del", NodeID: "n",
		Clock: json.RawMessage(`{}`), SHA256: "x", Content: []byte(`{}`),
		CreatedAt: time.Now(),
	})
	req := httptest.NewRequest(http.MethodDelete, "/sync/del", nil)
	req = withProject(req, "del")
	w := httptest.NewRecorder()
	h.DeleteProject(w, req)
	if w.Code != http.StatusNoContent {
		t.Errorf("expected 204, got %d", w.Code)
	}
}

func TestDeleteProject_NotFound(t *testing.T) {
	h, _ := setupHandler(t)
	req := httptest.NewRequest(http.MethodDelete, "/sync/nope", nil)
	req = withProject(req, "nope")
	w := httptest.NewRecorder()
	h.DeleteProject(w, req)
	if w.Code != http.StatusNotFound {
		t.Errorf("expected 404, got %d", w.Code)
	}
}
