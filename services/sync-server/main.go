package main

import (
	"fmt"
	"log"
	"net/http"

	"github.com/backforge/sync-server/internal/config"
	"github.com/backforge/sync-server/internal/handlers"
	"github.com/backforge/sync-server/internal/routes"
	"github.com/backforge/sync-server/internal/store"
)

func main() {
	cfg := config.Load()

	s, err := store.New(cfg.StorePath)
	if err != nil {
		log.Fatalf("failed to initialize store: %v", err)
	}

	h := handlers.New(s)
	r := routes.New(h)

	addr := fmt.Sprintf(":%s", cfg.Port)
	log.Printf("backforge sync-server listening on %s (store: %s)", addr, cfg.StorePath)
	if err := http.ListenAndServe(addr, r); err != nil {
		log.Fatalf("server error: %v", err)
	}
}
