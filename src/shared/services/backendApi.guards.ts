import {isFiniteNumber, isNullableFiniteNumber, isNullableString, isRecord, isString} from '@/utils/typeGuards';

import type {TGPXMatchResult, TGPXPreviewResponse, TGPXTrackPoint} from '@/features/gpxImport/gpxImportTypes';
import type {TAlbumRow} from '@/shared/types/album';
import type {TAssetPageInfo, TPaginatedAssets} from '@/shared/types/asset';
import type {THealthResponse} from '@/shared/types/health';
import type {TLibraryRow} from '@/shared/types/library';
import type {TMapMarker} from '@/shared/types/map';
import type {TLocationCluster, TRawSuggestionsResponse, TSuggestionsResponse} from '@/shared/types/suggestion';

/**
 * Shared internal row predicate for asset payload entries.
 *
 * @param value - Unknown input value.
 * @returns `true` when value matches the expected asset row structure.
 */
function isAssetRow(value: unknown): boolean {
	if (!isRecord(value)) {
		return false;
	}
	return (
		isString(value.immichID) &&
		isString(value.type) &&
		isString(value.originalFileName) &&
		isString(value.fileCreatedAt) &&
		isNullableFiniteNumber(value.latitude) &&
		isNullableFiniteNumber(value.longitude) &&
		isNullableString(value.city) &&
		isNullableString(value.state) &&
		isNullableString(value.country) &&
		isNullableString(value.dateTimeOriginal) &&
		isString(value.syncedAt) &&
		(value.stackID === undefined || isNullableString(value.stackID)) &&
		(value.stackPrimaryAssetID === undefined || isNullableString(value.stackPrimaryAssetID)) &&
		(value.stackAssetCount === undefined || isNullableFiniteNumber(value.stackAssetCount)) &&
		typeof value.isHidden === 'boolean'
	);
}

/**
 * Type guard for paginated asset payloads.
 *
 * @param value - Unknown input value.
 * @returns `true` when value matches `TPaginatedAssets`.
 */
export function isPaginatedAssets(value: unknown): value is TPaginatedAssets {
	if (!isRecord(value)) {
		return false;
	}
	return (
		Array.isArray(value.items) &&
		value.items.every(isAssetRow) &&
		isFiniteNumber(value.total) &&
		isFiniteNumber(value.page) &&
		isFiniteNumber(value.pageSize) &&
		typeof value.hasNextPage === 'boolean'
	);
}

export function isTLocationCluster(value: unknown): value is TLocationCluster {
	if (!isRecord(value)) {
		return false;
	}
	return (
		isFiniteNumber(value.latitude) &&
		isFiniteNumber(value.longitude) &&
		isString(value.label) &&
		isFiniteNumber(value.count)
	);
}

/**
 * Type guard for suggestion response payloads.
 *
 * @param value - Unknown input value.
 * @returns `true` when value matches `TSuggestionsResponse`.
 */
export function isTSuggestionsResponse(value: unknown): value is TSuggestionsResponse {
	if (!isRecord(value)) {
		return false;
	}
	return (
		Array.isArray(value.sameDayClusters) &&
		value.sameDayClusters.every(isTLocationCluster) &&
		Array.isArray(value.twoDayClusters) &&
		value.twoDayClusters.every(isTLocationCluster) &&
		Array.isArray(value.weeklyClusters) &&
		value.weeklyClusters.every(isTLocationCluster) &&
		Array.isArray(value.frequentLocations) &&
		value.frequentLocations.every(isTLocationCluster) &&
		Array.isArray(value.albumClusters) &&
		value.albumClusters.every(isTLocationCluster)
	);
}

function isNullableLocationClusterArray(value: unknown): value is TLocationCluster[] | null {
	return value === null || (Array.isArray(value) && value.every(isTLocationCluster));
}

/**
 * Type guard for backend suggestion payloads before normalization.
 *
 * @param value - Unknown input value.
 * @returns `true` when value matches optional null-aware suggestion response shape.
 */
