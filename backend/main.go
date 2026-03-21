package main

import (
	"context"
	"crypto/sha256"
	"encoding/hex"
	"fmt"
	"log"
	"net/http"
	"os/signal"
	"syscall"
	"time"
	_ "time/tzdata"
)

type contextKey string

const userContextKey contextKey = "user"

func getUserFromContext(r *http.Request) *UserRow {
	user, ok := r.Context().Value(userContextKey).(*UserRow)
	if !ok {
		return nil
	}
	return user
}

func main() {
	cfg, err := loadConfig()
	if err != nil {
		log.Fatalf("Failed to load config: %v", err)
	}

	db, err := newDatabase(cfg.DataDir, cfg.EncryptionKey)
	if err != nil {
		log.Fatalf("Failed to initialize database: %v", err)
	}
	defer db.close()

	immichFactory := newImmichClientFactory(cfg.ImmichURL)
	geocodeTimeout := time.Duration(cfg.GeocodeTimeoutSecs) * time.Second
	geocoder := newGeocodeProvider(cfg.GeocodeProvider, geocodeKeys{
		here:   cfg.HereAPIKey,
		google: cfg.GoogleAPIKey,
		legacy: cfg.GeocodeAPIKey,
	}, geocodeTimeout)
	log.Printf("Geocode provider: %s (timeout: %v)", describeProvider(geocoder), geocodeTimeout)
	syncService := newSyncService(db, immichFactory, geocoder)
	suggestions := newSuggestionService(db)
	handlers := newHandlers(db, immichFactory, cfg.ImmichExternalURL, syncService, suggestions, cfg.defaultTimezoneLocation, geocoder)
	libraryHandlers := newLibraryHandlers(db, immichFactory, syncService)
	authHandlers := newAuthHandlers(db, immichFactory, syncService, cfg.RegistrationEnabled, !cfg.AllowInsecure)
	dawarichHandlers := newDawarichHandlers(db, cfg.DawarichURL, cfg.defaultTimezoneLocation)

	authMux := http.NewServeMux()
	authMux.HandleFunc("POST /auth/register", authHandlers.handleRegister)
	authMux.HandleFunc("POST /auth/login", authHandlers.handleLogin)
	authMux.HandleFunc("POST /auth/logout", authHandlers.handleLogout)
	authMux.HandleFunc("GET /auth/status", authHandlers.handleAuthStatus)
	authMux.Handle("GET /auth/me", sessionMiddleware(db, http.HandlerFunc(authHandlers.handleMe)))
	authMux.Handle("PUT /auth/settings", sessionMiddleware(db, http.HandlerFunc(authHandlers.handleUpdateSettings)))

	protectedMux := http.NewServeMux()
	protectedMux.HandleFunc("GET /albums", handlers.handleGetAlbums)
	protectedMux.HandleFunc("GET /assets", handlers.handleGetAssets)
	protectedMux.HandleFunc("GET /assets/day-counts", handlers.handleGetAssetDayCounts)
	protectedMux.HandleFunc("GET /map-markers", handlers.handleGetMapMarkers)
	protectedMux.HandleFunc("GET /assets/{assetID}/thumbnail", handlers.handleGetThumbnail)
	protectedMux.HandleFunc("GET /assets/{assetID}/preview", handlers.handleGetPreview)
	protectedMux.HandleFunc("PUT /assets/{assetID}/location", handlers.handleUpdateLocation)
	protectedMux.HandleFunc("PUT /assets/{assetID}/hidden", handlers.handleUpdateHidden)
	protectedMux.HandleFunc("PUT /assets/bulk-hidden", handlers.handleBulkUpdateHidden)
	protectedMux.HandleFunc("GET /assets/{assetID}/suggestions", handlers.handleGetSuggestions)
	protectedMux.HandleFunc("GET /frequent-locations", handlers.handleGetFrequentLocations)
	protectedMux.HandleFunc("GET /assets/{assetID}/page-info", handlers.handleGetAssetPageInfo)
	protectedMux.HandleFunc("POST /sync", handlers.handleTriggerSync)
	protectedMux.HandleFunc("POST /sync/full", handlers.handleTriggerFullSync)
	protectedMux.HandleFunc("GET /sync/status", handlers.handleSyncStatus)
	protectedMux.HandleFunc("GET /libraries", libraryHandlers.handleGetLibraries)
	protectedMux.HandleFunc("PUT /libraries/{libraryID}", libraryHandlers.handleUpdateLibrary)
	protectedMux.HandleFunc("POST /libraries/refresh", libraryHandlers.handleRefreshLibraries)
	protectedMux.HandleFunc("GET /favorite-places", handlers.handleGetFavoritePlaces)
	protectedMux.HandleFunc("POST /favorite-places", handlers.handleAddFavoritePlace)
	protectedMux.HandleFunc("DELETE /favorite-places", handlers.handleRemoveFavoritePlace)
	protectedMux.HandleFunc("POST /gpx/preview", handlers.handleGPXPreview)
	protectedMux.HandleFunc("PUT /dawarich/settings", dawarichHandlers.handleDawarichSettings)
	protectedMux.HandleFunc("DELETE /dawarich/settings", dawarichHandlers.handleDeleteDawarichSettings)
	protectedMux.HandleFunc("GET /dawarich/tracks", dawarichHandlers.handleDawarichTracks)
	protectedMux.HandleFunc("POST /dawarich/preview", dawarichHandlers.handleDawarichPreview)
	protectedMux.HandleFunc("GET /geocode/search", handlers.handleGeocodeSearch)

	mainMux := http.NewServeMux()
	mainMux.HandleFunc("GET /health", handlers.handleHealth)
	mainMux.Handle("/auth/", authMux)
	mainMux.Handle("/", sessionMiddleware(db, protectedMux))

	handler := requestHardeningMiddleware(mainMux)

	ctx, stop := signal.NotifyContext(context.Background(), syscall.SIGTERM, syscall.SIGINT)
	defer stop()

	syncService.shutdownCtx = ctx

	users, err := db.getUsersWithAPIKeys(ctx)
	if err != nil {
		log.Printf("Failed to load users for startup sync: %v", err)
	} else {
		syncService.runStartupSyncs(ctx, users)
	}

	syncService.startPeriodicSync(ctx, cfg.SyncIntervalMS)

	addr := fmt.Sprintf(":%d", cfg.Port)

	server := &http.Server{
		Addr:              addr,
		Handler:           handler,
		ReadHeaderTimeout: 10 * time.Second,
		ReadTimeout:       30 * time.Second,
		WriteTimeout:      150 * time.Second,
		IdleTimeout:       120 * time.Second,
	}

	go func() {
		if cfg.TrustProxyTLS {
			log.Printf("Backend listening on %s (TLS terminated by reverse proxy)", addr)
		} else {
			log.Printf("Backend listening on %s (no TLS — ensure network is secure)", addr)
		}
		if err := server.ListenAndServe(); err != nil && err != http.ErrServerClosed {
			log.Fatalf("Server error: %v", err)
		}
	}()

	<-ctx.Done()
	log.Println("Shutting down...")

	shutdownCtx, cancel := context.WithTimeout(context.Background(), 30*time.Second)
	defer cancel()
	if err := server.Shutdown(shutdownCtx); err != nil {
		log.Printf("HTTP shutdown error: %v", err)
	}

	syncService.wg.Wait()
	log.Println("All sync goroutines completed")
}

