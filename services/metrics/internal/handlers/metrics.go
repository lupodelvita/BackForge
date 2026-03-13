package handlers

import (
	"encoding/json"
	"net/http"

	"github.com/backforge/metrics/internal/store"
	"github.com/go-chi/chi/v5"
)

// metricsStore is set by the router when wiring up handlers.
var metricsStore *store.MetricsStore

// Init injects the shared MetricsStore into all handlers.
func Init(s *store.MetricsStore) {
	metricsStore = s
}

// HealthCheck godoc
// GET /health
func HealthCheck(w http.ResponseWriter, r *http.Request) {
	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(map[string]string{"status": "ok", "service": "metrics"}) //nolint:errcheck
}

// RecordEvent godoc
// POST /metrics/record
// Body: MetricEvent JSON
func RecordEvent(w http.ResponseWriter, r *http.Request) {
	var evt store.MetricEvent
	if err := json.NewDecoder(r.Body).Decode(&evt); err != nil {
		http.Error(w, `{"error":"invalid JSON"}`, http.StatusBadRequest)
		return
	}
	if evt.Route == "" || evt.Method == "" {
		http.Error(w, `{"error":"route and method are required"}`, http.StatusBadRequest)
		return
	}
	metricsStore.Record(evt)
	w.WriteHeader(http.StatusNoContent)
}

// GetPrometheus godoc
// GET /metrics
// Returns Prometheus text exposition format
func GetPrometheus(w http.ResponseWriter, r *http.Request) {
	w.Header().Set("Content-Type", "text/plain; version=0.0.4; charset=utf-8")
	w.Write([]byte(metricsStore.PrometheusText())) //nolint:errcheck
}

// GetAll godoc
// GET /metrics/json
// Returns all RouteStats as JSON
func GetAll(w http.ResponseWriter, r *http.Request) {
	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(map[string]interface{}{ //nolint:errcheck
		"stats": metricsStore.All(),
	})
}

// GetProject godoc
// GET /metrics/project/{project}
// Returns RouteStats for a specific project
func GetProject(w http.ResponseWriter, r *http.Request) {
	project := chi.URLParam(r, "project")
	if project == "" {
		http.Error(w, `{"error":"project is required"}`, http.StatusBadRequest)
		return
	}
	stats := metricsStore.ForProject(project)
	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(map[string]interface{}{ //nolint:errcheck
		"project": project,
		"stats":   stats,
	})
}

// GetSummary godoc
// GET /metrics/summary
// Returns per-project summary
func GetSummary(w http.ResponseWriter, r *http.Request) {
	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(map[string]interface{}{ //nolint:errcheck
		"projects": metricsStore.Summarize(),
	})
}
