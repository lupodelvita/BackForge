package routes

import (
	"github.com/backforge/api-gateway/internal/handlers"
	"github.com/backforge/api-gateway/internal/middleware"
	"github.com/go-chi/chi/v5"
	chimiddleware "github.com/go-chi/chi/v5/middleware"
	"github.com/redis/go-redis/v9"
)

func NewRouter(jwtSecret string, rdb *redis.Client) *chi.Mux {
	r := chi.NewRouter()

	// Глобальные middleware
	r.Use(chimiddleware.Logger)
	r.Use(chimiddleware.Recoverer)
	r.Use(chimiddleware.RequestID)
	r.Use(chimiddleware.SetHeader("Content-Type", "application/json"))

	// Rate limiting: 100 запросов/мин на IP
	r.Use(middleware.RateLimit(rdb, 100))

	// Публичные маршруты
	r.Get("/health", handlers.HealthCheck)

	// Защищённые маршруты (JWT обязателен)
	r.Group(func(r chi.Router) {
		r.Use(middleware.JWTAuth(jwtSecret))
		// Динамические API routes из project_state.json — Phase 2.5
	})

	return r
}
