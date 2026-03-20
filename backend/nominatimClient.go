package main

import (
	"context"
	"encoding/json"
	"fmt"
	"log"
	"net/http"
	"strconv"
	"sync"
	"time"

	"golang.org/x/time/rate"
)

type NominatimClient struct {
	httpClient *http.Client
	cache      map[string]string
	cacheMu    sync.Mutex
	limiter    *rate.Limiter
}

func newNominatimClient(timeout time.Duration) *NominatimClient {
	return &NominatimClient{
		httpClient: &http.Client{Timeout: timeout},
		cache:      make(map[string]string),
		limiter:    rate.NewLimiter(rate.Every(time.Second), 1),
	}
}

func (n *NominatimClient) ReverseGeocode(ctx context.Context, lat, lon float64) (string, error) {
	key := fmt.Sprintf("%.2f,%.2f", lat, lon)

	n.cacheMu.Lock()
	if label, ok := n.cache[key]; ok {
		n.cacheMu.Unlock()
		return label, nil
	}
	n.cacheMu.Unlock()

	if err := n.limiter.Wait(ctx); err != nil {
		return formatCoords(lat, lon), nil
	}

	url := fmt.Sprintf(
		"https://nominatim.openstreetmap.org/reverse?lat=%f&lon=%f&format=json&zoom=14",
		lat, lon,
	)

	req, err := http.NewRequestWithContext(ctx, "GET", url, nil)
	if err != nil {
		return formatCoords(lat, lon), nil
	}
	req.Header.Set("User-Agent", "ImmichPlaces/1.0")
	req.Header.Set("Accept-Language", "en")

	resp, err := n.httpClient.Do(req)
	if err != nil {
		return formatCoords(lat, lon), nil
	}
	defer resp.Body.Close()

	if resp.StatusCode == http.StatusTooManyRequests {
		if retryAfter := resp.Header.Get("Retry-After"); retryAfter != "" {
			if seconds, err := strconv.Atoi(retryAfter); err == nil && seconds > 0 {
				n.limiter.SetLimit(rate.Every(time.Duration(seconds) * time.Second))
				log.Printf("Nominatim rate limited, adjusting to 1 request per %ds", seconds)
			} else if t, err := http.ParseTime(retryAfter); err == nil {
				delay := time.Until(t)
				if delay > 0 {
					n.limiter.SetLimit(rate.Every(delay))
					log.Printf("Nominatim rate limited, adjusting to 1 request per %v", delay.Round(time.Second))
				}
			}
		}
		return formatCoords(lat, lon), nil
	}
	if resp.StatusCode != http.StatusOK {
		return formatCoords(lat, lon), nil
	}

	var result struct {
		DisplayName string `json:"display_name"`
		Address     struct {
			City    string `json:"city"`
			Town    string `json:"town"`
			Village string `json:"village"`
			State   string `json:"state"`
			Country string `json:"country"`
		} `json:"address"`
	}
	if err := json.NewDecoder(resp.Body).Decode(&result); err != nil {
		return formatCoords(lat, lon), nil
	}

	label := buildLabel(result.Address.City, result.Address.Town, result.Address.Village, result.Address.State, result.Address.Country)

	n.cacheMu.Lock()
	if len(n.cache) >= maxGeocodeCacheSize {
		n.cache = make(map[string]string)
	}
	n.cache[key] = label
	n.cacheMu.Unlock()

	return label, nil
}

func buildLabel(city, town, village, state, country string) string {
	place := city
	if place == "" {
		place = town
	}
	if place == "" {
		place = village
	}

	var parts []string
	if place != "" {
		parts = append(parts, place)
	}
	if state != "" && state != place {
		parts = append(parts, state)
	}
	if country != "" {
		parts = append(parts, country)
	}

	if len(parts) == 0 {
		return "Unknown"
	}

	label := parts[0]
	for i := 1; i < len(parts); i++ {
		label += ", " + parts[i]
	}
	return label
}

func formatCoords(lat, lon float64) string {
	return fmt.Sprintf("%.4f, %.4f", lat, lon)
}
