package main

import (
	"context"
	"errors"
	"fmt"
	"log"
	"sync"
	"time"

	"golang.org/x/sync/errgroup"
)

type tagWork struct {
	tag     ImmichTagResponse
	changed bool
}

type tagFetchResult struct {
	tagID     string
	assetIDs  []string
	updatedAt string
}

func (s *SyncService) syncTags(ctx context.Context, userID string, immich SyncImmichAPI, forceRefresh bool) error {
	log.Printf("[Sync] Syncing tags for user %s...", userID)

	listCtx, listCancel := context.WithTimeout(ctx, 30*time.Second)
	defer listCancel()
	tags, err := immich.getTags(listCtx)
	if err != nil {
		return fmt.Errorf("fetch tags: %w", err)
	}

	existingTags, err := s.db.getTagUpdatedAtMap(ctx, userID)
	if err != nil {
		return fmt.Errorf("get tag updatedAt map: %w", err)
	}

	tagIDs, changedWork := s.upsertTagMetadata(ctx, userID, tags, existingTags, forceRefresh)

	if err := s.fetchAndReplaceTagAssets(ctx, userID, changedWork, immich); err != nil {
		return err
	}

	if err := s.db.deleteTagsNotIn(ctx, userID, tagIDs); err != nil {
		log.Printf("[Sync] Failed to clean up stale tags for user %s: %v", userID, err)
	}

	log.Printf("[Sync] Tag sync completed for user %s: %d tags", userID, len(tags))
	return nil
}

func (s *SyncService) upsertTagMetadata(ctx context.Context, userID string, tags []ImmichTagResponse, existing map[string]string, forceRefresh bool) ([]string, []tagWork) {
	tagIDs := make([]string, 0, len(tags))
	work := make([]tagWork, 0, len(tags))

	for _, tag := range tags {
		tagIDs = append(tagIDs, tag.ID)

		if err := s.db.upsertTag(ctx, userID, tag.ID, tag.Name, tag.Value, tag.ParentID, tag.Color); err != nil {
			log.Printf("[Sync] Failed to upsert tag %s for user %s: %v", tag.ID, userID, err)
			continue
		}

		changed := forceRefresh || existing[tag.ID] != tag.UpdatedAt
		work = append(work, tagWork{tag: tag, changed: changed})
	}

	return tagIDs, work
}

func (s *SyncService) fetchAndReplaceTagAssets(ctx context.Context, userID string, work []tagWork, immich SyncImmichAPI) error {
	g := new(errgroup.Group)
	g.SetLimit(tagFetchLimit)
	var fetchMu sync.Mutex
	var fetched []tagFetchResult
	var fetchErrs []error

	for _, w := range work {
		if !w.changed {
			continue
		}
		tag := w.tag
		g.Go(func() error {
			fetchCtx, fetchCancel := context.WithTimeout(ctx, 60*time.Second)
			defer fetchCancel()
			assetIDs, err := immich.getTagAssetIDs(fetchCtx, tag.ID)
			fetchMu.Lock()
			defer fetchMu.Unlock()
			if err != nil {
				fetchErrs = append(fetchErrs, fmt.Errorf("fetch asset IDs for tag %s: %w", tag.ID, err))
				return nil
			}
			fetched = append(fetched, tagFetchResult{tagID: tag.ID, assetIDs: assetIDs, updatedAt: tag.UpdatedAt})
			return nil
		})
	}
	_ = g.Wait()

	for _, result := range fetched {
		if err := s.db.replaceTagAssets(ctx, userID, result.tagID, result.assetIDs); err != nil {
			fetchErrs = append(fetchErrs, fmt.Errorf("replace tag assets for %s: %w", result.tagID, err))
			continue
		}
		// Stamp updatedAt only after assets land, so a failed fetch leaves the tag
		// marked unsynced and it is re-detected as changed on the next sync.
		if err := s.db.setTagSynced(ctx, userID, result.tagID, result.updatedAt); err != nil {
			fetchErrs = append(fetchErrs, fmt.Errorf("mark tag %s synced for user %s: %w", result.tagID, userID, err))
		}
	}

	if len(fetchErrs) > 0 {
		return errors.Join(fetchErrs...)
	}
	return nil
}
