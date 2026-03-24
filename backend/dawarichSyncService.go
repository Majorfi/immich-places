package main

import (
	"context"
	"fmt"
	"log"
	"strconv"
	"sync"
	"time"
)

type dawarichSyncProgress struct {
	currentTrack int
	totalTracks  int
}

type DawarichSyncService struct {
	db           *Database
	dawarichURL  string
	mu           sync.Mutex
	userSyncing  map[string]bool
	userCancels  map[string]context.CancelFunc
	userProgress map[string]dawarichSyncProgress
	wg           sync.WaitGroup
	shutdownCtx  context.Context
}

func newDawarichSyncService(db *Database, dawarichURL string) *DawarichSyncService {
	return &DawarichSyncService{
		db:           db,
		dawarichURL:  dawarichURL,
		userSyncing:  make(map[string]bool),
		userCancels:  make(map[string]context.CancelFunc),
		userProgress: make(map[string]dawarichSyncProgress),
		shutdownCtx:  context.Background(),
	}
}

func (s *DawarichSyncService) isUserSyncing(userID string) bool {
	s.mu.Lock()
	defer s.mu.Unlock()
	return s.userSyncing[userID]
}

func (s *DawarichSyncService) getProgress(userID string) (dawarichSyncProgress, bool) {
	s.mu.Lock()
	defer s.mu.Unlock()
	p, ok := s.userProgress[userID]
	return p, ok && s.userSyncing[userID]
}

func (s *DawarichSyncService) setProgress(userID string, current, total int) {
	s.mu.Lock()
	s.userProgress[userID] = dawarichSyncProgress{currentTrack: current, totalTracks: total}
	s.mu.Unlock()
}

func (s *DawarichSyncService) triggerUserSync(userID, apiKey string) (string, bool) {
	s.mu.Lock()
	if s.userSyncing[userID] {
		s.mu.Unlock()
		return "already syncing", false
	}
	ctx, cancel := context.WithCancel(s.shutdownCtx)
	s.userSyncing[userID] = true
	s.userCancels[userID] = cancel
	s.mu.Unlock()

	client := newDawarichClient(s.dawarichURL, apiKey)
	s.wg.Add(1)
	go func() {
		defer s.wg.Done()
		defer func() {
			s.mu.Lock()
			s.userSyncing[userID] = false
			delete(s.userCancels, userID)
			delete(s.userProgress, userID)
			s.mu.Unlock()
			cancel()
		}()
		s.doUserSync(ctx, userID, client)
	}()

	return "sync started", true
}

func (s *DawarichSyncService) cancelUserSync(userID string) {
	s.mu.Lock()
	cancel := s.userCancels[userID]
	syncing := s.userSyncing[userID]
	s.mu.Unlock()

	if !syncing || cancel == nil {
		return
	}
	cancel()

	deadline := time.Now().Add(5 * time.Second)
	for time.Now().Before(deadline) {
		s.mu.Lock()
		stillSyncing := s.userSyncing[userID]
		s.mu.Unlock()
		if !stillSyncing {
			return
		}
		time.Sleep(10 * time.Millisecond)
	}
	log.Printf("[Dawarich] Cancel timeout for user %s", userID)
}

