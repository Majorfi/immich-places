package main

import (
	"context"
	"encoding/json"
	"fmt"
	"log"
	"net/http"
	"sync"
	"time"
)

// HereClient implements GeocodeProvider using the HERE Geocoding & Search API v1.
type HereClient struct {
	apiKey     string
	httpClient *http.Client
	cache      map[string]string
	cacheMu    sync.Mutex
}

func newHereClient(apiKey string, timeout time.Duration) *HereClient {
	return &HereClient{
		apiKey:     apiKey,
		httpClient: &http.Client{Timeout: timeout},
		cache:      make(map[string]string),
	}
}

// hereReverseResponse models the relevant fields from
// GET https://revgeocode.search.hereapi.com/v1/revgeocode
type hereReverseResponse struct {
	Items []struct {
		Title   string `json:"title"`
		Address struct {
			Label       string `json:"label"`
			City        string `json:"city"`
			State       string `json:"state"`
			County      string `json:"county"`
			Country     string `json:"country"`
			CountryName string `json:"countryName"`
		} `json:"address"`
	} `json:"items"`
}

func (h *HereClient) ReverseGeocode(ctx context.Context, lat, lon float64) (string, error) {
	key := fmt.Sprintf("%.2f,%.2f", lat, lon)

	h.cacheMu.Lock()
	if label, ok := h.cache[key]; ok {
		h.cacheMu.Unlock()
		return label, nil
	}
	h.cacheMu.Unlock()

	reqURL := fmt.Sprintf(
		"%s?at=%f,%f&apiKey=%s",
		hereReverseURL, lat, lon, h.apiKey,
	)

	req, err := http.NewRequestWithContext(ctx, "GET", reqURL, nil)
	if err != nil {
		return formatCoords(lat, lon), nil
	}

	resp, err := h.httpClient.Do(req)
	if err != nil {
		return formatCoords(lat, lon), nil
	}
	defer resp.Body.Close()

	if resp.StatusCode == http.StatusTooManyRequests {
		log.Printf("HERE API rate limited (429)")
		return formatCoords(lat, lon), nil
	}
	if resp.StatusCode != http.StatusOK {
		log.Printf("HERE reverse geocode returned status %d", resp.StatusCode)
		return formatCoords(lat, lon), nil
	}

	var result hereReverseResponse
	if err := json.NewDecoder(resp.Body).Decode(&result); err != nil {
		return formatCoords(lat, lon), nil
	}

	if len(result.Items) == 0 {
		return formatCoords(lat, lon), nil
	}

	item := result.Items[0]
	label := buildLabel(
		item.Address.City,
		item.Address.County,
		"",
		item.Address.State,
		item.Address.CountryName,
	)

	h.cacheMu.Lock()
	if len(h.cache) >= maxGeocodeCacheSize {
		h.cache = make(map[string]string)
	}
	h.cache[key] = label
	h.cacheMu.Unlock()

	return label, nil
}
