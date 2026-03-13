package middleware

import (
	"bytes"
	"encoding/json"
	"net/http"
	"os"
	"strings"
	"time"
)

func metricsServiceURL() string {
	if u := os.Getenv("BACKFORGE_METRICS_URL"); u != "" {
		return strings.TrimRight(u, "/")
	}
	return "http://localhost:8085"
}

type metricEvent struct {
	Project    string    `json:"project"`
	Route      string    `json:"route"`
	Method     string    `json:"method"`
	StatusCode int       `json:"status_code"`
	DurationMs float64   `json:"duration_ms"`
	Timestamp  time.Time `json:"timestamp"`
}

// responseWriter wraps http.ResponseWriter to capture the status code.
type responseWriter struct {
	http.ResponseWriter
	statusCode int
}

func (rw *responseWriter) WriteHeader(code int) {
	rw.statusCode = code
	rw.ResponseWriter.WriteHeader(code)
}

// MetricsRecorder is middleware that fires a metric event to the metrics
// service after every request. It is fire-and-forget (non-blocking).
func MetricsRecorder(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		start := time.Now()
		rw := &responseWriter{ResponseWriter: w, statusCode: http.StatusOK}

		next.ServeHTTP(rw, r)

		dur := float64(time.Since(start).Microseconds()) / 1000.0 // ms

		evt := metricEvent{
			Project:    extractProject(r.URL.Path),
			Route:      r.URL.Path,
			Method:     r.Method,
			StatusCode: rw.statusCode,
			DurationMs: dur,
			Timestamp:  time.Now().UTC(),
		}
		go sendMetricEvent(evt) //nolint:errcheck
	})
}

// extractProject guesses the project name from the URL path.
// e.g. /storage/myapp/... → "myapp", /deploy/myapp/... → "myapp",
// /generate/sql → "" (no project in path)
func extractProject(path string) string {
	parts := strings.SplitN(strings.TrimPrefix(path, "/"), "/", 3)
	if len(parts) >= 2 && parts[1] != "" {
		return parts[1]
	}
	return "_gateway"
}

func sendMetricEvent(evt metricEvent) {
	data, err := json.Marshal(evt)
	if err != nil {
		return
	}
	url := metricsServiceURL() + "/metrics/record"
	req, err := http.NewRequest(http.MethodPost, url, bytes.NewReader(data))
	if err != nil {
		return
	}
	req.Header.Set("Content-Type", "application/json")
	// Short timeout so we never block application traffic
	client := &http.Client{Timeout: 500 * time.Millisecond}
	resp, err := client.Do(req)
	if err != nil {
		return
	}
	resp.Body.Close()
}
