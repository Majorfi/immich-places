package main

import (
	"context"
	"encoding/json"
	"fmt"
	"log"
	"net/http"
	"strconv"
	"strings"
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

func (n *NominatimClient) ReverseGeocode(ctx context.Context, lat, lon float64, lang string) (string, error) {
	key := fmt.Sprintf("%.2f,%.2f", lat, lon)

	n.cacheMu.Lock()
	if label, ok := n.cache[key]; ok {
		n.cacheMu.Unlock()
		return label, nil
	}
	n.cacheMu.Unlock()

	if err := n.limiter.Wait(ctx); err != nil {
		return "", fmt.Errorf("Nominatim rate limiter: %w", err)
	}

	url := fmt.Sprintf(
		"https://nominatim.openstreetmap.org/reverse?lat=%f&lon=%f&format=json&zoom=14",
		lat, lon,
	)

	req, err := http.NewRequestWithContext(ctx, "GET", url, nil)
	if err != nil {
		return "", fmt.Errorf("Nominatim request build: %w", err)
	}
	req.Header.Set("User-Agent", "ImmichPlaces/1.0")
	if lang == "" {
		lang = "en"
	}
	req.Header.Set("Accept-Language", lang)

	resp, err := n.httpClient.Do(req)
	if err != nil {
		return "", fmt.Errorf("Nominatim request: %w", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode == http.StatusTooManyRequests {
		n.adaptRateLimiter(resp)
		return "", fmt.Errorf("Nominatim rate limited (429)")
	}
	if resp.StatusCode != http.StatusOK {
		return "", fmt.Errorf("Nominatim returned status %d", resp.StatusCode)
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
		return "", fmt.Errorf("Nominatim response decode: %w", err)
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

func (n *NominatimClient) adaptRateLimiter(resp *http.Response) {
	retryAfter := resp.Header.Get("Retry-After")
	if retryAfter == "" {
		return
	}
	if seconds, err := strconv.Atoi(retryAfter); err == nil && seconds > 0 {
		n.limiter.SetLimit(rate.Every(time.Duration(seconds) * time.Second))
		log.Printf("[Geocode] Nominatim rate limited, adjusting to 1 request per %ds", seconds)
		go func() {
			time.Sleep(time.Duration(seconds) * time.Second)
			n.limiter.SetLimit(rate.Every(time.Second))
			log.Println("[Geocode] Nominatim rate limiter reset to 1 req/s")
		}()
	} else if t, err := http.ParseTime(retryAfter); err == nil {
		delay := time.Until(t)
		if delay > 0 {
			n.limiter.SetLimit(rate.Every(delay))
			log.Printf("[Geocode] Nominatim rate limited, adjusting to 1 request per %v", delay.Round(time.Second))
			go func() {
				time.Sleep(delay)
				n.limiter.SetLimit(rate.Every(time.Second))
				log.Println("[Geocode] Nominatim rate limiter reset to 1 req/s")
			}()
		}
	}
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
	return strings.Join(parts, ", ")
}

func formatCoords(lat, lon float64) string {
	return fmt.Sprintf("%.4f, %.4f", lat, lon)
}
