package config

import "os"

type Config struct {
	Port string
}

func Load() *Config {
	port := os.Getenv("CODEGEN_PORT")
	if port == "" {
		port = "8084"
	}
	return &Config{Port: port}
}
