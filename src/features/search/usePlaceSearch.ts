'use client';

import {useCallback, useEffect, useRef, useState} from 'react';

import {SEARCH_CLICK_OUTSIDE_EVENT} from '@/features/search/constant';
import {searchPlaces} from '@/features/search/nominatim';
import {parseCoordinatePair} from '@/utils/coordinates';
import {getErrorMessage} from '@/utils/error';
import {parseCoordinateInput} from '@/utils/parseCoordinateInput';
import {PLACE_SEARCH_DEBOUNCE_MS} from '@/utils/search';

import type {TNominatimResult} from '@/shared/types/nominatim';
import type {RefObject} from 'react';

type TUsePlaceSearchArgs = {
	onLocationSelectedAction: (latitude: number, longitude: number) => void;
	onResultSelectedAction?: (result: TNominatimResult) => void;
	onResultPersistedAction?: (result: TNominatimResult) => void;
};

type TUsePlaceSearchReturn = {
	query: string;
	results: TNominatimResult[];
	error: string | null;
	isOpen: boolean;
	isSearching: boolean;
	wrapperRef: RefObject<HTMLDivElement | null>;
	handleChange: (value: string) => void;
	handleSelect: (result: TNominatimResult) => void;
	handleFocus: () => void;
	setQuery: (value: string) => void;
};

export function usePlaceSearch({
	onLocationSelectedAction,
	onResultSelectedAction,
	onResultPersistedAction
}: TUsePlaceSearchArgs): TUsePlaceSearchReturn {
	const [query, setQuery] = useState('');
	const [results, setResults] = useState<TNominatimResult[]>([]);
	const [error, setError] = useState<string | null>(null);
	const [isOpen, setIsOpen] = useState(false);
	const [isSearching, setIsSearching] = useState(false);
	const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
	const wrapperRef = useRef<HTMLDivElement>(null);
	const requestIDRef = useRef(0);
	const abortRef = useRef<AbortController | null>(null);

	const doSearch = useCallback(async (nextQuery: string) => {
		if (!nextQuery.trim()) {
			abortRef.current?.abort();
			setResults([]);
			setError(null);
			setIsSearching(false);
			return;
		}
		requestIDRef.current += 1;
		const requestID = requestIDRef.current;
		abortRef.current?.abort();
		const controller = new AbortController();
		abortRef.current = controller;

		setIsSearching(true);
		try {
			const data = await searchPlaces(nextQuery, controller.signal);
			if (requestIDRef.current !== requestID) {
				return;
			}
			const seen = new Set<string>();
			const deduped = data.filter(r => {
				if (seen.has(r.displayName)) {
					return false;
				}
				seen.add(r.displayName);
				return true;
			});
			setResults(deduped);
			setIsOpen(deduped.length > 0);
			setError(null);
		} catch (error) {
			if (controller.signal.aborted) {
				return;
			}
			if (requestIDRef.current !== requestID) {
				return;
			}
			setResults([]);
			setError(getErrorMessage(error, 'Failed to search locations'));
		} finally {
			if (requestIDRef.current === requestID) {
				setIsSearching(false);
			}
		}
	}, []);

	const handleChange = useCallback(
		(value: string) => {
			setQuery(value);
			if (timerRef.current) {
				clearTimeout(timerRef.current);
			}
			if (!value.trim()) {
				abortRef.current?.abort();
				setResults([]);
				setError(null);
				setIsOpen(false);
				setIsSearching(false);
				return;
			}
			const coordinates = parseCoordinateInput(value);
			if (coordinates) {
				abortRef.current?.abort();
				onLocationSelectedAction(coordinates.latitude, coordinates.longitude);
				setResults([]);
				setError(null);
				setIsOpen(false);
				setIsSearching(false);
				return;
			}
			timerRef.current = setTimeout(() => {
				void doSearch(value);
			}, PLACE_SEARCH_DEBOUNCE_MS);
		},
		[doSearch, onLocationSelectedAction]
	);

	const handleSelect = useCallback(
		(result: TNominatimResult) => {
			const coordinates = parseCoordinatePair(result.lat, result.lon);
			if (!coordinates) {
				return;
			}
			onLocationSelectedAction(coordinates.latitude, coordinates.longitude);
			onResultSelectedAction?.(result);
			onResultPersistedAction?.(result);
			setIsOpen(false);
			setError(null);
		},
		[onLocationSelectedAction, onResultSelectedAction, onResultPersistedAction]
	);

	const handleFocus = useCallback(() => {
		if (results.length > 0) {
			setIsOpen(true);
		}
	}, [results]);

	useEffect(() => {
		function handleClickOutside(event: MouseEvent): void {
			if (!wrapperRef.current || !(event.target instanceof Node)) {
				return;
			}
			if (!wrapperRef.current.contains(event.target)) {
				setIsOpen(false);
			}
		}
		document.addEventListener(SEARCH_CLICK_OUTSIDE_EVENT, handleClickOutside);
		return () => document.removeEventListener(SEARCH_CLICK_OUTSIDE_EVENT, handleClickOutside);
	}, []);

	useEffect(() => {
		return () => {
			if (timerRef.current) {
				clearTimeout(timerRef.current);
			}
			abortRef.current?.abort();
		};
	}, []);

	return {
		query,
		results,
		error,
		isOpen,
		isSearching,
		wrapperRef,
		setQuery,
		handleChange,
		handleSelect,
		handleFocus
	};
}
