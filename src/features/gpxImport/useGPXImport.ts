'use client';

import {useCallback, useState} from 'react';

import {gpxPreview} from '@/shared/services/backendApi';

import type {TGPXPreviewResponse} from '@/features/gpxImport/gpxImportTypes';

type TGPXImportStep = 'upload' | 'preview';

type TGPXImportState = {
	step: TGPXImportStep;
	isLoading: boolean;
	error: string | null;
	preview: TGPXPreviewResponse | null;
};

const INITIAL_STATE: TGPXImportState = {
	step: 'upload',
	isLoading: false,
	error: null,
	preview: null
};

type TUseGPXImportReturn = TGPXImportState & {
	uploadAndPreview: (file: File, maxGapSeconds?: number) => Promise<void>;
	reset: () => void;
};

export function useGPXImport(): TUseGPXImportReturn {
	const [state, setState] = useState<TGPXImportState>(INITIAL_STATE);

	const uploadAndPreview = useCallback(async (file: File, maxGapSeconds?: number): Promise<void> => {
		setState(prev => ({...prev, step: 'upload', isLoading: true, error: null}));
		try {
			const response = await gpxPreview(file, maxGapSeconds);
			setState({
				step: 'preview',
				isLoading: false,
				error: null,
				preview: response
			});
		} catch (err) {
			let errorMessage = 'Failed to process GPX file';
			if (err instanceof Error) {
				errorMessage = err.message;
			}
			setState(prev => ({
				...prev,
				isLoading: false,
				error: errorMessage
			}));
		}
	}, []);

	const reset = useCallback(() => {
		setState(INITIAL_STATE);
	}, []);

	return {
		...state,
		uploadAndPreview,
		reset
	};
}
