package main

import (
	"context"
	"crypto/rand"
	"crypto/sha256"
	"encoding/hex"
	"encoding/json"
	"fmt"
	"io"
	"log"
	"net/http"
	"time"

	"github.com/google/uuid"
	"golang.org/x/crypto/bcrypt"
)

const (
	sessionCookieName = "session"
	sessionDuration   = 30 * 24 * time.Hour
	bcryptCost        = 12
	sessionTokenBytes = 32
)

type AuthHandlers struct {
	db                  *Database
	immichFactory       *ImmichClientFactory
	syncService         *SyncService
	registrationEnabled bool
	secureCookie        bool
}

func newAuthHandlers(db *Database, factory *ImmichClientFactory, syncService *SyncService, registrationEnabled bool, secureCookie bool) *AuthHandlers {
	return &AuthHandlers{
		db:                  db,
		immichFactory:       factory,
		syncService:         syncService,
		registrationEnabled: registrationEnabled,
		secureCookie:        secureCookie,
	}
}

func generateSessionToken() (raw string, hashed string, err error) {
	b := make([]byte, sessionTokenBytes)
	if _, err := rand.Read(b); err != nil {
		return "", "", err
	}
	rawToken := hex.EncodeToString(b)
	hash := sha256.Sum256([]byte(rawToken))
	return rawToken, hex.EncodeToString(hash[:]), nil
}

func (h *AuthHandlers) setSessionCookie(w http.ResponseWriter, token string) {
	http.SetCookie(w, &http.Cookie{
		Name:     sessionCookieName,
		Value:    token,
		Path:     "/",
		HttpOnly: true,
		Secure:   h.secureCookie,
		SameSite: http.SameSiteLaxMode,
		MaxAge:   int(sessionDuration.Seconds()),
	})
}

func (h *AuthHandlers) clearSessionCookie(w http.ResponseWriter) {
	http.SetCookie(w, &http.Cookie{
		Name:     sessionCookieName,
		Value:    "",
		Path:     "/",
		HttpOnly: true,
		Secure:   h.secureCookie,
		SameSite: http.SameSiteLaxMode,
		MaxAge:   -1,
	})
}

func (h *AuthHandlers) createSessionForUser(w http.ResponseWriter, r *http.Request, userID string) error {
	rawToken, tokenHash, err := generateSessionToken()
	if err != nil {
		return err
	}
	expiresAt := time.Now().Add(sessionDuration)
	if err := h.db.createSession(r.Context(), tokenHash, userID, expiresAt); err != nil {
		return err
	}
	h.setSessionCookie(w, rawToken)
	return nil
}

func (h *AuthHandlers) handleRegister(w http.ResponseWriter, r *http.Request) {
	if !h.registrationEnabled {
		writeError(w, http.StatusForbidden, "registration is disabled")
		return
	}

	var req RegisterRequest
	decoder := json.NewDecoder(io.LimitReader(r.Body, 4096))
	decoder.DisallowUnknownFields()
	if err := decoder.Decode(&req); err != nil {
		writeError(w, http.StatusBadRequest, "invalid request body")
		return
	}
	if err := validate.Struct(req); err != nil {
		writeError(w, http.StatusBadRequest, "email must be valid and password must be at least 8 characters")
		return
	}

	existing, err := h.db.getUserByEmail(r.Context(), req.Email)
	if err != nil {
		log.Printf("[Auth] Register DB error checking email: %v", err)
		writeError(w, http.StatusInternalServerError, "internal error")
		return
	}
	if existing != nil {
		writeError(w, http.StatusConflict, "email already registered")
		return
	}

	hash, err := bcrypt.GenerateFromPassword([]byte(req.Password), bcryptCost)
	if err != nil {
		log.Printf("[Auth] Register bcrypt error: %v", err)
		writeError(w, http.StatusInternalServerError, "internal error")
		return
	}

	userID := uuid.New().String()
	if err := h.db.createUser(r.Context(), userID, req.Email, string(hash)); err != nil {
		log.Printf("[Auth] Register failed to create user: %v", err)
		writeError(w, http.StatusInternalServerError, "internal error")
		return
	}

	if err := h.db.claimLegacyData(r.Context(), userID); err != nil {
		log.Printf("[Auth] Register failed to claim legacy data: %v", err)
	}

	if err := h.createSessionForUser(w, r, userID); err != nil {
		log.Printf("[Auth] Register failed to create session: %v", err)
		writeError(w, http.StatusInternalServerError, "internal error")
		return
	}

	markerCount, err := h.db.countMapMarkers(r.Context(), userID, "", nil)
	if err != nil {
		log.Printf("[Auth] Register failed to count map markers for user %s: %v", userID, err)
	}
	writeJSON(w, http.StatusCreated, TMeResponse{
		User: UserRow{
			ID:    userID,
			Email: req.Email,
		},
		HasImmichAPIKey:        false,
		HasDawarichCredentials: false,
		HasLibraries:           false,
		MapMarkerCount:         markerCount,
	})
}