const maxRequestBodyBytes = 10_000_000
const maxQueryLength = 2048

func requestHardeningMiddleware(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if len(r.URL.RawQuery) > maxQueryLength {
			writeError(w, http.StatusRequestURITooLong, "query string too long")
			return
		}
		if r.Method != http.MethodGet && r.Method != http.MethodHead {
			r.Body = http.MaxBytesReader(w, r.Body, maxRequestBodyBytes)
		}
		next.ServeHTTP(w, r)
	})
}

func sessionMiddleware(db *Database, next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		cookie, err := r.Cookie(sessionCookieName)
		if err != nil || cookie.Value == "" {
			writeError(w, http.StatusUnauthorized, "not authenticated")
			return
		}

		hash := sha256.Sum256([]byte(cookie.Value))
		tokenHash := hex.EncodeToString(hash[:])

		user, err := db.getSessionUser(r.Context(), tokenHash)
		if err != nil {
			log.Printf("Session middleware: DB error: %v", err)
			writeError(w, http.StatusInternalServerError, "internal error")
			return
		}
		if user == nil {
			writeError(w, http.StatusUnauthorized, "session expired")
			return
		}

		ctx := context.WithValue(r.Context(), userContextKey, user)
		next.ServeHTTP(w, r.WithContext(ctx))
	})
}
