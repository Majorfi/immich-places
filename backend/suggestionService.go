package main

import (
	"context"
	"errors"
	"fmt"
	"log"
	"math"
	"sort"
	"sync"
	"time"
)

var errAssetNotFound = errors.New("asset not found")

type albumClusterCache struct {
	updatedAt string
	clusters  []LocationCluster
}

type SuggestionService struct {
	db               SuggestionStore
	albumClustersMu  sync.Mutex
	albumClustersMap map[string]albumClusterCache
}

func newSuggestionService(db SuggestionStore) *SuggestionService {
	return &SuggestionService{
		db:               db,
		albumClustersMap: make(map[string]albumClusterCache),
	}
}

func (s *SuggestionService) getSuggestions(ctx context.Context, userID, assetID string, albumID string) (*SuggestionsResponse, error) {
	asset, err := s.db.getAssetByID(ctx, userID, assetID)
	if err != nil {
		return nil, fmt.Errorf("failed to get asset: %w", err)
	}
	if asset == nil {
		return nil, errAssetNotFound
	}

	dateRef := asset.DateTimeOriginal
	if dateRef == nil {
		dateRef = &asset.FileCreatedAt
	}

	response := &SuggestionsResponse{
		SameDayClusters:   []LocationCluster{},
		TwoDayClusters:    []LocationCluster{},
		WeeklyClusters:    []LocationCluster{},
		FrequentLocations: []LocationCluster{},
		AlbumClusters:     []LocationCluster{},
	}

	if albumID != "" {
		response.AlbumClusters = s.clusterAlbumAssets(ctx, userID, albumID)
	}

	weeklyAssets, err := s.db.getSameDayAssets(ctx, userID, *dateRef, 168)
	if err != nil {
		log.Printf("[Suggest] Failed to get weekly assets: %v", err)
		weeklyAssets = nil
	}

	refTime, parseErr := parseTimestamp(*dateRef)

	if weeklyAssets != nil && parseErr == nil {
		sameDayAssets := filterByHourRange(weeklyAssets, refTime, 12)
		twoDayAssets := filterByHourRange(weeklyAssets, refTime, 48)
		response.SameDayClusters = clusterAssets(sameDayAssets)
		response.TwoDayClusters = clusterAssets(twoDayAssets)
		response.WeeklyClusters = clusterAssets(weeklyAssets)
	} else {
		response.WeeklyClusters = clusterAssets(weeklyAssets)
	}

	freqLocs, err := s.db.getFrequentLocations(ctx, userID, frequentLocationsLimit)
	if err != nil {
		log.Printf("[Suggest] Failed to get frequent locations: %v", err)
	} else {
		for _, loc := range freqLocs {
			response.FrequentLocations = append(response.FrequentLocations, LocationCluster{
				Latitude:  loc.Latitude,
				Longitude: loc.Longitude,
				Label:     loc.Label,
				Count:     loc.AssetCount,
			})
		}
	}

	return response, nil
}

func (s *SuggestionService) clusterAlbumAssets(ctx context.Context, userID, albumID string) []LocationCluster {
	cacheKey := userID + ":" + albumID
	updatedAt, err := s.db.getAlbumUpdatedAt(ctx, userID, albumID)
	if err == nil {
		s.albumClustersMu.Lock()
		cached, ok := s.albumClustersMap[cacheKey]
		s.albumClustersMu.Unlock()
		if ok && cached.updatedAt == updatedAt {
			return cached.clusters
		}
	}

	assets, err := s.db.getGeolocatedAssetsByAlbum(ctx, userID, albumID)
	if err != nil {
		log.Printf("[Suggest] Failed to get geolocated album assets: %v", err)
		return nil
	}

	clusters := clusterAssets(assets)

	if updatedAt != "" {
		s.albumClustersMu.Lock()
		s.albumClustersMap[cacheKey] = albumClusterCache{updatedAt: updatedAt, clusters: clusters}
		s.albumClustersMu.Unlock()
	}

	return clusters
}

func filterByHourRange(assets []AssetRow, refTime time.Time, hoursRange int) []AssetRow {
	var filtered []AssetRow
	maxDuration := time.Duration(hoursRange) * time.Hour
	for _, a := range assets {
		if a.DateTimeOriginal == nil {
			continue
		}
		t, err := parseTimestamp(*a.DateTimeOriginal)
		if err != nil {
			continue
		}
		diff := refTime.Sub(t)
		if diff < 0 {
			diff = -diff
		}
		if diff <= maxDuration {
			filtered = append(filtered, a)
		}
	}
	return filtered
}

func clusterAssets(assets []AssetRow) []LocationCluster {
	type clusterData struct {
		latSum    float64
		lonSum    float64
		count     int
		labelHits map[string]int
	}
	clusters := make(map[string]*clusterData)

	for _, a := range assets {
		if a.Latitude == nil || a.Longitude == nil {
			continue
		}
		key := fmt.Sprintf("%.2f,%.2f", math.Round(*a.Latitude*100)/100, math.Round(*a.Longitude*100)/100)
		c, ok := clusters[key]
		if !ok {
			c = &clusterData{labelHits: make(map[string]int)}
			clusters[key] = c
		}
		c.latSum += *a.Latitude
		c.lonSum += *a.Longitude
		c.count++

		label := buildMetadataLabel(a.City, a.State, a.Country)
		if label != "" {
			c.labelHits[label]++
		}
	}

	var results []LocationCluster
	for _, c := range clusters {
		avgLat := c.latSum / float64(c.count)
		avgLon := c.lonSum / float64(c.count)
		label := mostFrequentLabel(c.labelHits)
		if label == "" {
			label = formatCoords(avgLat, avgLon)
		}
		results = append(results, LocationCluster{
			Latitude:  avgLat,
			Longitude: avgLon,
			Label:     label,
			Count:     c.count,
		})
	}

	sortClustersByCount(results)

	if len(results) > maxClusterResults {
		results = results[:maxClusterResults]
	}

	return results
}

func sortClustersByCount(clusters []LocationCluster) {
	sort.Slice(clusters, func(i, j int) bool {
		return clusters[i].Count > clusters[j].Count
	})
}

func buildMetadataLabel(city, state, country *string) string {
	deref := func(p *string) string {
		if p == nil {
			return ""
		}
		return *p
	}
	label := buildLabel(deref(city), "", "", deref(state), deref(country))
	if label == "Unknown" {
		return ""
	}
	return label
}

func mostFrequentLabel(hits map[string]int) string {
	best := ""
	bestCount := 0
	for label, count := range hits {
		if count > bestCount {
			best = label
			bestCount = count
		}
	}
	return best
}
