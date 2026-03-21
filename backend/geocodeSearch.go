package main

import (
	"context"
	"encoding/json"
	"fmt"
	"net/http"
	"net/url"
	"strconv"
)

type SearchResult struct {
	PlaceID     int    `json:"placeID"`
	Lat         string `json:"lat"`
	Lon         string `json:"lon"`
	DisplayName string `json:"displayName"`
	Type        string `json:"type"`
}

func (n *NominatimClient) ForwardSearch(ctx context.Context, query string, limit int, lang string) ([]SearchResult, error) {
	if err := n.limiter.Wait(ctx); err != nil {
		return nil, fmt.Errorf("Nominatim rate limiter: %w", err)
	}

	params := url.Values{}
	params.Set("q", query)
	params.Set("format", "json")
	params.Set("limit", strconv.Itoa(limit))

	reqURL := "https://nominatim.openstreetmap.org/search?" + params.Encode()

	req, err := http.NewRequestWithContext(ctx, "GET", reqURL, nil)
	if err != nil {
		return nil, fmt.Errorf("Nominatim request build: %w", err)
	}
	req.Header.Set("User-Agent", "ImmichPlaces/1.0")
	if lang == "" {
		lang = "en"
	}
	req.Header.Set("Accept-Language", lang)

	resp, err := n.httpClient.Do(req)
	if err != nil {
		return nil, fmt.Errorf("Nominatim request: %w", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode == http.StatusTooManyRequests {
		n.adaptRateLimiter(resp)
		return nil, fmt.Errorf("Nominatim rate limited (429)")
	}
	if resp.StatusCode != http.StatusOK {
		return nil, fmt.Errorf("Nominatim search returned status %d", resp.StatusCode)
	}

	var raw []struct {
		PlaceID     int    `json:"place_id"`
		Lat         string `json:"lat"`
		Lon         string `json:"lon"`
		DisplayName string `json:"display_name"`
		Type        string `json:"type"`
	}
	if err := json.NewDecoder(resp.Body).Decode(&raw); err != nil {
		return nil, fmt.Errorf("Nominatim response decode: %w", err)
	}

	results := make([]SearchResult, len(raw))
	for i, item := range raw {
		results[i] = SearchResult{
			PlaceID:     item.PlaceID,
			Lat:         item.Lat,
			Lon:         item.Lon,
			DisplayName: item.DisplayName,
			Type:        item.Type,
		}
	}
	return results, nil
}

const hereForwardURL = "https://geocode.search.hereapi.com/v1/geocode"

func (h *HereClient) ForwardSearch(ctx context.Context, query string, limit int, lang string) ([]SearchResult, error) {
	if err := h.limiter.Wait(ctx); err != nil {
		return nil, fmt.Errorf("HERE rate limiter: %w", err)
	}

	params := url.Values{}
	params.Set("q", query)
	params.Set("limit", strconv.Itoa(limit))
	params.Set("apiKey", h.apiKey)
	if lang == "" {
		lang = "en"
	}
	params.Set("lang", lang)

	reqURL := hereForwardURL + "?" + params.Encode()

	req, err := http.NewRequestWithContext(ctx, "GET", reqURL, nil)
	if err != nil {
		return nil, fmt.Errorf("HERE request build: %w", err)
	}

	resp, err := h.httpClient.Do(req)
	if err != nil {
		return nil, fmt.Errorf("HERE request: %w", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode == http.StatusTooManyRequests {
		return nil, fmt.Errorf("HERE API rate limited (429)")
	}
	if resp.StatusCode != http.StatusOK {
		return nil, fmt.Errorf("HERE search returned status %d", resp.StatusCode)
	}

	var data struct {
		Items []struct {
			Title      string `json:"title"`
			ResultType string `json:"resultType"`
			Position   struct {
				Lat float64 `json:"lat"`
				Lng float64 `json:"lng"`
			} `json:"position"`
			Address struct {
				Label string `json:"label"`
			} `json:"address"`
		} `json:"items"`
	}
	if err := json.NewDecoder(resp.Body).Decode(&data); err != nil {
		return nil, fmt.Errorf("HERE response decode: %w", err)
	}

	results := make([]SearchResult, len(data.Items))
	for i, item := range data.Items {
		displayName := item.Address.Label
		if displayName == "" {
			displayName = item.Title
		}
		resultType := item.ResultType
		if resultType == "" {
			resultType = "place"
		}
		results[i] = SearchResult{
			PlaceID:     i + 1,
			Lat:         strconv.FormatFloat(item.Position.Lat, 'f', -1, 64),
			Lon:         strconv.FormatFloat(item.Position.Lng, 'f', -1, 64),
			DisplayName: displayName,
			Type:        resultType,
		}
	}
	return results, nil
}
