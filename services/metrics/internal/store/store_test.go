package store

import (
	"testing"
	"time"
)

func evt(project, method, route string, status int, durMs float64) MetricEvent {
	return MetricEvent{
		Project:    project,
		Route:      route,
		Method:     method,
		StatusCode: status,
		DurationMs: durMs,
		Timestamp:  time.Now().UTC(),
	}
}

func TestRecord_SingleEvent(t *testing.T) {
	s := New()
	s.Record(evt("myapp", "GET", "/users", 200, 10.5))

	all := s.All()
	if len(all) != 1 {
		t.Fatalf("expected 1 stat, got %d", len(all))
	}
	got := all[0]
	if got.Requests != 1 {
		t.Errorf("requests: want 1, got %d", got.Requests)
	}
	if got.Errors != 0 {
		t.Errorf("errors: want 0, got %d", got.Errors)
	}
	if got.MinDurationMs != 10.5 {
		t.Errorf("min: want 10.5, got %f", got.MinDurationMs)
	}
	if got.MaxDurationMs != 10.5 {
		t.Errorf("max: want 10.5, got %f", got.MaxDurationMs)
	}
}

func TestRecord_MultipleEvents_SameRoute(t *testing.T) {
	s := New()
	s.Record(evt("app", "GET", "/items", 200, 5.0))
	s.Record(evt("app", "GET", "/items", 200, 15.0))
	s.Record(evt("app", "GET", "/items", 500, 20.0))

	all := s.All()
	if len(all) != 1 {
		t.Fatalf("expected 1 stat, got %d", len(all))
	}
	st := all[0]
	if st.Requests != 3 {
		t.Errorf("requests: want 3, got %d", st.Requests)
	}
	if st.Errors != 1 {
		t.Errorf("errors: want 1 (500), got %d", st.Errors)
	}
	if st.MinDurationMs != 5.0 {
		t.Errorf("min: want 5.0, got %f", st.MinDurationMs)
	}
	if st.MaxDurationMs != 20.0 {
		t.Errorf("max: want 20.0, got %f", st.MaxDurationMs)
	}
	if avg := st.AvgDurationMs(); avg != 40.0/3.0 {
		t.Errorf("avg: want %.4f, got %.4f", 40.0/3.0, avg)
	}
}

func TestRecord_DifferentRoutesSameProject(t *testing.T) {
	s := New()
	s.Record(evt("app", "GET", "/a", 200, 1))
	s.Record(evt("app", "POST", "/b", 201, 2))
	s.Record(evt("app", "DELETE", "/c", 204, 3))

	all := s.All()
	if len(all) != 3 {
		t.Errorf("expected 3 stats, got %d", len(all))
	}
}

func TestForProject_Filters(t *testing.T) {
	s := New()
	s.Record(evt("alpha", "GET", "/x", 200, 1))
	s.Record(evt("beta", "GET", "/y", 200, 2))
	s.Record(evt("alpha", "POST", "/z", 200, 3))

	res := s.ForProject("alpha")
	if len(res) != 2 {
		t.Errorf("expected 2 alpha stats, got %d", len(res))
	}
	for _, r := range res {
		if r.Project != "alpha" {
			t.Errorf("unexpected project %q", r.Project)
		}
	}
}

func TestSummarize(t *testing.T) {
	s := New()
	s.Record(evt("p1", "GET", "/a", 200, 10))
	s.Record(evt("p1", "GET", "/a", 500, 20))
	s.Record(evt("p2", "POST", "/b", 201, 5))

	sums := s.Summarize()
	if len(sums) != 2 {
		t.Fatalf("expected 2 project summaries, got %d", len(sums))
	}
	var p1 *ProjectSummary
	for i := range sums {
		if sums[i].Project == "p1" {
			p1 = &sums[i]
		}
	}
	if p1 == nil {
		t.Fatal("p1 summary not found")
	}
	if p1.TotalRequests != 2 {
		t.Errorf("p1 requests: want 2, got %d", p1.TotalRequests)
	}
	if p1.TotalErrors != 1 {
		t.Errorf("p1 errors: want 1, got %d", p1.TotalErrors)
	}
}

func TestPrometheusText_ContainsMetrics(t *testing.T) {
	s := New()
	s.Record(evt("myapp", "GET", "/ping", 200, 3.5))
	s.Record(evt("myapp", "GET", "/ping", 503, 12.0))

	text := s.PrometheusText()

	checks := []string{
		"backforge_requests_total",
		"backforge_errors_total",
		"backforge_request_duration_ms_avg",
		"backforge_request_duration_ms_max",
		`project="myapp"`,
		`method="GET"`,
		`route="/ping"`,
	}
	for _, c := range checks {
		if !contains(text, c) {
			t.Errorf("prometheus text missing %q", c)
		}
	}
}

func TestReset(t *testing.T) {
	s := New()
	s.Record(evt("app", "GET", "/x", 200, 1))
	s.Reset()
	if len(s.All()) != 0 {
		t.Error("expected empty after Reset")
	}
}

func contains(s, sub string) bool {
	return len(s) >= len(sub) && (s == sub || len(sub) == 0 ||
		func() bool {
			for i := 0; i <= len(s)-len(sub); i++ {
				if s[i:i+len(sub)] == sub {
					return true
				}
			}
			return false
		}())
}
