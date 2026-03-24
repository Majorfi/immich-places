package main

import (
	"context"
	"log"
	"strings"
	"time"
)

const maxGeocodeCacheSize = 10000

type GeocodeProvider interface {
	ReverseGeocode(ctx context.Context, lat, lon float64, lang string) (string, error)
	ForwardSearch(ctx context.Context, query string, limit int, lang string) ([]SearchResult, error)
}

type namedProvider struct {
	name     string
	provider GeocodeProvider
}

type chainGeocoder struct {
	chain []namedProvider
}

func (c *chainGeocoder) ReverseGeocode(ctx context.Context, lat, lon float64, lang string) (string, error) {
	var bestLabel string
	for _, np := range c.chain {
		label, err := np.provider.ReverseGeocode(ctx, lat, lon, lang)
		if err != nil {
			log.Printf("[Geocode] Reverse geocode: %s failed: %v", np.name, err)
			continue
		}
		if bestLabel == "" {
			bestLabel = label
		}
		if !isWeakResult(label, lat, lon) {
			return label, nil
		}
		log.Printf("[Geocode] Reverse geocode: %s returned weak result, trying next", np.name)
	}
	if bestLabel != "" {
		return bestLabel, nil
	}
	return formatCoords(lat, lon), nil
}

func (c *chainGeocoder) ForwardSearch(ctx context.Context, query string, limit int, lang string) ([]SearchResult, error) {
	var lastErr error
	for _, np := range c.chain {
		results, err := np.provider.ForwardSearch(ctx, query, limit, lang)
		if err != nil {
			log.Printf("[Geocode] Forward search: %s failed: %v", np.name, err)
			lastErr = err
			continue
		}
		if len(results) == 0 {
			log.Printf("[Geocode] Forward search: %s returned 0 results for %q, trying next", np.name, query)
			continue
		}
		log.Printf("[Geocode] Forward search: %s returned %d results", np.name, len(results))
		return results, nil
	}
	if lastErr != nil {
		return nil, lastErr
	}
	return nil, nil
}

func isWeakResult(label string, lat, lon float64) bool {
	if label == "Unknown" {
		return true
	}
	return strings.TrimSpace(label) == formatCoords(lat, lon)
}

type geocodeKeys struct {
	here   string
	google string
	legacy string
}

func resolveKey(provider string, keys geocodeKeys) string {
	switch provider {
	case "here":
		if keys.here != "" {
			return keys.here
		}
		return keys.legacy
	case "google":
		if keys.google != "" {
			return keys.google
		}
		return keys.legacy
	default:
		return ""
	}
}

func describeProvider(p GeocodeProvider) string {
	switch v := p.(type) {
	case *chainGeocoder:
		names := make([]string, len(v.chain))
		for i, np := range v.chain {
			names[i] = np.name
		}
		return strings.Join(names, " -> ")
	case *NominatimClient:
		return "Nominatim"
	default:
		return "unknown"
	}
}

func newGeocodeProvider(providerStr string, keys geocodeKeys, timeout time.Duration) GeocodeProvider {
	providerStr = strings.TrimSpace(providerStr)
	if providerStr == "" || providerStr == "nominatim" {
		return newNominatimClient(timeout)
	}

	chain := []namedProvider{
		{name: "Nominatim", provider: newNominatimClient(timeout)},
	}

	providers := strings.Split(providerStr, ",")
	for _, p := range providers {
		p = strings.TrimSpace(p)
		switch p {
		case "nominatim":
			continue
		case "here":
			apiKey := resolveKey(p, keys)
			if apiKey == "" {
				log.Fatal("HERE_API_KEY (or GEOCODE_API_KEY) is required when using here provider")
			}
			chain = append(chain, namedProvider{
				name:     "HERE",
				provider: newHereClient(apiKey, timeout),
			})
		case "google":
			apiKey := resolveKey(p, keys)
			if apiKey == "" {
				log.Fatal("GOOGLE_API_KEY (or GEOCODE_API_KEY) is required when using google provider")
			}
			chain = append(chain, namedProvider{
				name:     "Google",
				provider: newGoogleMapsClient(apiKey, timeout),
			})
		default:
			log.Fatalf("Unknown geocode provider %q — supported: nominatim, here, google", p)
		}
	}

	return &chainGeocoder{chain: chain}
}
