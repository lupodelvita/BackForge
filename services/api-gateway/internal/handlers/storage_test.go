package handlers

import (
	"context"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"

	"github.com/go-chi/chi/v5"
)

// chiCtx returns a request with chi URL params injected.
func chiCtx(req *http.Request, params map[string]string) *http.Request {
	rctx := chi.NewRouteContext()
	for k, v := range params {
		rctx.URLParams.Add(k, v)
	}
	return req.WithContext(context.WithValue(req.Context(), chi.RouteCtxKey, rctx))
}

func TestFnvFilename_Deterministic(t *testing.T) {
	a := fnvFilename("hello.txt")
	b := fnvFilename("hello.txt")
	if a != b {
		t.Fatalf("expected same hash, got %q and %q", a, b)
	}
}

func TestFnvFilename_DifferentKeys(t *testing.T) {
	a := fnvFilename("file1.txt")
	b := fnvFilename("file2.txt")
	if a == b {
		t.Fatalf("expected different hashes for different keys, got %q", a)
	}
}

func TestFnvFilename_LowercaseHex(t *testing.T) {
	h := fnvFilename("hello")
	if len(h) == 0 {
		t.Fatal("expected non-empty hash")
	}
	if strings.ContainsAny(h, "ABCDEFGHIJKLMNOPQRSTUVWXYZ ") {
		t.Fatalf("expected lowercase hex, got %q", h)
	}
}

func TestStorageListBuckets_EmptyProject(t *testing.T) {
	req := httptest.NewRequest(http.MethodGet, "/storage/no-such-project-xyz-888", nil)
	req = chiCtx(req, map[string]string{"project": "no-such-project-xyz-888"})
	rr := httptest.NewRecorder()

	StorageListBuckets(rr, req)

	if rr.Code != http.StatusOK {
		t.Fatalf("expected 200 for missing project dir, got %d: %s", rr.Code, rr.Body.String())
	}
	var result map[string]interface{}
	if err := json.NewDecoder(rr.Body).Decode(&result); err != nil {
		t.Fatalf("invalid JSON: %v", err)
	}
	buckets, ok := result["buckets"]
	if !ok {
		t.Fatal("response missing 'buckets' key")
	}
	if arr, ok := buckets.([]interface{}); !ok || len(arr) != 0 {
		t.Fatalf("expected empty buckets array, got %v", buckets)
	}
}

func TestErrorJSON(t *testing.T) {
	w := httptest.NewRecorder()
	errorJSON(w, http.StatusNotFound, "not found")

	if w.Code != http.StatusNotFound {
		t.Fatalf("expected 404, got %d", w.Code)
	}
	var body map[string]string
	if err := json.NewDecoder(w.Body).Decode(&body); err != nil {
		t.Fatalf("invalid JSON: %v", err)
	}
	if body["error"] != "not found" {
		t.Fatalf("expected error='not found', got %q", body["error"])
	}
}
