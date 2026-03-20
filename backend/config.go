package main

import (
	"fmt"
	"time"

	"github.com/caarlos0/env/v11"
	"github.com/joho/godotenv"
)

type Config struct {
	ImmichURL           string `env:"IMMICH_URL,notEmpty"`
	ImmichExternalURL   string `env:"IMMICH_EXTERNAL_URL"`
	Port                int    `env:"PORT" envDefault:"8082"`
	DataDir             string `env:"DATA_DIR" envDefault:"/data"`
	SyncIntervalMS      int    `env:"SYNC_INTERVAL_MS" envDefault:"300000"`
	TrustProxyTLS       bool   `env:"TRUST_PROXY_TLS" envDefault:"true"`
	AllowInsecure       bool   `env:"ALLOW_INSECURE" envDefault:"false"`
	RegistrationEnabled bool   `env:"REGISTRATION_ENABLED" envDefault:"true"`
	EncryptionKey       string `env:"ENCRYPTION_KEY,notEmpty"`
	DawarichURL         string `env:"DAWARICH_URL"`
	DefaultTimezone     string `env:"DEFAULT_TIMEZONE"`
	GeocodeProvider    string `env:"GEOCODE_PROVIDER" envDefault:"nominatim"`
	GeocodeAPIKey      string `env:"GEOCODE_API_KEY"`
	GeocodeTimeoutSecs int    `env:"GEOCODE_TIMEOUT" envDefault:"10"`

	defaultTimezoneLocation *time.Location
}

func loadConfig() (*Config, error) {
	godotenv.Load()

	cfg, err := env.ParseAs[Config]()
	if err != nil {
		return nil, err
	}

	if cfg.ImmichExternalURL == "" {
		cfg.ImmichExternalURL = cfg.ImmichURL
	}

	if cfg.SyncIntervalMS <= 0 {
		return nil, fmt.Errorf("SYNC_INTERVAL_MS must be > 0, got %d", cfg.SyncIntervalMS)
	}

	if !cfg.TrustProxyTLS && !cfg.AllowInsecure {
		return nil, fmt.Errorf("TRUST_PROXY_TLS is false and no TLS is configured; set ALLOW_INSECURE=true to run without TLS")
	}

	if cfg.DefaultTimezone != "" {
		loc, err := time.LoadLocation(cfg.DefaultTimezone)
		if err != nil {
			return nil, fmt.Errorf("invalid DEFAULT_TIMEZONE %q: %w", cfg.DefaultTimezone, err)
		}
		cfg.defaultTimezoneLocation = loc
	}

	return &cfg, nil
}
