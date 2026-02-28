package main

import (
	"context"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"
	"time"
)

func newTestAuthHandlers(t *testing.T) (*AuthHandlers, *Database) {
	t.Helper()
	db := newTestDB(t)
	factory := &ImmichClientFactory{
		baseURL:    "http://fake:2283",
		httpClient: &http.Client{Timeout: 5 * time.Second},
	}
	handlers := newAuthHandlers(db, factory, nil, true, false)
	return handlers, db
}

func TestRegisterSuccess(t *testing.T) {
	h, _ := newTestAuthHandlers(t)

	body := `{"email":"new@example.com","password":"securepass123"}`
	req := httptest.NewRequest("POST", "/auth/register", strings.NewReader(body))
	req.Header.Set("Content-Type", "application/json")
	rec := httptest.NewRecorder()

	h.handleRegister(rec, req)

	if rec.Code != http.StatusCreated {
		t.Fatalf("expected 201, got %d (body: %s)", rec.Code, rec.Body.String())
	}

	bodyBytes := rec.Body.Bytes()

	var resp TMeResponse
	if err := json.Unmarshal(bodyBytes, &resp); err != nil {
		t.Fatalf("decode register response: %v", err)
	}
	if resp.User.Email != "new@example.com" {
		t.Errorf("expected email new@example.com, got %s", resp.User.Email)
	}
	if resp.HasImmichAPIKey {
		t.Error("expected hasImmichAPIKey=false for new user")
	}

	var payload map[string]interface{}
	if err := json.Unmarshal(bodyBytes, &payload); err != nil {
		t.Fatalf("decode register payload: %v", err)
	}
	hasLibrariesValue, ok := payload["hasLibraries"]
	if !ok {
		t.Error("expected hasLibraries field to be present in register response")
	}
	hasLibraries, ok := hasLibrariesValue.(bool)
	if !ok {
		t.Errorf("expected hasLibraries to be a boolean, got %T", hasLibrariesValue)
	}
	if hasLibraries {
		t.Error("expected hasLibraries=false for new user")
	}

	cookies := rec.Result().Cookies()
	found := false
	for _, c := range cookies {
		if c.Name == sessionCookieName {
			found = true
			if !c.HttpOnly {
				t.Error("expected HttpOnly cookie")
			}
		}
	}
	if !found {
		t.Error("expected session cookie to be set")
	}
}

func TestRegisterDuplicateEmail(t *testing.T) {
	h, _ := newTestAuthHandlers(t)

	body := `{"email":"test@example.com","password":"securepass123"}`
	req := httptest.NewRequest("POST", "/auth/register", strings.NewReader(body))
	req.Header.Set("Content-Type", "application/json")
	rec := httptest.NewRecorder()

	h.handleRegister(rec, req)

	if rec.Code != http.StatusConflict {
		t.Errorf("expected 409 for duplicate email, got %d", rec.Code)
	}
}

func TestRegisterDisabled(t *testing.T) {
	db := newTestDB(t)
	factory := &ImmichClientFactory{
		baseURL:    "http://fake:2283",
		httpClient: &http.Client{Timeout: 5 * time.Second},
	}
	h := newAuthHandlers(db, factory, nil, false, false)

	body := `{"email":"new@example.com","password":"securepass123"}`
	req := httptest.NewRequest("POST", "/auth/register", strings.NewReader(body))
	req.Header.Set("Content-Type", "application/json")
	rec := httptest.NewRecorder()

	h.handleRegister(rec, req)

	if rec.Code != http.StatusForbidden {
		t.Errorf("expected 403 when registration disabled, got %d", rec.Code)
	}
}

func TestRegisterInvalidEmail(t *testing.T) {
	h, _ := newTestAuthHandlers(t)

	body := `{"email":"not-an-email","password":"securepass123"}`
	req := httptest.NewRequest("POST", "/auth/register", strings.NewReader(body))
	req.Header.Set("Content-Type", "application/json")
	rec := httptest.NewRecorder()

	h.handleRegister(rec, req)

	if rec.Code != http.StatusBadRequest {
		t.Errorf("expected 400 for invalid email, got %d", rec.Code)
	}
}

func TestRegisterShortPassword(t *testing.T) {
	h, _ := newTestAuthHandlers(t)

	body := `{"email":"new@example.com","password":"short"}`
	req := httptest.NewRequest("POST", "/auth/register", strings.NewReader(body))
	req.Header.Set("Content-Type", "application/json")
	rec := httptest.NewRecorder()

	h.handleRegister(rec, req)

	if rec.Code != http.StatusBadRequest {
		t.Errorf("expected 400 for short password, got %d", rec.Code)
	}
}

