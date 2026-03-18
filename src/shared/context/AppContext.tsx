'use client';

import {createContext, useContext} from 'react';

import {GPXImportProvider} from '@/features/gpxImport/GPXImportContext';
import {useAppProviderState} from '@/shared/context/useAppProviderState';

import type {
	TBackendContextValue,
	TCatalogContextValue,
	TMapSceneValue,
	TSelectionContextValue,
	TUIMapContextValue,
	TViewContextValue
} from '@/shared/types/context';
import type {ReactElement, ReactNode} from 'react';

/**
 * Backend health and sync context shared across the application.
 */
const BackendContext = createContext<TBackendContextValue | null>(null);
/**
 * View configuration context (filters, view mode, pagination settings).
 */
const ViewContext = createContext<TViewContextValue | null>(null);
/**
 * Catalog domain context (albums, assets, pagination, suggestions).
 */
const CatalogContext = createContext<TCatalogContextValue | null>(null);
/**
 * Selection domain context (selected assets, pending location, save actions).
 */
const SelectionContext = createContext<TSelectionContextValue | null>(null);
/**
 * Map UI context for map focus and lightbox actions.
 */
const UIMapContext = createContext<TUIMapContextValue | null>(null);
/**
 * Map scene context used by map-specific hooks and renderers.
 */
const MapSceneContext = createContext<TMapSceneValue | null>(null);

/**
 * Composes all feature-specific domains into a single React context provider.
 *
 * @param children - Child tree using application contexts.
 * @returns AppProvider element with nested domain providers.
 */
export function AppProvider({children}: {children: ReactNode}): ReactElement {
	const {backendValue, viewValue, catalogValue, selectionValue, uiMapValue, mapSceneValue} = useAppProviderState();

	return (
		<BackendContext.Provider value={backendValue}>
			<ViewContext.Provider value={viewValue}>
				<CatalogContext.Provider value={catalogValue}>
					<SelectionContext.Provider value={selectionValue}>
						<UIMapContext.Provider value={uiMapValue}>
							<MapSceneContext.Provider value={mapSceneValue}>
								<GPXImportProvider>{children}</GPXImportProvider>
							</MapSceneContext.Provider>
						</UIMapContext.Provider>
					</SelectionContext.Provider>
				</CatalogContext.Provider>
			</ViewContext.Provider>
		</BackendContext.Provider>
	);
}

/**
 * Access backend context and health/sync values.
 *
 * @returns Backend context value from nearest `AppProvider`.
 * @throws Error if used outside provider.
 */
export function useBackend(): TBackendContextValue {
	const context = useContext(BackendContext);
	if (!context) {
		throw new Error('useBackend must be used within AppProvider');
	}
	return context;
}

/**
 * Access view-related context values and actions.
 *
 * @returns View context value from nearest `AppProvider`.
 * @throws Error if used outside provider.
 */
export function useView(): TViewContextValue {
	const context = useContext(ViewContext);
	if (!context) {
		throw new Error('useView must be used within AppProvider');
	}
	return context;
}

/**
 * Access catalog domain context values and actions.
 *
 * @returns Catalog context value from nearest `AppProvider`.
 * @throws Error if used outside provider.
 */
export function useCatalog(): TCatalogContextValue {
	const context = useContext(CatalogContext);
	if (!context) {
		throw new Error('useCatalog must be used within AppProvider');
	}
	return context;
}

/**
 * Access selection domain context values and actions.
 *
 * @returns Selection context value from nearest `AppProvider`.
 * @throws Error if used outside provider.
 */
export function useSelection(): TSelectionContextValue {
	const context = useContext(SelectionContext);
	if (!context) {
		throw new Error('useSelection must be used within AppProvider');
	}
	return context;
}

/**
 * Access map UI context values and actions.
 *
 * @returns UI map context value from nearest `AppProvider`.
 * @throws Error if used outside provider.
 */
export function useUIMap(): TUIMapContextValue {
	const context = useContext(UIMapContext);
	if (!context) {
		throw new Error('useUIMap must be used within AppProvider');
	}
	return context;
}

/**
 * Access map scene context used by map render flows.
 *
 * @returns Map scene context value from nearest `AppProvider`.
 * @throws Error if used outside provider.
 */
export function useMapScene(): TMapSceneValue {
	const context = useContext(MapSceneContext);
	if (!context) {
		throw new Error('useMapScene must be used within AppProvider');
	}
	return context;
}
