'use client';

import {useCallback, useEffect, useRef, useState} from 'react';

import {fetchTags} from '@/shared/services/backendApi';

import type {TTagRow} from '@/shared/types/tag';

type TUseTagsResult = {
	tags: TTagRow[];
	isLoading: boolean;
	error: string | null;
	load: () => Promise<void>;
};

export function useTags(enabled: boolean): TUseTagsResult {
	const [tags, setTags] = useState<TTagRow[]>([]);
	const [isLoading, setIsLoading] = useState(false);
	const [error, setError] = useState<string | null>(null);
	const abortRef = useRef<AbortController | null>(null);
	const hasLoadedRef = useRef(false);

	const load = useCallback(async () => {
		abortRef.current?.abort();
		const controller = new AbortController();
		abortRef.current = controller;

		setIsLoading(true);
		setError(null);
		try {
			const result = await fetchTags({signal: controller.signal});
			if (!controller.signal.aborted) {
				setTags(result);
				hasLoadedRef.current = true;
			}
		} catch (err) {
			if (controller.signal.aborted) {
				return;
			}
			if (err instanceof Error) {
				setError(err.message);
			} else {
				setError('Failed to load tags');
			}
		} finally {
			if (!controller.signal.aborted) {
				setIsLoading(false);
			}
		}
	}, []);

	useEffect(() => {
		if (enabled && !hasLoadedRef.current) {
			void load();
		}
	}, [enabled, load]);

	useEffect(() => {
		return () => {
			abortRef.current?.abort();
		};
	}, []);

	return {tags, isLoading, error, load};
}
