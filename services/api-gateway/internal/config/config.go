package config

import (
	"os"
)

type Config struct {
	Port                       string
	DatabaseURL                string
	RedisURL                   string
	JWTSecret                  string
	PlatformGitHubClientID     string
	PlatformGitHubClientSecret string
	PlatformGitHubCallbackURL  string
	FrontendURL                string
	OAuthSecretsKey            string
}

func Load() *Config {
	return &Config{
		Port:                       getEnv("API_GATEWAY_PORT", "8080"),
		DatabaseURL:                getEnv("DATABASE_URL", "postgresql://backforge:backforge@localhost:5432/backforge"),
		RedisURL:                   getEnv("REDIS_URL", "redis://127.0.0.1:6379"),
		JWTSecret:                  getEnv("JWT_SECRET", "dev-secret-change-in-production"),
		PlatformGitHubClientID:     getEnvAny([]string{"PLATFORM_GITHUB_CLIENT_ID", "GITHUB_CLIENT_ID"}, ""),
		PlatformGitHubClientSecret: getEnvAny([]string{"PLATFORM_GITHUB_CLIENT_SECRET", "GITHUB_CLIENT_SECRET"}, ""),
		PlatformGitHubCallbackURL:  getEnvAny([]string{"PLATFORM_GITHUB_CALLBACK_URL", "GITHUB_CALLBACK_URL"}, "http://localhost:8080/auth/github/callback"),
		FrontendURL:                getEnv("FRONTEND_URL", "http://localhost:5173"),
		OAuthSecretsKey:            getEnvAny([]string{"OAUTH_SECRETS_KEY", "JWT_SECRET"}, "dev-secret-change-in-production"),
	}
}

func getEnv(key, defaultVal string) string {
	if val := os.Getenv(key); val != "" {
		return val
	}
	return defaultVal
}

func getEnvAny(keys []string, defaultVal string) string {
	for _, key := range keys {
		if val := os.Getenv(key); val != "" {
			return val
		}
	}
	return defaultVal
}
