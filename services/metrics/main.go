package main

import (
	"fmt"
	"net/http"

	"github.com/backforge/metrics/internal/config"
	"github.com/backforge/metrics/internal/routes"
	"github.com/backforge/metrics/internal/store"
)

func main() {
	cfg := config.Load()
	s := store.New()
	r := routes.NewRouter(s)

	addr := fmt.Sprintf(":%d", cfg.Port)
	fmt.Printf("metrics service listening on %s\n", addr)
	if err := http.ListenAndServe(addr, r); err != nil {
		panic(err)
	}
}
