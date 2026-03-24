package main

import (
	"context"
	"encoding/json"
	"fmt"
	"log"
	"net/http"
	"net/url"
	"sort"
	"strconv"
	"strings"
	"time"
)

type DawarichClient struct {
	baseURL    string
	apiKey     string
	httpClient *http.Client
}

func newDawarichClient(baseURL, apiKey string) *DawarichClient {
	return &DawarichClient{
		baseURL:    strings.TrimRight(baseURL, "/"),
		apiKey:     apiKey,
		httpClient: &http.Client{Timeout: 2 * time.Minute},
	}
}

func (c *DawarichClient) doRequest(ctx context.Context, rawURL string) (*http.Response, error) {
	parsed, err := url.Parse(rawURL)
	if err != nil {
		return nil, fmt.Errorf("invalid URL: %w", err)
	}
	query := parsed.Query()
	query.Set("api_key", c.apiKey)
	parsed.RawQuery = query.Encode()

	req, err := http.NewRequestWithContext(ctx, http.MethodGet, parsed.String(), nil)
	if err != nil {
		return nil, err
	}
	req.Header.Set("Accept", "application/json")
	return c.httpClient.Do(req)
}

func (c *DawarichClient) validateConnection(ctx context.Context) error {
	resp, err := c.doRequest(ctx, c.baseURL+"/api/v1/tracks")
	if err != nil {
		return fmt.Errorf("connection failed: %w", err)
	}
	defer resp.Body.Close()
	if resp.StatusCode == http.StatusUnauthorized {
		return fmt.Errorf("invalid API key")
	}
	if resp.StatusCode != http.StatusOK {
		return fmt.Errorf("unexpected status %d", resp.StatusCode)
	}
	return nil
}

func (c *DawarichClient) listTracks(ctx context.Context) ([]DawarichTrackListItem, error) {
	resp, err := c.doRequest(ctx, c.baseURL+"/api/v1/tracks")
	if err != nil {
		return nil, fmt.Errorf("list tracks: %w", err)
	}
	defer resp.Body.Close()
	if resp.StatusCode != http.StatusOK {
		return nil, fmt.Errorf("list tracks: status %d", resp.StatusCode)
	}

	var fc DawarichFeatureCollection
	if err := json.NewDecoder(resp.Body).Decode(&fc); err != nil {
		return nil, fmt.Errorf("list tracks: decode: %w", err)
	}

	items := make([]DawarichTrackListItem, 0, len(fc.Features))
	for _, f := range fc.Features {
		items = append(items, DawarichTrackListItem{
			ID:         f.Properties.ID,
			Name:       f.Properties.Name,
			StartedAt:  f.Properties.StartedAt,
			FinishedAt: f.Properties.FinishedAt,
			Distance:   f.Properties.Distance,
			Duration:   f.Properties.Duration,
		})
	}
	return items, nil
}

func (c *DawarichClient) getTrackPoints(ctx context.Context, trackID int) ([]DawarichPoint, error) {
	var allPoints []DawarichPoint
	page := 1
	perPage := 1000
	maxPages := 500

	for {
		if page > maxPages {
			break
		}
		url := fmt.Sprintf("%s/api/v1/tracks/%d/points?page=%d&per_page=%d", c.baseURL, trackID, page, perPage)
		resp, err := c.doRequest(ctx, url)
		if err != nil {
			return nil, fmt.Errorf("get track points page %d: %w", page, err)
		}
		if resp.StatusCode != http.StatusOK {
			resp.Body.Close()
			return nil, fmt.Errorf("get track points page %d: status %d", page, resp.StatusCode)
		}

		var points []DawarichPoint
		decodeErr := json.NewDecoder(resp.Body).Decode(&points)
		resp.Body.Close()
		if decodeErr != nil {
			return nil, fmt.Errorf("get track points page %d: decode: %w", page, decodeErr)
		}

		allPoints = append(allPoints, points...)

		totalPagesStr := resp.Header.Get("X-Total-Pages")
		if totalPagesStr == "" {
			break
		}
		totalPages, err := strconv.Atoi(totalPagesStr)
		if err != nil {
			log.Printf("[Dawarich] Non-numeric X-Total-Pages header %q for track %d", totalPagesStr, trackID)
			break
		}
		if page >= totalPages {
			break
		}
		page++
	}

	sort.Slice(allPoints, func(i, j int) bool {
		return allPoints[i].Timestamp < allPoints[j].Timestamp
	})

	return allPoints, nil
}
