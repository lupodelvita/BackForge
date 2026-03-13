package handlers

import (
	"bytes"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"testing"
	"time"

	"github.com/backforge/metrics/internal/store"
	"github.com/go-chi/chi/v5"
)

func setupTest() *store.MetricsStore {
	s := store.New()
	Init(s)
	return s
}

func postRecord(t *testing.T, evt store.MetricEvent) *httptest.ResponseRecorder {
	t.Helper()
	body, _ := json.Marshal(evt)
	req := httptest.NewRequest(http.MethodPost, "/metrics/record", bytes.NewReader(body))
	req.Header.Set("Content-Type", "application/json")
	rr := httptest.NewRecorder()
	RecordEvent(rr, req)
	return rr
}

func TestHealthCheck(t *testing.T) {
	setupTest()
	req := httptest.NewRequest(http.MethodGet, "/health", nil)
	rr := httptest.NewRecorder()
	HealthCheck(rr, req)
	if rr.Code != http.StatusOK {
		t.Errorf("want 200, got %d", rr.Code)
	}
	var body map[string]string
	json.NewDecoder(rr.Body).Decode(&body)
	if body["status"] != "ok" {
		t.Errorf("want status=ok, got %q", body["status"])
	}
}

func TestRecordEvent_Valid(t *testing.T) {
	s := setupTest()
	evt := store.MetricEvent{
		Project:    "myapp",
		Route:      "/users",
		Method:     "GET",
		StatusCode: 200,
		DurationMs: 12.5,
		Timestamp:  time.Now(),
	}
	rr := postRecord(t, evt)
	if rr.Code != http.StatusNoContent {
		t.Errorf("want 204, got %d", rr.Code)
	}
	all := s.All()
	if len(all) != 1 {
		t.Fatalf("expected 1 recorded stat, got %d", len(all))
	}
}

func TestRecordEvent_InvalidJSON(t *testing.T) {
	setupTest()
	req := httptest.NewRequest(http.MethodPost, "/metrics/record", bytes.NewBufferString("{bad json}"))
	rr := httptest.NewRecorder()
	RecordEvent(rr, req)
	if rr.Code != http.StatusBadRequest {
		t.Errorf("want 400, got %d", rr.Code)
	}
}

func TestRecordEvent_MissingFields(t *testing.T) {
	setupTest()
	body, _ := json.Marshal(store.MetricEvent{Project: "x"}) // no route/method
	req := httptest.NewRequest(http.MethodPost, "/metrics/record", bytes.NewReader(body))
	rr := httptest.NewRecorder()
	RecordEvent(rr, req)
	if rr.Code != http.StatusBadRequest {
		t.Errorf("want 400, got %d", rr.Code)
	}
}

func TestGetPrometheus(t *testing.T) {
	s := setupTest()
	s.Record(store.MetricEvent{
		Project: "app", Route: "/ping", Method: "GET",
		StatusCode: 200, DurationMs: 5.0, Timestamp: time.Now(),
	})
	req := httptest.NewRequest(http.MethodGet, "/metrics", nil)
	rr := httptest.NewRecorder()
	GetPrometheus(rr, req)
	if rr.Code != http.StatusOK {
		t.Errorf("want 200, got %d", rr.Code)
	}
	body := rr.Body.String()
	if !containsStr(body, "backforge_requests_total") {
		t.Error("prometheus text missing backforge_requests_total")
	}
}

func TestGetAll(t *testing.T) {
	s := setupTest()
	s.Record(store.MetricEvent{
		Project: "p", Route: "/a", Method: "POST",
		StatusCode: 201, DurationMs: 8.0, Timestamp: time.Now(),
	})
	req := httptest.NewRequest(http.MethodGet, "/metrics/json", nil)
	rr := httptest.NewRecorder()
	GetAll(rr, req)
	if rr.Code != http.StatusOK {
		t.Errorf("want 200, got %d", rr.Code)
	}
	var resp map[string]interface{}
	json.NewDecoder(rr.Body).Decode(&resp)
	if resp["stats"] == nil {
		t.Error("response missing 'stats' field")
	}
}

func TestGetProject(t *testing.T) {
	s := setupTest()
	s.Record(store.MetricEvent{
		Project: "alpha", Route: "/x", Method: "GET",
		StatusCode: 200, DurationMs: 1.0, Timestamp: time.Now(),
	})
	s.Record(store.MetricEvent{
		Project: "beta", Route: "/y", Method: "GET",
		StatusCode: 200, DurationMs: 2.0, Timestamp: time.Now(),
	})

	r := chi.NewRouter()
	r.Get("/metrics/project/{project}", GetProject)

	req := httptest.NewRequest(http.MethodGet, "/metrics/project/alpha", nil)
	rr := httptest.NewRecorder()
	r.ServeHTTP(rr, req)

	if rr.Code != http.StatusOK {
		t.Errorf("want 200, got %d", rr.Code)
	}
	var resp map[string]interface{}
	json.NewDecoder(rr.Body).Decode(&resp)
	if resp["project"] != "alpha" {
		t.Errorf("want project=alpha, got %v", resp["project"])
	}
}

func TestGetSummary(t *testing.T) {
	s := setupTest()
	s.Record(store.MetricEvent{
		Project: "app1", Route: "/a", Method: "GET",
		StatusCode: 200, DurationMs: 10.0, Timestamp: time.Now(),
	})
	s.Record(store.MetricEvent{
		Project: "app2", Route: "/b", Method: "GET",
		StatusCode: 500, DurationMs: 50.0, Timestamp: time.Now(),
	})
	req := httptest.NewRequest(http.MethodGet, "/metrics/summary", nil)
	rr := httptest.NewRecorder()
	GetSummary(rr, req)
	if rr.Code != http.StatusOK {
		t.Errorf("want 200, got %d", rr.Code)
	}
	var resp map[string]interface{}
	json.NewDecoder(rr.Body).Decode(&resp)
	projects, ok := resp["projects"].([]interface{})
	if !ok || len(projects) != 2 {
		t.Errorf("expected 2 project summaries, got %v", resp["projects"])
	}
}

func containsStr(s, sub string) bool {
	return len(sub) == 0 || (len(s) >= len(sub) && func() bool {
		for i := 0; i <= len(s)-len(sub); i++ {
			if s[i:i+len(sub)] == sub {
				return true
			}
		}
		return false
	}())
}
