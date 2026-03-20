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

// GeocodeProvider abstracts reverse geocoding so different services
// (Nominatim, HERE, ...) can be swapped via configuration.
type GeocodeProvider interface {
	ReverseGeocode(ctx context.Context, lat, lon float64) (string, error)
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
		return f.secondary.ReverseGeocode(ctx, lat, lon)
	}
	if isWeakResult(label, lat, lon) {
		better, err := f.secondary.ReverseGeocode(ctx, lat, lon)
		if err == nil && !isWeakResult(better, lat, lon) {
			return better, nil
		}
	}
	return label, nil
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
		log.Printf("Unknown GEOCODE_PROVIDER %q, falling back to nominatim", provider)
		return newNominatimClient(timeout)
	}
}
