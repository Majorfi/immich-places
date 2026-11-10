package main

import "math"

type markerGrid struct {
	cellLat float64
	cellLng float64
}

func newMarkerGrid(bounds *TViewportBounds, limit int) markerGrid {
	latSpan, lngSpan := 180.0, 360.0
	if bounds != nil {
		latSpan = bounds.North - bounds.South
		lngSpan = bounds.East - bounds.West
		if lngSpan < 0 {
			lngSpan += 360
		}
	}
	side := max(1, int(math.Sqrt(float64(limit)))-2)
	return markerGrid{
		cellLat: markerCellSize(latSpan, side),
		cellLng: markerCellSize(min(lngSpan, 360), side),
	}
}

func markerCellSize(span float64, side int) float64 {
	if span <= 0 {
		return 1
	}
	return span / float64(side)
}
