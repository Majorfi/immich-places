package main

import (
	"errors"
	"net/http"
)

const (
	mediaTypeAll   = "all"
	mediaTypeImage = "image"
	mediaTypeVideo = "video"

	immichAssetTypeImage = "IMAGE"
	immichAssetTypeVideo = "VIDEO"
)

func parseMediaTypeParam(r *http.Request) (string, error) {
	mediaType := r.URL.Query().Get("mediaType")
	if mediaType == "" {
		return mediaTypeAll, nil
	}
	if mediaType != mediaTypeAll && mediaType != mediaTypeImage && mediaType != mediaTypeVideo {
		return "", errors.New("mediaType must be one of: all, image, video")
	}
	return mediaType, nil
}

func mediaTypePredicate(column, mediaType string) string {
	switch mediaType {
	case mediaTypeImage:
		return ` AND ` + column + ` = '` + immichAssetTypeImage + `'`
	case mediaTypeVideo:
		return ` AND ` + column + ` = '` + immichAssetTypeVideo + `'`
	default:
		return ``
	}
}

func isSupportedAssetType(assetType string) bool {
	return assetType == immichAssetTypeImage || assetType == immichAssetTypeVideo
}