func (h *AuthHandlers) handleLogin(w http.ResponseWriter, r *http.Request) {
	var req LoginRequest
	decoder := json.NewDecoder(io.LimitReader(r.Body, 4096))
	decoder.DisallowUnknownFields()
	if err := decoder.Decode(&req); err != nil {
		writeError(w, http.StatusBadRequest, "invalid request body")
		return
	}
	if err := validate.Struct(req); err != nil {
		writeError(w, http.StatusBadRequest, "email and password are required")
		return
	}

	user, err := h.db.getUserByEmail(r.Context(), req.Email)
	if err != nil {
		log.Printf("[Auth] Login DB error: %v", err)
		writeError(w, http.StatusInternalServerError, "internal error")
		return
	}
	if user == nil {
		writeError(w, http.StatusUnauthorized, "invalid email or password")
		return
	}

	if err := bcrypt.CompareHashAndPassword([]byte(user.PasswordHash), []byte(req.Password)); err != nil {
		writeError(w, http.StatusUnauthorized, "invalid email or password")
		return
	}

	if err := h.createSessionForUser(w, r, user.ID); err != nil {
		log.Printf("[Auth] Login failed to create session: %v", err)
		writeError(w, http.StatusInternalServerError, "internal error")
		return
	}

	writeMeResponse(w, r, h.db, user)
}

func writeMeResponse(w http.ResponseWriter, r *http.Request, db *Database, user *UserRow) {
	resp, err := buildMeResponse(r.Context(), db, user)
	if err != nil {
		log.Printf("[Auth] buildMeResponse: %v", err)
		writeError(w, http.StatusInternalServerError, "internal error")
		return
	}
	writeJSON(w, http.StatusOK, resp)
}

func buildMeResponse(ctx context.Context, db *Database, user *UserRow) (TMeResponse, error) {
	hasLibAccess, err := db.getSyncState(ctx, user.ID, "hasLibraryAccess")
	if err != nil {
		return TMeResponse{}, fmt.Errorf("get hasLibraryAccess for user %s: %w", user.ID, err)
	}
	markerCount, err := db.countMapMarkers(ctx, user.ID, "", nil)
	if err != nil {
		return TMeResponse{}, fmt.Errorf("count map markers for user %s: %w", user.ID, err)
	}
	return TMeResponse{
		User:                   *user,
		HasImmichAPIKey:        user.ImmichAPIKey != nil,
		HasDawarichCredentials: user.DawarichAPIKey != nil,
		HasLibraries:           hasLibAccess != nil && *hasLibAccess == "true",
		MapMarkerCount:         markerCount,
	}, nil
}

func (h *AuthHandlers) handleLogout(w http.ResponseWriter, r *http.Request) {
	cookie, err := r.Cookie(sessionCookieName)
	if err == nil && cookie.Value != "" {
		hash := sha256.Sum256([]byte(cookie.Value))
		tokenHash := hex.EncodeToString(hash[:])
		h.db.deleteSession(r.Context(), tokenHash)
	}
	h.clearSessionCookie(w)
	writeJSON(w, http.StatusOK, map[string]string{"status": "ok"})
}

