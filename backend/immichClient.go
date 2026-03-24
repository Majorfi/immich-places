package main

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"io"
	"log"
	"net/http"
	"time"

	"github.com/hashicorp/go-retryablehttp"
)

type ImmichClientFactory struct {
	baseURL    string
	httpClient *http.Client
}

type ImmichHTTPError struct {
	Operation  string
	StatusCode int
}

func (e *ImmichHTTPError) Error() string {
	return fmt.Sprintf("immich %s returned HTTP %d", e.Operation, e.StatusCode)
}

func newImmichClientFactory(baseURL string, debug bool) *ImmichClientFactory {
	retryClient := retryablehttp.NewClient()
	retryClient.RetryMax = 3
	retryClient.RetryWaitMin = 500 * time.Millisecond
	retryClient.RetryWaitMax = 5 * time.Second
	if debug {
		retryClient.Logger = log.Default()
	} else {
		retryClient.Logger = nil
	}

	httpClient := retryClient.StandardClient()
	httpClient.Timeout = 60 * time.Second

	return &ImmichClientFactory{
		baseURL:    baseURL,
		httpClient: httpClient,
	}
}

func (f *ImmichClientFactory) forUser(apiKey string) *ImmichClient {
	return &ImmichClient{
		baseURL:    f.baseURL,
		apiKey:     apiKey,
		httpClient: f.httpClient,
	}
}

func (f *ImmichClientFactory) validateAPIKey(ctx context.Context, apiKey string) error {
	req, err := http.NewRequestWithContext(ctx, "GET", f.baseURL+"/api/users/me", nil)
	if err != nil {
		return fmt.Errorf("failed to create request: %w", err)
	}
	req.Header.Set("x-api-key", apiKey)

	resp, err := f.httpClient.Do(req)
	if err != nil {
		return fmt.Errorf("failed to reach Immich: %w", err)
	}
	defer resp.Body.Close()
	io.Copy(io.Discard, resp.Body)

	if resp.StatusCode != http.StatusOK {
		return fmt.Errorf("Immich returned HTTP %d", resp.StatusCode)
	}
	return nil
}

type ImmichClient struct {
	baseURL    string
	apiKey     string
	httpClient *http.Client
}

func (c *ImmichClient) doRequest(ctx context.Context, method, path string, body interface{}) (*http.Response, error) {
	var bodyReader io.Reader
	if body != nil {
		jsonBytes, err := json.Marshal(body)
		if err != nil {
			return nil, fmt.Errorf("failed to marshal request body: %w", err)
		}
		bodyReader = bytes.NewReader(jsonBytes)
	}

	req, err := http.NewRequestWithContext(ctx, method, c.baseURL+path, bodyReader)
	if err != nil {
		return nil, fmt.Errorf("failed to create request: %w", err)
	}

	req.Header.Set("x-api-key", c.apiKey)
	if body != nil {
		req.Header.Set("Content-Type", "application/json")
	}

	return c.httpClient.Do(req)
}

func (c *ImmichClient) searchAssets(ctx context.Context, page int, pageSize int, updatedAfter *string) (*ImmichSearchResponse, error) {
	payload := map[string]interface{}{
		"type":       "IMAGE",
		"visibility": "timeline",
		"withExif":   true,
		"size":       pageSize,
		"page":       page,
	}
	if updatedAfter != nil {
		payload["updatedAfter"] = *updatedAfter
	}

	resp, err := c.doRequest(ctx, "POST", "/api/search/metadata", payload)
	if err != nil {
		return nil, err
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		io.Copy(io.Discard, resp.Body)
		return nil, fmt.Errorf("immich search returned HTTP %d", resp.StatusCode)
	}

	var result ImmichSearchResponse
	if err := json.NewDecoder(resp.Body).Decode(&result); err != nil {
		return nil, fmt.Errorf("failed to decode search response: %w", err)
	}
	return &result, nil
}

func (c *ImmichClient) bulkUpdateLocation(ctx context.Context, ids []string, lat, lon float64) error {
	payload := map[string]interface{}{
		"ids":       ids,
		"latitude":  lat,
		"longitude": lon,
	}

	resp, err := c.doRequest(ctx, "PUT", "/api/assets", payload)
	if err != nil {
		return err
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusNoContent {
		io.Copy(io.Discard, resp.Body)
		return fmt.Errorf("immich bulk update returned HTTP %d", resp.StatusCode)
	}
	return nil
}

func (c *ImmichClient) getStacks(ctx context.Context) ([]ImmichStackResponse, error) {
	resp, err := c.doRequest(ctx, "GET", "/api/stacks", nil)
	if err != nil {
		return nil, err
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		io.Copy(io.Discard, resp.Body)
		return nil, fmt.Errorf("immich getStacks returned HTTP %d", resp.StatusCode)
	}

	var stacks []ImmichStackResponse
	if err := json.NewDecoder(resp.Body).Decode(&stacks); err != nil {
		return nil, fmt.Errorf("failed to decode stacks response: %w", err)
	}
	return stacks, nil
}

func (c *ImmichClient) getThumbnail(ctx context.Context, assetID string) (*http.Response, error) {
	return c.doRequest(ctx, "GET", "/api/assets/"+assetID+"/thumbnail?size=thumbnail", nil)
}

func (c *ImmichClient) getPreview(ctx context.Context, assetID string) (*http.Response, error) {
	return c.doRequest(ctx, "GET", "/api/assets/"+assetID+"/thumbnail?size=preview", nil)
}

func (c *ImmichClient) getAlbums(ctx context.Context) ([]ImmichAlbumResponse, error) {
	resp, err := c.doRequest(ctx, "GET", "/api/albums", nil)
	if err != nil {
		return nil, err
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		io.Copy(io.Discard, resp.Body)
		return nil, fmt.Errorf("immich getAlbums returned HTTP %d", resp.StatusCode)
	}

	var albums []ImmichAlbumResponse
	if err := json.NewDecoder(resp.Body).Decode(&albums); err != nil {
		return nil, fmt.Errorf("failed to decode albums response: %w", err)
	}
	return albums, nil
}

func (c *ImmichClient) getLibraries(ctx context.Context) ([]ImmichLibraryResponse, error) {
	resp, err := c.doRequest(ctx, "GET", "/api/libraries", nil)
	if err != nil {
		return nil, err
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		io.Copy(io.Discard, resp.Body)
		return nil, &ImmichHTTPError{Operation: "getLibraries", StatusCode: resp.StatusCode}
	}

	var libraries []ImmichLibraryResponse
	if err := json.NewDecoder(resp.Body).Decode(&libraries); err != nil {
		return nil, fmt.Errorf("failed to decode libraries response: %w", err)
	}
	return libraries, nil
}

func (c *ImmichClient) getAlbumAssetIDs(ctx context.Context, albumID string) ([]string, error) {
	resp, err := c.doRequest(ctx, "GET", "/api/albums/"+albumID+"?withoutAssets=false", nil)
	if err != nil {
		return nil, err
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		io.Copy(io.Discard, resp.Body)
		return nil, fmt.Errorf("immich getAlbum returned HTTP %d", resp.StatusCode)
	}

	var detail ImmichAlbumDetailResponse
	if err := json.NewDecoder(resp.Body).Decode(&detail); err != nil {
		return nil, fmt.Errorf("failed to decode album detail response: %w", err)
	}

	ids := make([]string, len(detail.Assets))
	for i, a := range detail.Assets {
		ids[i] = a.ID
	}
	return ids, nil
}
