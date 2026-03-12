package routes

import (
	"github.com/backforge/code-generator/internal/handlers"
	"github.com/go-chi/chi/v5"
	"github.com/go-chi/chi/v5/middleware"
)

func New() *chi.Mux {
	r := chi.NewRouter()
	r.Use(middleware.Logger)
	r.Use(middleware.Recoverer)

	r.Post("/generate/sql", handlers.GenerateSQL)
	r.Post("/generate/handlers", handlers.GenerateHandlers)
	r.Post("/generate/openapi", handlers.GenerateOpenAPI)
	r.Post("/generate/all", handlers.GenerateAll)

	return r
}
