'use client';

import {useCallback, useState} from 'react';

import {gpxPreview} from '@/shared/services/backendApi';

import type {TGPXPreviewResponse} from '@/features/gpxImport/gpxImportTypes';

type TGPXImportStep = 'upload' | 'preview';

type TGPXImportState = {
	step: TGPXImportStep;
	isLoading: boolean;
	error: string | null;
	previews: TGPXPreviewResponse[];
};

const INITIAL_STATE: TGPXImportState = {
	step: 'upload',
	isLoading: false,
	error: null,
	previews: []
};

export type TUseGPXImportReturn = TGPXImportState & {
	uploadAndPreview: (files: File[], maxGapSeconds?: number) => Promise<void>;
	reset: () => void;
};

export function useGPXImport(): TUseGPXImportReturn {
	const [state, setState] = useState<TGPXImportState>(INITIAL_STATE);

	const uploadAndPreview = useCallback(async (files: File[], maxGapSeconds?: number): Promise<void> => {
		if (files.length === 0) {
			return;
		}
		setState(prev => ({...prev, step: 'upload', isLoading: true, error: null}));

		const results = await Promise.allSettled(files.map(file => gpxPreview(file, maxGapSeconds)));

		const successes: TGPXPreviewResponse[] = [];
		const errors: string[] = [];

		for (let i = 0; i < results.length; i++) {
			const result = results[i];
			if (result.status === 'fulfilled') {
				successes.push(result.value);
			} else {
				const fileName = files[i].name;
				const reason = result.reason instanceof Error ? result.reason.message : 'Unknown error';
				errors.push(`${fileName}: ${reason}`);
			}
		}

		if (successes.length === 0) {
			setState(prev => ({
				...prev,
				isLoading: false,
				error: errors.join('\n')
			}));
			return;
		}

		const errorSuffix = errors.length > 0 ? `Failed: ${errors.join(', ')}` : null;

		setState({
			step: 'preview',
			isLoading: false,
			error: errorSuffix,
			previews: successes
		});
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
