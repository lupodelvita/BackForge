package config

import (
	"os"
)

type Config struct {
	Port        string
	DatabaseURL string
	RedisURL    string
	JWTSecret   string
}

func Load() *Config {
	return &Config{
		Port:        getEnv("API_GATEWAY_PORT", "8080"),
		DatabaseURL: getEnv("DATABASE_URL", "postgresql://backforge:backforge@localhost:5432/backforge"),
		RedisURL:    getEnv("REDIS_URL", "redis://127.0.0.1:6379"),
		JWTSecret:   getEnv("JWT_SECRET", "dev-secret-change-in-production"),
	}
}

func getEnv(key, defaultVal string) string {
	if val := os.Getenv(key); val != "" {
		return val
	}
	return defaultVal
}