func TestLoginSuccess(t *testing.T) {
	h, _ := newTestAuthHandlers(t)

	regBody := `{"email":"login@example.com","password":"securepass123"}`
	regReq := httptest.NewRequest("POST", "/auth/register", strings.NewReader(regBody))
	regReq.Header.Set("Content-Type", "application/json")
	regRec := httptest.NewRecorder()
	h.handleRegister(regRec, regReq)
	if regRec.Code != http.StatusCreated {
		t.Fatalf("registration failed: %d", regRec.Code)
	}

	loginBody := `{"email":"login@example.com","password":"securepass123"}`
	loginReq := httptest.NewRequest("POST", "/auth/login", strings.NewReader(loginBody))
	loginReq.Header.Set("Content-Type", "application/json")
	loginRec := httptest.NewRecorder()

	h.handleLogin(loginRec, loginReq)

	if loginRec.Code != http.StatusOK {
		t.Fatalf("expected 200, got %d (body: %s)", loginRec.Code, loginRec.Body.String())
	}

	cookies := loginRec.Result().Cookies()
	found := false
	for _, c := range cookies {
		if c.Name == sessionCookieName && c.Value != "" {
			found = true
		}
	}
	if !found {
		t.Error("expected session cookie on login")
	}
}

func TestLoginIncludesLibraryAccessFlag(t *testing.T) {
	h, db := newTestAuthHandlers(t)
	ctx := context.Background()

	regBody := `{"email":"admin@example.com","password":"securepass123"}`
	regReq := httptest.NewRequest("POST", "/auth/register", strings.NewReader(regBody))
	regReq.Header.Set("Content-Type", "application/json")
	regRec := httptest.NewRecorder()
	h.handleRegister(regRec, regReq)
	if regRec.Code != http.StatusCreated {
		t.Fatalf("registration failed: %d", regRec.Code)
	}

	user, err := db.getUserByEmail(ctx, "admin@example.com")
	if err != nil || user == nil {
		t.Fatalf("failed to load registered user: %v", err)
	}
	db.setSyncState(ctx, user.ID, "hasLibraryAccess", "true")

	loginBody := `{"email":"admin@example.com","password":"securepass123"}`
	loginReq := httptest.NewRequest("POST", "/auth/login", strings.NewReader(loginBody))
	loginReq.Header.Set("Content-Type", "application/json")
	loginRec := httptest.NewRecorder()
	h.handleLogin(loginRec, loginReq)

	if loginRec.Code != http.StatusOK {
		t.Fatalf("expected 200, got %d", loginRec.Code)
	}

	var resp TMeResponse
	if err := json.NewDecoder(loginRec.Body).Decode(&resp); err != nil {
		t.Fatalf("decode login response: %v", err)
	}
	if !resp.HasLibraries {
		t.Error("expected hasLibraries=true")
	}
}

func TestLoginWrongPassword(t *testing.T) {
	h, _ := newTestAuthHandlers(t)

	regBody := `{"email":"wrong@example.com","password":"securepass123"}`
	regReq := httptest.NewRequest("POST", "/auth/register", strings.NewReader(regBody))
	regReq.Header.Set("Content-Type", "application/json")
	regRec := httptest.NewRecorder()
	h.handleRegister(regRec, regReq)

	loginBody := `{"email":"wrong@example.com","password":"wrongpassword"}`
	loginReq := httptest.NewRequest("POST", "/auth/login", strings.NewReader(loginBody))
	loginReq.Header.Set("Content-Type", "application/json")
	loginRec := httptest.NewRecorder()

	h.handleLogin(loginRec, loginReq)

	if loginRec.Code != http.StatusUnauthorized {
		t.Errorf("expected 401, got %d", loginRec.Code)
	}
}

func TestLoginNonexistentEmail(t *testing.T) {
	h, _ := newTestAuthHandlers(t)

	body := `{"email":"ghost@example.com","password":"securepass123"}`
	req := httptest.NewRequest("POST", "/auth/login", strings.NewReader(body))
	req.Header.Set("Content-Type", "application/json")
	rec := httptest.NewRecorder()

	h.handleLogin(rec, req)

	if rec.Code != http.StatusUnauthorized {
		t.Errorf("expected 401, got %d", rec.Code)
	}
}

func TestLogout(t *testing.T) {
	h, _ := newTestAuthHandlers(t)

	req := httptest.NewRequest("POST", "/auth/logout", nil)
	req.AddCookie(&http.Cookie{Name: sessionCookieName, Value: "some-token"})
	rec := httptest.NewRecorder()

	h.handleLogout(rec, req)

	if rec.Code != http.StatusOK {
		t.Errorf("expected 200, got %d", rec.Code)
	}

	cookies := rec.Result().Cookies()
	for _, c := range cookies {
		if c.Name == sessionCookieName && c.MaxAge >= 0 {
			t.Error("expected session cookie to be cleared (MaxAge < 0)")
		}
	}
}

func TestMeWithoutUser(t *testing.T) {
	h, _ := newTestAuthHandlers(t)

	req := httptest.NewRequest("GET", "/auth/me", nil)
	rec := httptest.NewRecorder()

	h.handleMe(rec, req)

	if rec.Code != http.StatusUnauthorized {
		t.Errorf("expected 401 without user context, got %d", rec.Code)
	}
}

