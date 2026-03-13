package config

import (
	"os"
	"strconv"
)

type Config struct {
	Port int
}

func Load() Config {
	port := 8085
	if v := os.Getenv("METRICS_PORT"); v != "" {
		if p, err := strconv.Atoi(v); err == nil {
			port = p
		}
	}
	return Config{Port: port}
}
