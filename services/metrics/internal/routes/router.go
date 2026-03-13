package routes

import (
	"github.com/backforge/metrics/internal/handlers"
	"github.com/backforge/metrics/internal/store"
	"github.com/go-chi/chi/v5"
	"github.com/go-chi/chi/v5/middleware"
)

func NewRouter(s *store.MetricsStore) *chi.Mux {
	handlers.Init(s)

	r := chi.NewRouter()
	r.Use(middleware.Logger)
	r.Use(middleware.Recoverer)
	r.Use(middleware.RequestID)

	r.Get("/health", handlers.HealthCheck)

	// Prometheus scrape endpoint
	r.Get("/metrics", handlers.GetPrometheus)

	// REST API
	r.Post("/metrics/record", handlers.RecordEvent)
	r.Get("/metrics/json", handlers.GetAll)
	r.Get("/metrics/summary", handlers.GetSummary)
	r.Get("/metrics/project/{project}", handlers.GetProject)

	return r
}
