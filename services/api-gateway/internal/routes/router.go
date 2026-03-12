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

		// Storage routes
		r.Get("/storage/{project}", handlers.StorageListBuckets)
		r.Put("/storage/{project}/{bucket}", handlers.StorageCreateBucket)
		r.Delete("/storage/{project}/{bucket}", handlers.StorageDeleteBucket)
		r.Get("/storage/{project}/{bucket}", handlers.StorageListObjects)
		r.Put("/storage/{project}/{bucket}/{key}", handlers.StorageUpload)
		r.Get("/storage/{project}/{bucket}/{key}", handlers.StorageDownload)
		r.Delete("/storage/{project}/{bucket}/{key}", handlers.StorageDeleteObject)

		// Deployment proxy routes → forwarded to services/deployment (port 8082)
		r.HandleFunc("/deploy/*", handlers.DeployProxy)
		r.HandleFunc("/deploy", handlers.DeployProxy)
	})

	return r
}
