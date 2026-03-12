package main

import (
	"fmt"
	"log"
	"net/http"

	"github.com/backforge/code-generator/internal/config"
	"github.com/backforge/code-generator/internal/routes"
)

func main() {
	cfg := config.Load()
	r := routes.New()

	addr := fmt.Sprintf(":%s", cfg.Port)
	log.Printf("backforge code-generator listening on %s", addr)
	if err := http.ListenAndServe(addr, r); err != nil {
		log.Fatalf("server error: %v", err)
	}
}
