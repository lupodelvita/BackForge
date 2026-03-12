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

	"github.com/backforge/deployment/internal/config"
	"github.com/backforge/deployment/internal/deploy"
	"github.com/backforge/deployment/internal/handlers"
	"github.com/backforge/deployment/internal/routes"
	"github.com/backforge/deployment/internal/store"
)

func main() {
	cfg := config.Load()

	deployer := resolveDeployer("local")

	h := &handlers.DeploymentHandler{
		Store:        store.New(cfg.DeploymentsDir),
		Deployer:     deployer,
		ProjectsRoot: cfg.ProjectsRoot,
	}

	r := routes.NewRouter(h)

	srv := &http.Server{
		Addr:         fmt.Sprintf(":%s", cfg.Port),
		Handler:      r,
		ReadTimeout:  15 * time.Second,
		WriteTimeout: 10 * time.Minute, // allow long docker builds
		IdleTimeout:  60 * time.Second,
	}

	done := make(chan struct{})
	go func() {
		quit := make(chan os.Signal, 1)
		signal.Notify(quit, syscall.SIGINT, syscall.SIGTERM)
		<-quit
		log.Println("Shutting down deployment service...")
		ctx, cancel := context.WithTimeout(context.Background(), 30*time.Second)
		defer cancel()
		srv.Shutdown(ctx)
		close(done)
	}()

	log.Printf("✓ BackForge Deployment Service listening on :%s", cfg.Port)
	log.Printf("  Projects root: %s", cfg.ProjectsRoot)
	log.Printf("  Deployments:   %s", cfg.DeploymentsDir)

	if err := srv.ListenAndServe(); err != nil && err != http.ErrServerClosed {
		log.Fatalf("server error: %v", err)
	}
	<-done
}

func resolveDeployer(defaultTarget string) deploy.Deployer {
	_ = defaultTarget
	// Always use LocalDeployer as the default; cloud/edge are stubs for now.
	return deploy.NewLocalDeployer()
}
