package routes

import (
	"log"

	"github.com/backforge/api-gateway/internal/config"
	"github.com/backforge/api-gateway/internal/handlers"
	"github.com/backforge/api-gateway/internal/middleware"
	"github.com/go-chi/chi/v5"
	chimiddleware "github.com/go-chi/chi/v5/middleware"
	"github.com/jackc/pgx/v5/pgxpool"
	"github.com/redis/go-redis/v9"
)

func NewRouter(cfg *config.Config, rdb *redis.Client, pool *pgxpool.Pool) *chi.Mux {
	r := chi.NewRouter()

	// CORS — must be first so preflight OPTIONS are handled before auth/rate-limit
	r.Use(middleware.CORS(cfg.FrontendURL))

	// Глобальные middleware
	r.Use(chimiddleware.Logger)
	r.Use(chimiddleware.Recoverer)
	r.Use(chimiddleware.RequestID)
	r.Use(chimiddleware.SetHeader("Content-Type", "application/json"))

	// Metrics recording (fire-and-forget to metrics service)
	r.Use(middleware.MetricsRecorder)

	// Rate limiting: 100 запросов/мин на IP
	r.Use(middleware.RateLimit(rdb, 100))

	// ── Auth routes (public) ────────────────────────────────────────────────
	var auth *handlers.AuthHandler
	if pool != nil {
		var err error
		auth, err = handlers.NewAuthHandler(pool, rdb, cfg)
		if err != nil {
			log.Printf("warn: auth handler init failed: %v (auth API disabled)", err)
		}
	}
	if auth != nil {
		r.Post("/auth/register", auth.Register)
		r.Post("/auth/login", auth.Login)
		r.Get("/auth/platform/github", auth.PlatformGitHubStatus)
		r.Get("/auth/github", auth.GitHubAuthorize)
		r.Get("/auth/github/callback", auth.GitHubCallback)
	}

	// ── Public routes ────────────────────────────────────────────────────────
	r.Get("/health", handlers.HealthCheck)

	// Project state CRUD (no auth — builder uses these directly)
	r.Get("/projects", handlers.ListProjects)
	r.Get("/projects/{name}", handlers.GetProject)
	r.Put("/projects/{name}", handlers.PutProject)

	// Migration API (no auth — builder triggers from UI)
	r.Get("/migrate/{name}/status", handlers.MigrateStatus(pool))
	r.Post("/migrate/{name}/run", handlers.MigrateRun(pool))

	// ── Protected routes (JWT required) ─────────────────────────────────────
	r.Group(func(r chi.Router) {
		r.Use(middleware.JWTAuth(cfg.JWTSecret))

		// Auth: current user + GitHub connect
		if auth != nil {
			r.Get("/auth/me", auth.GetMe)
			r.Post("/auth/github/connect", auth.GitHubConnectInit)
			r.Get("/auth/providers/github", auth.GetGitHubProviderConfig)
			r.Put("/auth/providers/github", auth.UpsertGitHubProviderConfig)
			// Admin-only: configure platform GitHub OAuth from the UI (no .env required)
			r.Get("/admin/platform/config", auth.GetAdminPlatformConfig)
			r.Put("/admin/platform/config", auth.UpsertAdminPlatformConfig)
		}
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

		// Sync proxy routes → forwarded to services/sync-server (port 8083)
		r.HandleFunc("/sync/*", handlers.SyncProxy)
		r.HandleFunc("/sync", handlers.SyncProxy)

		// Codegen proxy routes → forwarded to services/code-generator (port 8084)
		r.HandleFunc("/generate/*", handlers.CodegenProxy)
		r.HandleFunc("/generate", handlers.CodegenProxy)

		// Metrics proxy routes → forwarded to services/metrics (port 8085)
		r.HandleFunc("/metrics/*", handlers.MetricsProxy)
		r.HandleFunc("/metrics", handlers.MetricsProxy)
		r.HandleFunc("/metrics/json", handlers.MetricsProxy)
		r.HandleFunc("/metrics/summary", handlers.MetricsProxy)
	})

	return r
}