export function isTRawSuggestionsResponse(value: unknown): value is TRawSuggestionsResponse {
	if (!isRecord(value)) {
		return false;
	}
	return (
		isNullableLocationClusterArray(value.sameDayClusters) &&
		isNullableLocationClusterArray(value.twoDayClusters) &&
		isNullableLocationClusterArray(value.weeklyClusters) &&
		isNullableLocationClusterArray(value.frequentLocations) &&
		isNullableLocationClusterArray(value.albumClusters)
	);
}

/**
 * Type guard for album row payloads.
 *
 * @param value - Unknown input value.
 * @returns `true` when value matches `TAlbumRow`.
 */
export function isAlbumRow(value: unknown): value is TAlbumRow {
	if (!isRecord(value)) {
		return false;
	}
	return (
		isString(value.immichID) &&
		isString(value.albumName) &&
		isNullableString(value.thumbnailAssetID) &&
		isFiniteNumber(value.assetCount) &&
		isFiniteNumber(value.filteredCount) &&
		isFiniteNumber(value.noGPSCount) &&
		isString(value.updatedAt) &&
		isNullableString(value.startDate)
	);
}

/**
 * Type guard for map marker payloads.
 *
 * @param value - Unknown input value.
 * @returns `true` when value matches `TMapMarker`.
 */
export function isMapMarker(value: unknown): value is TMapMarker {
	if (!isRecord(value)) {
		return false;
	}
	return isString(value.immichID) && isFiniteNumber(value.latitude) && isFiniteNumber(value.longitude);
}

/**
 * Type guard for health response payloads.
 *
 * @param value - Unknown input value.
 * @returns `true` when value matches `THealthResponse`.
 */
export function isHealthResponse(value: unknown): value is THealthResponse {
	if (!isRecord(value)) {
		return false;
	}
	return (
		isString(value.status) &&
		isFiniteNumber(value.syncedAssets) &&
		isFiniteNumber(value.noGPSAssets) &&
		isNullableString(value.lastSyncAt) &&
		isString(value.immichURL) &&
		isFiniteNumber(value.syncVersion)
	);
}

/**
 * Type guard for asset page info payloads.
 *
 * @param value - Unknown input value.
 * @returns `true` when value matches `TAssetPageInfo`.
 */
export function isAssetPageInfo(value: unknown): value is TAssetPageInfo {
	if (!isRecord(value)) {
		return false;
	}
	return isFiniteNumber(value.page) && isNullableString(value.albumID);
}

/**
 * Type guard for sync status payloads.
 *
 * @param value - Unknown input value.
 * @returns `true` when value has a boolean `syncing` field.
 */
export function isSyncStatus(value: unknown): value is {syncing: boolean} {
	return isRecord(value) && typeof value.syncing === 'boolean';
}

export function isLibraryRow(value: unknown): value is TLibraryRow {
	if (!isRecord(value)) {
		return false;
	}
	return (
		isString(value.libraryID) &&
		isString(value.name) &&
		isFiniteNumber(value.assetCount) &&
		typeof value.isHidden === 'boolean' &&
		isString(value.syncedAt)
	);
}

function isGPXTrackPoint(value: unknown): value is TGPXTrackPoint {
	return isRecord(value) && isFiniteNumber(value.latitude) && isFiniteNumber(value.longitude);
}

function isGPXMatchResult(value: unknown): value is TGPXMatchResult {
	if (!isRecord(value)) {
		return false;
	}
	return (
		isString(value.assetID) &&
		isString(value.fileName) &&
		isFiniteNumber(value.latitude) &&
		isFiniteNumber(value.longitude) &&
		isFiniteNumber(value.elevation) &&
		isFiniteNumber(value.timeGap) &&
		typeof value.isAlreadyApplied === 'boolean'
	);
}

export function isGPXPreviewResponse(value: unknown): value is TGPXPreviewResponse {
	if (!isRecord(value)) {
		return false;
	}
	if (!isRecord(value.track)) {
		return false;
	}
	const track = value.track;
	if (
		typeof track.name !== 'string' ||
		!Array.isArray(track.points) ||
		!track.points.every(isGPXTrackPoint) ||
		!isString(track.startTime) ||
		!isString(track.endTime) ||
		!isFiniteNumber(track.pointCount)
	) {
		return false;
	}
	return (
		Array.isArray(value.matches) &&
		value.matches.every(isGPXMatchResult) &&
		typeof value.detectedTimezone === 'string'
	);
}
