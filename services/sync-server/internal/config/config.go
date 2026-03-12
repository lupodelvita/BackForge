package config

import (
	"os"
)

type Config struct {
	Port      string
	StorePath string
}

func Load() *Config {
	port := os.Getenv("SYNC_PORT")
	if port == "" {
		port = "8083"
	}
	storePath := os.Getenv("SYNC_STORE_PATH")
	if storePath == "" {
		storePath = "/tmp/backforge-sync-store"
	}
	return &Config{Port: port, StorePath: storePath}
}
