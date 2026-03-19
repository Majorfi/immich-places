package main

import (
	"context"
	"testing"
	"time"
)

func TestCreateAndGetUserByEmail(t *testing.T) {
	db := newTestDB(t)
	ctx := context.Background()

	if err := db.createUser(ctx, "u2", "alice@example.com", "hashed"); err != nil {
		t.Fatalf("createUser: %v", err)
	}

	user, err := db.getUserByEmail(ctx, "alice@example.com")
	if err != nil {
		t.Fatalf("getUserByEmail: %v", err)
	}
	if user == nil {
		t.Fatal("expected user, got nil")
	}
	if user.ID != "u2" {
		t.Errorf("expected ID u2, got %s", user.ID)
	}
	if user.Email != "alice@example.com" {
		t.Errorf("expected email alice@example.com, got %s", user.Email)
	}
}

func TestGetUserByEmailCaseInsensitive(t *testing.T) {
	db := newTestDB(t)
	ctx := context.Background()

	if err := db.createUser(ctx, "u2", "Alice@Example.COM", "hashed"); err != nil {
		t.Fatalf("createUser: %v", err)
	}

	user, err := db.getUserByEmail(ctx, "alice@example.com")
	if err != nil {
		t.Fatalf("getUserByEmail: %v", err)
	}
	if user == nil {
		t.Fatal("expected case-insensitive match")
	}
}

func TestGetUserByEmailNotFound(t *testing.T) {
	db := newTestDB(t)

	user, err := db.getUserByEmail(context.Background(), "nobody@example.com")
	if err != nil {
		t.Fatalf("getUserByEmail: %v", err)
	}
	if user != nil {
		t.Error("expected nil for nonexistent email")
	}
}

func TestGetUserByID(t *testing.T) {
	db := newTestDB(t)

	user, err := db.getUserByID(context.Background(), testUserID)
	if err != nil {
		t.Fatalf("getUserByID: %v", err)
	}
	if user == nil || user.ID != testUserID {
		t.Error("expected test user")
	}
}

func TestCreateDuplicateEmailFails(t *testing.T) {
	db := newTestDB(t)
	ctx := context.Background()

	err := db.createUser(ctx, "u2", "test@example.com", "hashed2")
	if err == nil {
		t.Error("expected error for duplicate email")
	}
}

func TestSessionCreateAndRetrieve(t *testing.T) {
	db := newTestDB(t)
	ctx := context.Background()

	expiresAt := time.Now().Add(time.Hour)
	if err := db.createSession(ctx, "token-hash-1", testUserID, expiresAt); err != nil {
		t.Fatalf("createSession: %v", err)
	}

	user, err := db.getSessionUser(ctx, "token-hash-1")
	if err != nil {
		t.Fatalf("getSessionUser: %v", err)
	}
	if user == nil {
		t.Fatal("expected user from valid session")
	}
	if user.ID != testUserID {
		t.Errorf("expected user ID %s, got %s", testUserID, user.ID)
	}
}

func TestSessionExpired(t *testing.T) {
	db := newTestDB(t)
	ctx := context.Background()

	expiresAt := time.Now().Add(-time.Hour)
	if err := db.createSession(ctx, "expired-hash", testUserID, expiresAt); err != nil {
		t.Fatalf("createSession: %v", err)
	}

	user, err := db.getSessionUser(ctx, "expired-hash")
	if err != nil {
		t.Fatalf("getSessionUser: %v", err)
	}
	if user != nil {
		t.Error("expected nil for expired session")
	}
}

func TestSessionNotFound(t *testing.T) {
	db := newTestDB(t)

	user, err := db.getSessionUser(context.Background(), "nonexistent-hash")
	if err != nil {
		t.Fatalf("getSessionUser: %v", err)
	}
	if user != nil {
		t.Error("expected nil for nonexistent session")
	}
}

func TestDeleteSession(t *testing.T) {
	db := newTestDB(t)
	ctx := context.Background()

	expiresAt := time.Now().Add(time.Hour)
	db.createSession(ctx, "delete-me", testUserID, expiresAt)

	if err := db.deleteSession(ctx, "delete-me"); err != nil {
		t.Fatalf("deleteSession: %v", err)
	}

	user, _ := db.getSessionUser(ctx, "delete-me")
	if user != nil {
		t.Error("expected nil after session deletion")
	}
}

