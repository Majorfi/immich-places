import {backendFetch, parseJSON} from '@/shared/services/backendApi.fetch';
import {getClientBackendBaseURL} from '@/utils/client';
import {isRecord, isString} from '@/utils/typeGuards';

import type {TAuthErrorCode, TAuthUser, TMeResponse} from '@/shared/types/auth';

const BASE = getClientBackendBaseURL();

/**
 * Registration status payload returned by `/auth/status`.
 */
type TAuthStatusResponse = {
	registrationEnabled: boolean;
};

/**
 * Shared options available to authenticated API request helpers.
 */
type TAuthRequestOptions = {
	signal?: AbortSignal;
	timeoutMs?: number;
};

/**
 * Internal auth error with optional typed backend code.
 */
type TAuthError = Error & {code?: TAuthErrorCode};

/**
 * Creates an auth error with optional structured code.
 *
 * @param message - Error message.
 * @param code - Optional typed auth code.
 * @returns A typed Error instance.
 */
function createAuthError(message: string, code?: TAuthErrorCode): TAuthError {
	const error = new Error(message) as TAuthError;
	if (code) {
		error.code = code;
	}
	return error;
}

/**
 * Checks if an unknown error matches an auth error code.
 *
 * @param error - Error value from auth requests.
 * @param code - Code to compare against.
 * @returns True when error code matches.
 */
export function isAuthErrorWithCode(error: unknown, code: TAuthErrorCode): boolean {
	if (!(error instanceof Error)) {
		return false;
	}
	const authError = error as TAuthError;
	return authError.code === code;
}

/**
 * Runtime type guard for auth users.
 *
 * @param value - Value to validate.
 * @returns True when value is a valid `TAuthUser`.
 */
function isAuthUser(value: unknown): value is TAuthUser {
	if (!isRecord(value)) {
		return false;
	}
	return isString(value.ID) && isString(value.email) && isString(value.createdAt);
}

/**
 * Runtime type guard for `/auth/me` response payload.
 *
 * @param value - Value to validate.
 * @returns True when value matches `TMeResponse`.
 */
function isMeResponse(value: unknown): value is TMeResponse {
	if (!isRecord(value)) {
		return false;
	}
	return (
		isAuthUser(value.user) &&
		typeof value.hasImmichAPIKey === 'boolean' &&
		typeof value.hasLibraries === 'boolean' &&
		typeof value.mapMarkerCount === 'number'
	);
}

/**
 * Runtime type guard for `/auth/status` response payload.
 *
 * @param value - Value to validate.
 * @returns True when value matches `TAuthStatusResponse`.
 */
function isAuthStatusResponse(value: unknown): value is TAuthStatusResponse {
	if (!isRecord(value)) {
		return false;
	}
	return typeof value.registrationEnabled === 'boolean';
}

/**
 * Extracts error message from JSON body when present.
 *
 * @param value - Potential API response payload.
 * @returns Parsed error string or null.
 */
function extractAPIErrorMessage(value: unknown): string | null {
	if (!isRecord(value)) {
		return null;
	}
	const maybeError = value.error;
	return isString(maybeError) && maybeError.trim().length > 0 ? maybeError : null;
}

/**
 * Parses JSON while tolerating invalid payloads.
 *
 * @param response - Fetch response object.
 * @returns Parsed payload or null on failure.
 */
async function parseJSONSafe(response: Response): Promise<unknown | null> {
	try {
		return await response.json();
	} catch {
		return null;
	}
}

/**
 * Throws a descriptive error when response status is not `ok`.
 *
 * @param response - Fetch response.
 * @param fallbackPrefix - Fallback message used when no explicit message exists.
 */
async function throwIfErrorResponse(response: Response, fallbackPrefix: string): Promise<void> {
	if (response.ok) {
		return;
	}
	const payload = await parseJSONSafe(response);
	const errorMessage = extractAPIErrorMessage(payload);
	throw new Error(errorMessage ?? `${fallbackPrefix} (${response.status})`);
}

/**
 * Wrapper around `backendFetch` injecting request headers and timeout support.
 *
 * @param url - Endpoint URL.
 * @param init - Base request config.
 * @param opts - Auth request options.
 * @returns Fetch response.
 */
async function authFetch(url: string, init: RequestInit = {}, opts: TAuthRequestOptions = {}): Promise<Response> {
	const headers = new Headers(init.headers);
	if (!headers.has('Content-Type') && init.body) {
		headers.set('Content-Type', 'application/json');
	}
	return backendFetch(url, {...init, headers}, opts);
}

/**
 * Registers a new user.
 *
 * @param email - User email.
 * @param password - Password.
 * @returns Authenticated user response.
 */
export async function register(email: string, password: string): Promise<TMeResponse> {
	const res = await authFetch(`${BASE}/auth/register`, {
		method: 'POST',
		body: JSON.stringify({email, password})
	});
	await throwIfErrorResponse(res, 'Registration failed');
	return parseJSON(res, isMeResponse, 'Invalid register response');
}

/**
 * Logs in an existing user.
 *
 * @param email - User email.
 * @param password - Password.
 * @returns Authenticated user response.
 */
export async function login(email: string, password: string): Promise<TMeResponse> {
	const res = await authFetch(`${BASE}/auth/login`, {
		method: 'POST',
		body: JSON.stringify({email, password})
	});
	await throwIfErrorResponse(res, 'Login failed');
	return parseJSON(res, isMeResponse, 'Invalid login response');
}

/**
 * Logs out the current user and invalidates server session.
 */
export async function logout(): Promise<void> {
	const res = await authFetch(`${BASE}/auth/logout`, {method: 'POST'});
	if (!res.ok) {
		throw new Error(`Logout failed (${res.status})`);
	}
}

/**
 * Loads current user session and Immich API key status.
 *
 * @param opts - Request options (abort signal and timeout).
 * @returns Current auth session payload.
 */
export async function getMe(opts: TAuthRequestOptions = {}): Promise<TMeResponse> {
	const res = await authFetch(`${BASE}/auth/me`, {signal: opts.signal});
	if (!res.ok) {
		if (res.status === 401) {
			throw createAuthError('Not authenticated', 'notAuthenticated');
		}
		throw createAuthError(`Failed to load session (${res.status})`);
	}
	return parseJSON(res, isMeResponse, 'Invalid me response');
}

/**
 * Updates Immich API key in user settings.
 *
 * @param immichAPIKey - New API key, or null to clear it.
 * @returns Updated auth session payload.
 */
export async function updateSettings(immichAPIKey: string | null): Promise<TMeResponse> {
	const res = await authFetch(`${BASE}/auth/settings`, {
		method: 'PUT',
		body: JSON.stringify({immichAPIKey})
	});
	await throwIfErrorResponse(res, 'Update failed');
	return parseJSON(res, isMeResponse, 'Invalid settings response');
}

/**
 * Loads server auth status flags.
 *
 * @param opts - Request options.
 * @returns Whether registration is enabled.
 */
export async function getAuthStatus(opts: TAuthRequestOptions = {}): Promise<TAuthStatusResponse> {
	const res = await authFetch(`${BASE}/auth/status`, {signal: opts.signal});
	if (!res.ok) {
		throw new Error(`Failed to get auth status (${res.status})`);
	}
	return parseJSON(res, isAuthStatusResponse, 'Invalid auth status response');
}