func (s *DawarichSyncService) doUserSync(ctx context.Context, userID string, client *DawarichClient) {
	log.Printf("[Dawarich] Starting sync for user %s", userID)
	s.db.deleteSyncState(context.Background(), userID, "lastDawarichSyncError")
	start := time.Now()

	tracks, err := client.listTracks(ctx)
	if err != nil {
		log.Printf("[Dawarich] List tracks failed for user %s: %v", userID, err)
		s.recordError(userID, fmt.Sprintf("list tracks: %v", err))
		return
	}

	trackRows := make([]DawarichTrackRow, 0, len(tracks))
	for _, t := range tracks {
		trackRows = append(trackRows, t.toRow())
	}

	if err := s.db.upsertDawarichTracks(ctx, userID, trackRows); err != nil {
		log.Printf("[Dawarich] Upsert tracks failed for user %s: %v", userID, err)
		s.recordError(userID, fmt.Sprintf("upsert tracks: %v", err))
		return
	}

	existingTracks, _ := s.db.getDawarichTracks(ctx, userID)
	existingMap := make(map[int]DawarichTrackRow, len(existingTracks))
	for _, et := range existingTracks {
		existingMap[et.ID] = et
	}

	s.setProgress(userID, 0, len(tracks))
	synced := 0

	for i, t := range tracks {
		if ctx.Err() != nil {
			log.Printf("[Dawarich] Cancelled for user %s at track %d/%d", userID, i+1, len(tracks))
			return
		}

		s.setProgress(userID, i+1, len(tracks))

		if existing, ok := existingMap[t.ID]; ok {
			if existing.Distance == t.Distance && existing.Duration == t.Duration && existing.FinishedAt == t.FinishedAt {
				continue
			}
		}

		synced++
		rawPoints, err := client.getTrackPoints(ctx, t.ID)
		if err != nil {
			log.Printf("[Dawarich] Fetch points failed for track %d user %s: %v", t.ID, userID, err)
			s.recordError(userID, fmt.Sprintf("fetch points track %d: %v", t.ID, err))
			return
		}

		pointRows := make([]DawarichTrackPointRow, 0, len(rawPoints))
		for _, p := range rawPoints {
			lat, errLat := strconv.ParseFloat(p.Latitude, 64)
			lon, errLon := strconv.ParseFloat(p.Longitude, 64)
			if errLat != nil || errLon != nil {
				continue
			}
			pointRows = append(pointRows, DawarichTrackPointRow{
				TrackID:   t.ID,
				Timestamp: p.Timestamp,
				Latitude:  lat,
				Longitude: lon,
				Altitude:  p.Altitude,
			})
		}

		if err := s.db.replaceDawarichTrackPoints(ctx, userID, t.ID, pointRows); err != nil {
			log.Printf("[Dawarich] Replace points failed for track %d user %s: %v", t.ID, userID, err)
			s.recordError(userID, fmt.Sprintf("store points track %d: %v", t.ID, err))
			return
		}
	}

	if len(tracks) > 0 {
		trackIDs := make([]int, len(tracks))
		for i, t := range tracks {
			trackIDs[i] = t.ID
		}
		if err := s.db.deleteDawarichTracksNotIn(ctx, userID, trackIDs); err != nil {
			log.Printf("[Dawarich] Cleanup stale tracks failed for user %s: %v", userID, err)
		}
	}

	now := time.Now().UTC().Format(time.RFC3339)
	if err := s.db.setSyncState(context.Background(), userID, "lastDawarichSyncAt", now); err != nil {
		log.Printf("[Dawarich] Failed to set lastDawarichSyncAt for user %s: %v", userID, err)
	}
	s.db.deleteSyncState(context.Background(), userID, "lastDawarichSyncError")

	log.Printf("[Dawarich] Completed for user %s: %d tracks (%d updated) in %v", userID, len(tracks), synced, time.Since(start))
}

func (s *DawarichSyncService) recordError(userID, reason string) {
	if err := s.db.setSyncState(context.Background(), userID, "lastDawarichSyncError", reason); err != nil {
		log.Printf("[Dawarich] Failed to record error for user %s: %v", userID, err)
	}
}

func (s *DawarichSyncService) syncUsers(users []UserRow) {
	for _, u := range users {
		if u.DawarichAPIKey == nil {
			continue
		}
		s.triggerUserSync(u.ID, *u.DawarichAPIKey)
	}
}

func (s *DawarichSyncService) runStartupSyncs(ctx context.Context, users []UserRow) {
	if s.dawarichURL == "" {
		return
	}
	s.syncUsers(users)
}

func (s *DawarichSyncService) startPeriodicSync(ctx context.Context, intervalMS int) {
	if s.dawarichURL == "" || intervalMS <= 0 {
		return
	}
	ticker := time.NewTicker(time.Duration(intervalMS) * time.Millisecond)
	s.wg.Add(1)
	go func() {
		defer s.wg.Done()
		defer ticker.Stop()
		for {
			select {
			case <-ticker.C:
				s.syncAllUsers(ctx)
			case <-ctx.Done():
				log.Println("[Dawarich] Periodic sync stopped")
				return
			}
		}
	}()
}

func (s *DawarichSyncService) syncAllUsers(ctx context.Context) {
	users, err := s.db.getUsersWithAPIKeys(ctx)
	if err != nil {
		log.Printf("[Dawarich] Periodic sync failed to load users: %v", err)
		return
	}
	s.syncUsers(users)
}
