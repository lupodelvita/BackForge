package routes

import (
	"net/http"

	"github.com/backforge/deployment/internal/handlers"
	"github.com/go-chi/chi/v5"
	chimiddleware "github.com/go-chi/chi/v5/middleware"
)

func NewRouter(h *handlers.DeploymentHandler) *chi.Mux {
	r := chi.NewRouter()

	r.Use(chimiddleware.Logger)
	r.Use(chimiddleware.Recoverer)
	r.Use(chimiddleware.RequestID)

	r.Get("/health", func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "application/json")
		w.Write([]byte(`{"status":"ok","service":"deployment"}`))
	})

	r.Route("/deployments", func(r chi.Router) {
		r.Post("/", h.Create)
		r.Get("/", h.List)
		r.Get("/{id}", h.Get)
		r.Delete("/{id}", h.Delete)
		r.Get("/{id}/dockerfile", h.PreviewDockerfile)
	})

	return r
}
