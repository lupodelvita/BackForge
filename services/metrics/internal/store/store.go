// Package store implements an in-memory metrics store.
//
// Each recorded event carries: project, route, method, status_code,
// and duration_ms. Aggregation is lock-protected and cheap.
package store

import (
	"fmt"
	"sort"
	"strings"
	"sync"
	"time"
)

// EventKind distinguishes the type of metric event.
type EventKind string

const (
	KindRequest EventKind = "request"
	KindError   EventKind = "error"
)

// MetricEvent is sent by other services (API Gateway, etc.) to record one
// observed HTTP interaction.
type MetricEvent struct {
	Project    string    `json:"project"`
	Route      string    `json:"route"`
	Method     string    `json:"method"`
	StatusCode int       `json:"status_code"`
	DurationMs float64   `json:"duration_ms"`
	Timestamp  time.Time `json:"timestamp"`
}

// RouteStats holds aggregated numbers for a single (project, method, route) key.
type RouteStats struct {
	Project       string  `json:"project"`
	Method        string  `json:"method"`
	Route         string  `json:"route"`
	Requests      int64   `json:"requests"`
	Errors        int64   `json:"errors"`
	TotalDurationMs float64 `json:"total_duration_ms"`
	MinDurationMs float64 `json:"min_duration_ms"`
	MaxDurationMs float64 `json:"max_duration_ms"`
	LastSeenAt    time.Time `json:"last_seen_at"`
}

// AvgDurationMs returns the mean request duration (0 if no requests yet).
func (s *RouteStats) AvgDurationMs() float64 {
	if s.Requests == 0 {
		return 0
	}
	return s.TotalDurationMs / float64(s.Requests)
}

// routeKey is the composite map key.
type routeKey struct {
	project string
	method  string
	route   string
}

// MetricsStore is the central in-memory registry.
type MetricsStore struct {
	mu    sync.RWMutex
	stats map[routeKey]*RouteStats
}

// New creates an empty MetricsStore.
func New() *MetricsStore {
	return &MetricsStore{
		stats: make(map[routeKey]*RouteStats),
	}
}

// Record ingests one MetricEvent into the store.
func (m *MetricsStore) Record(evt MetricEvent) {
	key := routeKey{
		project: evt.Project,
		method:  strings.ToUpper(evt.Method),
		route:   evt.Route,
	}

	m.mu.Lock()
	defer m.mu.Unlock()

	s, ok := m.stats[key]
	if !ok {
		s = &RouteStats{
			Project:       evt.Project,
			Method:        strings.ToUpper(evt.Method),
			Route:         evt.Route,
			MinDurationMs: evt.DurationMs,
			MaxDurationMs: evt.DurationMs,
		}
		m.stats[key] = s
	}

	s.Requests++
	s.TotalDurationMs += evt.DurationMs
	if evt.DurationMs < s.MinDurationMs {
		s.MinDurationMs = evt.DurationMs
	}
	if evt.DurationMs > s.MaxDurationMs {
		s.MaxDurationMs = evt.DurationMs
	}
	if evt.StatusCode >= 400 {
		s.Errors++
	}
	s.LastSeenAt = evt.Timestamp

	if s.LastSeenAt.IsZero() {
		s.LastSeenAt = time.Now().UTC()
	}
}

// All returns a copy of all RouteStats, sorted by project+route.
func (m *MetricsStore) All() []RouteStats {
	m.mu.RLock()
	defer m.mu.RUnlock()

	out := make([]RouteStats, 0, len(m.stats))
	for _, s := range m.stats {
		out = append(out, *s)
	}
	sort.Slice(out, func(i, j int) bool {
		if out[i].Project != out[j].Project {
			return out[i].Project < out[j].Project
		}
		if out[i].Route != out[j].Route {
			return out[i].Route < out[j].Route
		}
		return out[i].Method < out[j].Method
	})
	return out
}

// ForProject returns stats for a single project.
func (m *MetricsStore) ForProject(project string) []RouteStats {
	all := m.All()
	out := all[:0]
	for _, s := range all {
		if s.Project == project {
			out = append(out, s)
		}
	}
	return out
}

// ProjectSummary is an aggregated overview for one project.
type ProjectSummary struct {
	Project      string  `json:"project"`
	TotalRoutes  int     `json:"total_routes"`
	TotalRequests int64  `json:"total_requests"`
	TotalErrors  int64   `json:"total_errors"`
	AvgDurationMs float64 `json:"avg_duration_ms"`
}

// Summarize returns per-project summaries.
func (m *MetricsStore) Summarize() []ProjectSummary {
	all := m.All()
	byProject := make(map[string]*ProjectSummary)
	for _, s := range all {
		ps, ok := byProject[s.Project]
		if !ok {
			ps = &ProjectSummary{Project: s.Project}
			byProject[s.Project] = ps
		}
		ps.TotalRoutes++
		ps.TotalRequests += s.Requests
		ps.TotalErrors += s.Errors
		ps.AvgDurationMs += s.TotalDurationMs
	}
	// Finalize averages
	for _, ps := range byProject {
		if ps.TotalRequests > 0 {
			ps.AvgDurationMs /= float64(ps.TotalRequests)
		}
	}
	out := make([]ProjectSummary, 0, len(byProject))
	for _, ps := range byProject {
		out = append(out, *ps)
	}
	sort.Slice(out, func(i, j int) bool {
		return out[i].Project < out[j].Project
	})
	return out
}

// Reset clears all metrics (for testing).
func (m *MetricsStore) Reset() {
	m.mu.Lock()
	defer m.mu.Unlock()
	m.stats = make(map[routeKey]*RouteStats)
}

// PrometheusText renders all stats in Prometheus exposition format.
func (m *MetricsStore) PrometheusText() string {
	stats := m.All()
	var sb strings.Builder

	sb.WriteString("# HELP backforge_requests_total Total HTTP requests\n")
	sb.WriteString("# TYPE backforge_requests_total counter\n")
	for _, s := range stats {
		labels := prometheusLabels(s.Project, s.Method, s.Route)
		sb.WriteString(fmt.Sprintf("backforge_requests_total{%s} %d\n", labels, s.Requests))
	}

	sb.WriteString("# HELP backforge_errors_total Total HTTP errors (status >= 400)\n")
	sb.WriteString("# TYPE backforge_errors_total counter\n")
	for _, s := range stats {
		labels := prometheusLabels(s.Project, s.Method, s.Route)
		sb.WriteString(fmt.Sprintf("backforge_errors_total{%s} %d\n", labels, s.Errors))
	}

	sb.WriteString("# HELP backforge_request_duration_ms_avg Average request duration in milliseconds\n")
	sb.WriteString("# TYPE backforge_request_duration_ms_avg gauge\n")
	for _, s := range stats {
		labels := prometheusLabels(s.Project, s.Method, s.Route)
		sb.WriteString(fmt.Sprintf("backforge_request_duration_ms_avg{%s} %.3f\n", labels, s.AvgDurationMs()))
	}

	sb.WriteString("# HELP backforge_request_duration_ms_max Maximum request duration in milliseconds\n")
	sb.WriteString("# TYPE backforge_request_duration_ms_max gauge\n")
	for _, s := range stats {
		labels := prometheusLabels(s.Project, s.Method, s.Route)
		sb.WriteString(fmt.Sprintf("backforge_request_duration_ms_max{%s} %.3f\n", labels, s.MaxDurationMs))
	}

	return sb.String()
}

func prometheusLabels(project, method, route string) string {
	return fmt.Sprintf(`project=%q,method=%q,route=%q`, project, method, route)
}