func TestDeleteUserSessions(t *testing.T) {
	db := newTestDB(t)
	ctx := context.Background()

	expiresAt := time.Now().Add(time.Hour)
	db.createSession(ctx, "session-1", testUserID, expiresAt)
	db.createSession(ctx, "session-2", testUserID, expiresAt)

	if err := db.deleteUserSessions(ctx, testUserID); err != nil {
		t.Fatalf("deleteUserSessions: %v", err)
	}

	user1, _ := db.getSessionUser(ctx, "session-1")
	user2, _ := db.getSessionUser(ctx, "session-2")
	if user1 != nil || user2 != nil {
		t.Error("expected all sessions deleted")
	}
}

func TestDeleteExpiredSessions(t *testing.T) {
	db := newTestDB(t)
	ctx := context.Background()

	db.createSession(ctx, "expired", testUserID, time.Now().Add(-time.Hour))
	db.createSession(ctx, "valid", testUserID, time.Now().Add(time.Hour))

	if err := db.deleteExpiredSessions(ctx); err != nil {
		t.Fatalf("deleteExpiredSessions: %v", err)
	}

	user, _ := db.getSessionUser(ctx, "valid")
	if user == nil {
		t.Error("expected valid session to survive cleanup")
	}
}

func TestUpdateImmichAPIKey(t *testing.T) {
	db := newTestDB(t)
	ctx := context.Background()

	key := "test-api-key-123"
	if err := db.updateImmichAPIKey(ctx, testUserID, &key); err != nil {
		t.Fatalf("updateImmichAPIKey: %v", err)
	}

	user, _ := db.getUserByID(ctx, testUserID)
	if user.ImmichAPIKey == nil || *user.ImmichAPIKey != key {
		t.Errorf("expected API key %q, got %v", key, user.ImmichAPIKey)
	}

	if err := db.updateImmichAPIKey(ctx, testUserID, nil); err != nil {
		t.Fatalf("clear API key: %v", err)
	}

	user, _ = db.getUserByID(ctx, testUserID)
	if user.ImmichAPIKey != nil {
		t.Error("expected nil API key after clearing")
	}
}

func TestClaimLegacyDataNoLegacyUser(t *testing.T) {
	db := newTestDB(t)
	ctx := context.Background()

	err := db.claimLegacyData(ctx, testUserID)
	if err != nil {
		t.Fatalf("claimLegacyData should be no-op without __legacy__ user: %v", err)
	}
}

func TestClaimLegacyDataTransfersData(t *testing.T) {
	db := newTestDB(t)
	ctx := context.Background()

	db.createUser(ctx, "__legacy__", "__legacy__", "__placeholder__")

	db.upsertAssets(ctx, "__legacy__", []AssetRow{{
		ImmichID: "legacy-asset", Type: "IMAGE", OriginalFileName: "old.jpg",
		FileCreatedAt: "2024-01-01T12:00:00Z", Latitude: ptr(48.85), Longitude: ptr(2.35),
	}})
	db.upsertAlbum(ctx, "__legacy__", "legacy-album", "Old Album", nil, 1, "2024-01-01T00:00:00Z", nil)
	db.replaceAlbumAssets(ctx, "__legacy__", "legacy-album", []string{"legacy-asset"})

	if err := db.claimLegacyData(ctx, testUserID); err != nil {
		t.Fatalf("claimLegacyData: %v", err)
	}

	asset, _ := db.getAssetByID(ctx, testUserID, "legacy-asset")
	if asset == nil {
		t.Error("expected legacy asset transferred to new user")
	}

	albums, _ := db.getAlbumsWithGPSCount(ctx, testUserID, "", "")
	found := false
	for _, a := range albums {
		if a.ImmichID == "legacy-album" {
			found = true
		}
	}
	if !found {
		t.Error("expected legacy album transferred to new user")
	}

	legacyUser, _ := db.getUserByID(ctx, "__legacy__")
	if legacyUser != nil {
		t.Error("expected __legacy__ user to be deleted after claim")
	}
}
