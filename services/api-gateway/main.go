package main

import (
	"context"
	"fmt"
	"log"
	"net/http"
	"os"
	"os/signal"
	"syscall"
	"time"

	"github.com/backforge/api-gateway/internal/config"
	"github.com/backforge/api-gateway/internal/routes"
	"github.com/jackc/pgx/v5/pgxpool"
	"github.com/redis/go-redis/v9"
)

func main() {
	cfg := config.Load()

	// Подключение к Redis
	redisOpt, err := redis.ParseURL(cfg.RedisURL)
	if err != nil {
		log.Fatalf("invalid REDIS_URL: %v", err)
	}
	rdb := redis.NewClient(redisOpt)

	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()
	if err := rdb.Ping(ctx).Err(); err != nil {
		log.Fatalf("redis connection failed: %v", err)
	}
	log.Println("✓ Redis connected")

	// Optional PostgreSQL connection (for migrations API)
	var pool *pgxpool.Pool
	if dbURL := os.Getenv("DATABASE_URL"); dbURL != "" {
		p, dbErr := pgxpool.New(ctx, dbURL)
		if dbErr != nil {
			log.Printf("warn: postgres init failed: %v (migrate API disabled)", dbErr)
		} else if pingErr := p.Ping(ctx); pingErr != nil {
			log.Printf("warn: postgres ping failed: %v (migrate API disabled)", pingErr)
		} else {
			pool = p
			log.Println("✓ PostgreSQL connected")
		}
	}

	// Router
	r := routes.NewRouter(cfg, rdb, pool)

	srv := &http.Server{
		Addr:         fmt.Sprintf(":%s", cfg.Port),
		Handler:      r,
		ReadTimeout:  15 * time.Second,
		WriteTimeout: 15 * time.Second,
		IdleTimeout:  60 * time.Second,
	}

	// Graceful shutdown
	done := make(chan struct{})
	go func() {
		quit := make(chan os.Signal, 1)
		signal.Notify(quit, syscall.SIGINT, syscall.SIGTERM)
		<-quit
		log.Println("Shutting down...")
		shutCtx, shutCancel := context.WithTimeout(context.Background(), 10*time.Second)
		defer shutCancel()
		srv.Shutdown(shutCtx)
		close(done)
	}()

	log.Printf("✓ API Gateway listening on :%s", cfg.Port)
	if err := srv.ListenAndServe(); err != nil && err != http.ErrServerClosed {
		log.Fatalf("server error: %v", err)
	}
	<-done
}
