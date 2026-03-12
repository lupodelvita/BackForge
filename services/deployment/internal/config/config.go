package config

import "os"

type Config struct {
	Port         string
	ProjectsRoot string
	DeploymentsDir string
	LogLevel     string
}

func Load() *Config {
	cfg := &Config{
		Port:           getEnv("DEPLOYMENT_SERVICE_PORT", "8082"),
		ProjectsRoot:   getEnv("BACKFORGE_PROJECTS_ROOT", defaultProjectsRoot()),
		DeploymentsDir: getEnv("BACKFORGE_DEPLOYMENTS_DIR", defaultDeploymentsDir()),
		LogLevel:       getEnv("LOG_LEVEL", "info"),
	}
	return cfg
}

func getEnv(key, fallback string) string {
	if v := os.Getenv(key); v != "" {
		return v
	}
	return fallback
}

func defaultProjectsRoot() string {
	// Mirrors the Rust CLI path: dirs::data_dir()/backforge/projects
	// On Linux: ~/.local/share/backforge/projects
	home := os.Getenv("HOME")
	if home == "" {
		home = "/root"
	}
	return home + "/.local/share/backforge/projects"
}

func defaultDeploymentsDir() string {
	home := os.Getenv("HOME")
	if home == "" {
		home = "/root"
	}
	return home + "/.backforge/deployments"
}
