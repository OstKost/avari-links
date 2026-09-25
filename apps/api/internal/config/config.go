package config

import (
	"fmt"
	"strings"

	"github.com/caarlos0/env/v11"
)

// Config holds all configuration for the application.
type Config struct {
	Port               string   `env:"PORT" envDefault:"4820"`
	BaseURL            string   `env:"BASE_URL" envDefault:"http://localhost:4820"`
	DBPath             string   `env:"DB_PATH" envDefault:"./data/shortener.db"`
	Environment        string   `env:"ENVIRONMENT" envDefault:"development"`
	AllowedOrigins     []string `env:"ALLOWED_ORIGINS" envDefault:"http://localhost:4810,http://localhost:4800,http://127.0.0.1:4810"`
	CodeLength         int      `env:"CODE_LENGTH" envDefault:"6"`
	BlockedLinkDomains []string `env:"BLOCKED_LINK_DOMAINS"`
}

// Load loads configuration from environment variables with sensible defaults.
func Load() (*Config, error) {
	cfg := &Config{}
	if err := env.Parse(cfg); err != nil {
		return nil, fmt.Errorf("failed to parse config from environment: %w", err)
	}

	// Normalize base URL
	cfg.BaseURL = strings.TrimRight(cfg.BaseURL, "/")

	return cfg, nil
}

// IsProduction returns true if running in production mode.
func (c *Config) IsProduction() bool {
	return strings.ToLower(c.Environment) == "production"
}