func (h *AuthHandlers) handleMe(w http.ResponseWriter, r *http.Request) {
	user := getUserFromContext(r)
	if user == nil {
		writeError(w, http.StatusUnauthorized, "not authenticated")
		return
	}
	writeMeResponse(w, r, h.db, user)
}

func (h *AuthHandlers) handleAuthStatus(w http.ResponseWriter, _ *http.Request) {
	writeJSON(w, http.StatusOK, AuthStatusResponse{
		RegistrationEnabled: h.registrationEnabled,
	})
}

func (h *AuthHandlers) handleUpdateSettings(w http.ResponseWriter, r *http.Request) {
	user := getUserFromContext(r)
	if user == nil {
		writeError(w, http.StatusUnauthorized, "not authenticated")
		return
	}

	var req UpdateAPIKeyRequest
	decoder := json.NewDecoder(io.LimitReader(r.Body, 4096))
	decoder.DisallowUnknownFields()
	if err := decoder.Decode(&req); err != nil {
		writeError(w, http.StatusBadRequest, "invalid request body")
		return
	}

	if req.ImmichAPIKey != nil && *req.ImmichAPIKey != "" {
		if err := h.immichFactory.validateAPIKey(r.Context(), *req.ImmichAPIKey); err != nil {
			writeError(w, http.StatusBadRequest, "invalid Immich API key: "+err.Error())
			return
		}
	}

	var keyToStore *string
	if req.ImmichAPIKey != nil && *req.ImmichAPIKey != "" {
		keyToStore = req.ImmichAPIKey
	}

	shouldReleaseSyncLock := false
	releaseSyncLock := func() {
		if !shouldReleaseSyncLock || h.syncService == nil {
			return
		}
		h.syncService.releaseUserSyncLock(user.ID)
		shouldReleaseSyncLock = false
	}
	defer releaseSyncLock()

	if keyToStore != nil && h.syncService != nil {
		lockCtx, lockCancel := context.WithTimeout(r.Context(), 5*time.Second)
		defer lockCancel()
		if err := h.syncService.pauseUserSync(lockCtx, user.ID); err != nil {
			log.Printf("[Auth] UpdateSettingsfailed to pause sync: %v", err)
			writeError(w, http.StatusServiceUnavailable, "failed to pause active sync")
			return
		}
		shouldReleaseSyncLock = true
	}

	if err := h.db.updateImmichAPIKey(r.Context(), user.ID, keyToStore); err != nil {
		log.Printf("[Auth] UpdateSettingsfailed to update API key: %v", err)
		writeError(w, http.StatusInternalServerError, "internal error")
		return
	}

	if keyToStore != nil {
		if err := h.db.deleteUserSyncData(r.Context(), user.ID); err != nil {
			log.Printf("[Auth] UpdateSettingsfailed to clear sync data: %v", err)
			writeError(w, http.StatusInternalServerError, "failed to clear previous sync data")
			return
		}
	}

	updated, err := h.db.getUserByID(r.Context(), user.ID)
	if err != nil || updated == nil {
		log.Printf("[Auth] UpdateSettingsfailed to refetch user: %v", err)
		writeError(w, http.StatusInternalServerError, "internal error")
		return
	}

	if keyToStore != nil {
		if h.syncService != nil {
			immich := h.immichFactory.forUser(*keyToStore)
			syncCtx, syncCancel := context.WithTimeout(context.Background(), 30*time.Second)
			defer syncCancel()
			if err := h.syncService.syncLibraries(syncCtx, user.ID, immich); err != nil {
				log.Printf("[Auth] UpdateSettingsinitial library sync failed: %v", err)
			}
			releaseSyncLock()
			h.syncService.triggerUserSync(user.ID, *keyToStore)
		}
	} else if req.ImmichAPIKey != nil {
		if err := h.db.setSyncState(r.Context(), user.ID, "hasLibraryAccess", "false"); err != nil {
			log.Printf("[Auth] UpdateSettingsfailed to reset hasLibraryAccess for user %s: %v", user.ID, err)
		}
	}

	writeMeResponse(w, r, h.db, updated)
}
