package main

import (
	"os"
	"testing"
)

func withCleanWorkDir(t *testing.T) {
	t.Helper()
	orig, _ := os.Getwd()
	dir := t.TempDir()
	os.Chdir(dir)
	t.Cleanup(func() { os.Chdir(orig) })
}

func TestLoadConfigRequiresImmichURL(t *testing.T) {
	withCleanWorkDir(t)
	t.Setenv("IMMICH_URL", "")

	t.Setenv("ENCRYPTION_KEY", "test-secret")

	_, err := loadConfig()
	if err == nil {
		t.Fatal("expected error when IMMICH_URL is missing")
	}
}

func TestLoadConfigSuccess(t *testing.T) {
	withCleanWorkDir(t)
	t.Setenv("IMMICH_URL", "http://test:2283")
	t.Setenv("ENCRYPTION_KEY", "test-secret")
	t.Setenv("PORT", "9090")
	t.Setenv("SYNC_INTERVAL_MS", "60000")

	cfg, err := loadConfig()
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if cfg.ImmichURL != "http://test:2283" {
		t.Errorf("expected ImmichURL http://test:2283, got %s", cfg.ImmichURL)
	}
	if cfg.Port != 9090 {
		t.Errorf("expected Port 9090, got %d", cfg.Port)
	}
	if cfg.SyncIntervalMS != 60000 {
		t.Errorf("expected SyncIntervalMS 60000, got %d", cfg.SyncIntervalMS)
	}
	if !cfg.RegistrationEnabled {
		t.Error("expected RegistrationEnabled to default to true")
	}
}

func TestLoadConfigInvalidPort(t *testing.T) {
	withCleanWorkDir(t)
	t.Setenv("IMMICH_URL", "http://test:2283")

	t.Setenv("ENCRYPTION_KEY", "test-secret")
	t.Setenv("PORT", "not-a-number")

	_, err := loadConfig()
	if err == nil {
		t.Fatal("expected error for invalid PORT")
	}
}

func TestLoadConfigInsecureRefused(t *testing.T) {
	withCleanWorkDir(t)
	t.Setenv("IMMICH_URL", "http://test:2283")

	t.Setenv("ENCRYPTION_KEY", "test-secret")
	t.Setenv("TRUST_PROXY_TLS", "false")

	_, err := loadConfig()
	if err == nil {
		t.Fatal("expected error when TRUST_PROXY_TLS=false without ALLOW_INSECURE")
	}
}

func TestLoadConfigInsecureAllowed(t *testing.T) {
	withCleanWorkDir(t)
	t.Setenv("IMMICH_URL", "http://test:2283")

	t.Setenv("ENCRYPTION_KEY", "test-secret")
	t.Setenv("TRUST_PROXY_TLS", "false")
	t.Setenv("ALLOW_INSECURE", "true")

	_, err := loadConfig()
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
}

func TestLoadConfigExternalURLFallback(t *testing.T) {
	withCleanWorkDir(t)
	t.Setenv("IMMICH_URL", "http://internal:2283")

	t.Setenv("ENCRYPTION_KEY", "test-secret")
	t.Setenv("IMMICH_EXTERNAL_URL", "")

	cfg, err := loadConfig()
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if cfg.ImmichExternalURL != "http://internal:2283" {
		t.Errorf("expected ImmichExternalURL to fall back to ImmichURL, got %s", cfg.ImmichExternalURL)
	}
}

func TestLoadConfigRegistrationDisabled(t *testing.T) {
	withCleanWorkDir(t)
	t.Setenv("IMMICH_URL", "http://test:2283")

	t.Setenv("ENCRYPTION_KEY", "test-secret")
	t.Setenv("REGISTRATION_ENABLED", "false")

	cfg, err := loadConfig()
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if cfg.RegistrationEnabled {
		t.Error("expected RegistrationEnabled to be false")
	}
}

func TestLoadConfigNeighborWindowOverride(t *testing.T) {
	withCleanWorkDir(t)
	t.Setenv("IMMICH_URL", "http://test:2283")
	t.Setenv("ENCRYPTION_KEY", "test-secret")
	t.Setenv("SUGGESTIONS_NEIGHBOR_WINDOW_HOURS", "24")

	cfg, err := loadConfig()
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if cfg.NeighborWindowHours != 24 {
		t.Errorf("expected NeighborWindowHours 24, got %d", cfg.NeighborWindowHours)
	}
}
