package main

import (
	"context"
	"log"
	"strings"
	"time"
)

const (
	maxGeocodeCacheSize = 10000
	hereReverseURL      = "https://revgeocode.search.hereapi.com/v1/revgeocode"
)

// GeocodeProvider abstracts geocoding so different services
// (Nominatim, HERE, ...) can be swapped via configuration.
type GeocodeProvider interface {
	ReverseGeocode(ctx context.Context, lat, lon float64) (string, error)
	ForwardSearch(ctx context.Context, query string, limit int, lang string) ([]SearchResult, error)
}

// fallbackGeocoder tries the primary provider first; if the result looks like
// raw coordinates or "Unknown" it falls back to the secondary provider.
// This saves quota on paid APIs like HERE.
type fallbackGeocoder struct {
	primary   GeocodeProvider
	secondary GeocodeProvider
}

func (f *fallbackGeocoder) ReverseGeocode(ctx context.Context, lat, lon float64) (string, error) {
	label, err := f.primary.ReverseGeocode(ctx, lat, lon)
	if err != nil {
		log.Printf("[geocode] Reverse geocode: Nominatim failed, trying HERE: %v", err)
		return f.secondary.ReverseGeocode(ctx, lat, lon)
	}
	if isWeakResult(label, lat, lon) {
		better, secErr := f.secondary.ReverseGeocode(ctx, lat, lon)
		if secErr != nil {
			log.Printf("[geocode] Reverse geocode: HERE failed: %v", secErr)
			return label, nil
		}
		if !isWeakResult(better, lat, lon) {
			return better, nil
		}
	}
	return label, nil
}

func (f *fallbackGeocoder) ForwardSearch(ctx context.Context, query string, limit int, lang string) ([]SearchResult, error) {
	results, err := f.primary.ForwardSearch(ctx, query, limit, lang)
	if err != nil {
		log.Printf("[geocode] Forward search: Nominatim failed, trying HERE: %v", err)
		return f.secondary.ForwardSearch(ctx, query, limit, lang)
	}
	if len(results) == 0 {
		log.Printf("[geocode] Forward search: Nominatim returned 0 results for %q, trying HERE", query)
		fallbackResults, fallbackErr := f.secondary.ForwardSearch(ctx, query, limit, lang)
		if fallbackErr != nil {
			return nil, fallbackErr
		}
		log.Printf("[geocode] Forward search: HERE returned %d results for %q", len(fallbackResults), query)
		return fallbackResults, nil
	}
	log.Printf("[geocode] Forward search: Nominatim returned %d results", len(results))
	return results, nil
}

// isWeakResult returns true when the geocode label is just formatted
// coordinates or the literal "Unknown" -- meaning the provider had no
// real data for that location.
func isWeakResult(label string, lat, lon float64) bool {
	if label == "Unknown" {
		return true
	}
	coords := formatCoords(lat, lon)
	return strings.TrimSpace(label) == strings.TrimSpace(coords)
}

func newGeocodeProvider(provider, apiKey string, timeout time.Duration) GeocodeProvider {
	switch provider {
	case "here":
		if apiKey == "" {
			log.Fatal("GEOCODE_API_KEY is required when GEOCODE_PROVIDER=here")
		}
		// Nominatim first, HERE as fallback to save quota
		return &fallbackGeocoder{
			primary:   newNominatimClient(timeout),
			secondary: newHereClient(apiKey, timeout),
		}
	case "nominatim", "":
		return newNominatimClient(timeout)
	default:
		log.Fatalf("Unknown GEOCODE_PROVIDER %q — supported: nominatim, here", provider)
		return nil
	}
}
