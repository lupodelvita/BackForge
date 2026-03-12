package routes

import (
	"github.com/backforge/sync-server/internal/handlers"
	"github.com/go-chi/chi/v5"
	"github.com/go-chi/chi/v5/middleware"
)

func New(h *handlers.Handler) *chi.Mux {
	r := chi.NewRouter()
	r.Use(middleware.Logger)
	r.Use(middleware.Recoverer)

	r.Route("/sync/{project}", func(r chi.Router) {
		r.Put("/", h.PutSnapshot)
		r.Get("/", h.GetLatest)
		r.Get("/history", h.GetHistory)
		r.Delete("/", h.DeleteProject)
	})

	return r
}