func TestMeWithUser(t *testing.T) {
	h, _ := newTestAuthHandlers(t)

	req := withTestUser(httptest.NewRequest("GET", "/auth/me", nil))
	rec := httptest.NewRecorder()

	h.handleMe(rec, req)

	if rec.Code != http.StatusOK {
		t.Fatalf("expected 200, got %d", rec.Code)
	}

	var resp TMeResponse
	json.NewDecoder(rec.Body).Decode(&resp)
	if resp.User.ID != testUserID {
		t.Errorf("expected user ID %s, got %s", testUserID, resp.User.ID)
	}
	if !resp.HasImmichAPIKey {
		t.Error("expected hasImmichAPIKey=true for test user with key")
	}
}

func TestMeIncludesMapMarkerCount(t *testing.T) {
	h, db := newTestAuthHandlers(t)
	seedAsset(t, db, "a1", ptr(48.85), ptr(2.35), "2024-01-01T12:00:00Z")
	seedAsset(t, db, "a2", ptr(40.71), ptr(-74.0), "2024-01-02T12:00:00Z")

	req := withTestUser(httptest.NewRequest("GET", "/auth/me", nil))
	rec := httptest.NewRecorder()

	h.handleMe(rec, req)

	if rec.Code != http.StatusOK {
		t.Fatalf("expected 200, got %d (body: %s)", rec.Code, rec.Body.String())
	}

	var resp TMeResponse
	if err := json.NewDecoder(rec.Body).Decode(&resp); err != nil {
		t.Fatalf("decode me response: %v", err)
	}
	if resp.MapMarkerCount != 2 {
		t.Errorf("expected mapMarkerCount=2, got %d", resp.MapMarkerCount)
	}
}

func TestAuthStatus(t *testing.T) {
	h, _ := newTestAuthHandlers(t)

	req := httptest.NewRequest("GET", "/auth/status", nil)
	rec := httptest.NewRecorder()

	h.handleAuthStatus(rec, req)

	if rec.Code != http.StatusOK {
		t.Fatalf("expected 200, got %d", rec.Code)
	}

	var resp AuthStatusResponse
	json.NewDecoder(rec.Body).Decode(&resp)
	if !resp.RegistrationEnabled {
		t.Error("expected registrationEnabled=true")
	}
}

func TestUpdateSettingsClearingKeyResetsLibraryAccess(t *testing.T) {
	h, db := newTestAuthHandlers(t)
	ctx := context.Background()

	if err := db.setSyncState(ctx, testUserID, "hasLibraryAccess", "true"); err != nil {
		t.Fatalf("set hasLibraryAccess: %v", err)
	}

	req := withTestUser(httptest.NewRequest("PUT", "/auth/settings", strings.NewReader(`{"immichAPIKey":""}`)))
	req.Header.Set("Content-Type", "application/json")
	rec := httptest.NewRecorder()

	h.handleUpdateSettings(rec, req)

	if rec.Code != http.StatusOK {
		t.Fatalf("expected 200, got %d (body: %s)", rec.Code, rec.Body.String())
	}

	var resp TMeResponse
	if err := json.NewDecoder(rec.Body).Decode(&resp); err != nil {
		t.Fatalf("decode response: %v", err)
	}
	if resp.HasLibraries {
		t.Error("expected hasLibraries=false after clearing API key")
	}

	hasAccess, err := db.getSyncState(ctx, testUserID, "hasLibraryAccess")
	if err != nil {
		t.Fatalf("get hasLibraryAccess: %v", err)
	}
	if hasAccess == nil || *hasAccess != "false" {
		t.Fatalf("expected hasLibraryAccess=false in sync state, got %v", hasAccess)
	}
}

func TestSessionMiddlewareNoCookie(t *testing.T) {
	db := newTestDB(t)

	inner := http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		t.Error("inner handler should not be called")
	})
	handler := sessionMiddleware(db, inner)

	req := httptest.NewRequest("GET", "/protected", nil)
	rec := httptest.NewRecorder()
	handler.ServeHTTP(rec, req)

	if rec.Code != http.StatusUnauthorized {
		t.Errorf("expected 401 without cookie, got %d", rec.Code)
	}
}

func TestSessionMiddlewareInvalidToken(t *testing.T) {
	db := newTestDB(t)

	inner := http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		t.Error("inner handler should not be called")
	})
	handler := sessionMiddleware(db, inner)

	req := httptest.NewRequest("GET", "/protected", nil)
	req.AddCookie(&http.Cookie{Name: sessionCookieName, Value: "invalid-token"})
	rec := httptest.NewRecorder()
	handler.ServeHTTP(rec, req)

	if rec.Code != http.StatusUnauthorized {
		t.Errorf("expected 401 for invalid token, got %d", rec.Code)
	}
}
