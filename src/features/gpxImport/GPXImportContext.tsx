'use client';

import {createContext, useContext} from 'react';

import {useGPXImport} from '@/features/gpxImport/useGPXImport';

import type {TUseGPXImportReturn} from '@/features/gpxImport/useGPXImport';
import type {ReactElement, ReactNode} from 'react';

const GPXImportContext = createContext<TUseGPXImportReturn | null>(null);

export function GPXImportProvider({children}: {children: ReactNode}): ReactElement {
	const gpxImport = useGPXImport();

	return <GPXImportContext.Provider value={gpxImport}>{children}</GPXImportContext.Provider>;
}

export function useGPXImportContext(): TUseGPXImportReturn {
	const context = useContext(GPXImportContext);
	if (!context) {
		throw new Error('useGPXImportContext must be used within GPXImportProvider');
	}
	return context;
}
