import {NextResponse} from 'next/server';

import {searchPlacesFromNominatim} from '@/features/search/nominatim';
import {
	DEFAULT_GEOCODE_RESULT_LIMIT,
	GEOCODE_QUERY_MAX_LENGTH,
	GEOCODE_QUERY_MIN_LENGTH,
	GEOCODE_UPSTREAM_TIMEOUT_MS,
	GEOCODE_URL
} from '@/utils/geocoding';
import {getErrorMessage} from '@/utils/error';
import {hasControlChars} from '@/utils/string';

import type {TNominatimResult} from '@/shared/types/nominatim';
import type {NextRequest} from 'next/server';

const MAX_RESULTS = DEFAULT_GEOCODE_RESULT_LIMIT;
const RETRY_DELAY_MS = 500;
const NO_CACHE_HEADERS = {'Cache-Control': 'private, no-store, max-age=0'} as const; //eslint-disable-line

function validateQuery(raw: string | null): string | null {
	if (!raw) {
		return null;
	}
	const query = raw.trim();
	if (query.length < GEOCODE_QUERY_MIN_LENGTH || query.length > GEOCODE_QUERY_MAX_LENGTH) {
		return null;
	}
	if (hasControlChars(query)) {
		return null;
	}
	return query;
}

async function abortableDelay(ms: number, signal: AbortSignal): Promise<void> {
	return new Promise((resolve, reject) => {
		if (signal.aborted) {
			reject(signal.reason);
			return;
		}
		const onAbort = (): void => {
			clearTimeout(timer);
			reject(signal.reason);
		};
		const timer = setTimeout(() => {
			signal.removeEventListener('abort', onAbort);
			resolve();
		}, ms);
		signal.addEventListener('abort', onAbort, {once: true});
	});
}

async function attemptSearch(
	query: string,
	clientSignal: AbortSignal,
	acceptLanguage: string | undefined
): Promise<{results?: TNominatimResult[]; error?: unknown; hasTimedOut: boolean}> {
	const timeoutController = new AbortController();
	let hasTimedOut = false;
	const timeoutID = setTimeout(() => {
		hasTimedOut = true;
		timeoutController.abort();
	}, GEOCODE_UPSTREAM_TIMEOUT_MS);

	const handleClientAbort = (): void => timeoutController.abort();
	clientSignal.addEventListener('abort', handleClientAbort, {once: true});

	try {
		const results = await searchPlacesFromNominatim(query, {
			baseURL: GEOCODE_URL,
			limit: MAX_RESULTS,
			signal: timeoutController.signal,
			acceptLanguage
		});
		return {results, hasTimedOut: false};
	} catch (error) {
		return {error, hasTimedOut};
	} finally {
		clearTimeout(timeoutID);
		clientSignal.removeEventListener('abort', handleClientAbort);
	}
}

export async function GET(request: NextRequest): Promise<NextResponse> {
	const query = validateQuery(request.nextUrl.searchParams.get('q'));
	if (!query) {
		return NextResponse.json(
			{error: `Query must be ${GEOCODE_QUERY_MIN_LENGTH}-${GEOCODE_QUERY_MAX_LENGTH} characters.`},
			{status: 400}
		);
	}

	const acceptLanguage = request.headers.get('accept-language') ?? undefined;

	const first = await attemptSearch(query, request.signal, acceptLanguage);
	if (first.results) {
		return NextResponse.json(first.results, {headers: NO_CACHE_HEADERS});
	}

	console.error('[geocode] First attempt failed:', first.error);

	if (request.signal.aborted) {
		return NextResponse.json({error: 'Geocode request aborted.'}, {status: 499});
	}

	try {
		await abortableDelay(RETRY_DELAY_MS, request.signal);
	} catch {
		return NextResponse.json({error: 'Geocode request aborted.'}, {status: 499});
	}

	const second = await attemptSearch(query, request.signal, acceptLanguage);
	if (second.results) {
		return NextResponse.json(second.results, {headers: NO_CACHE_HEADERS});
	}

	console.error('[geocode] Retry failed:', second.error);

	const upstreamMessage = getErrorMessage(second.error, 'Unknown error');

	if (second.hasTimedOut) {
		return NextResponse.json({error: 'Geocode request timed out.', upstream: upstreamMessage}, {status: 504});
	}
	return NextResponse.json({error: 'Geocode provider request failed.', upstream: upstreamMessage}, {status: 502});
}
