package main

import "math"

func normalizeViewportLongitudes(west, east float64) (float64, float64) {
	if east < west {
		return west, east
	}
	if east-west >= 360 {
		return -180, 180
	}
	return wrapLongitude(west), wrapLongitude(east)
}

func wrapLongitude(lng float64) float64 {
	if lng >= -180 && lng <= 180 {
		return lng
	}
	wrapped := math.Mod(lng+180, 360)
	if wrapped < 0 {
		wrapped += 360
	}
	return wrapped - 180
}
