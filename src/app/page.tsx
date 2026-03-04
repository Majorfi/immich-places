'use client';

import {AuthProvider, useAuth} from '@/features/auth/AuthContext';
import {AuthMapDynamic} from '@/features/auth/AuthMapDynamic';
import {AuthSidebar} from '@/features/auth/AuthSidebar';
import {MapViewDynamic} from '@/features/map/components/MapViewDynamic';
import {PhotoListContainer} from '@/shared/components/PhotoListContainer';
import {AppProvider, useBackend, useView} from '@/shared/context/AppContext';

import type {ReactElement} from 'react';

const layoutWithMapClass =
	'grid h-screen min-h-0 grid-rows-[fit-content(62dvh)_minmax(0,1fr)] gap-3 p-3 md:grid-cols-[minmax(20rem,var(--app-sidebar-width))_1fr] md:grid-rows-1';
const layoutWithoutMapClass = 'grid h-screen min-h-0 grid-cols-1 grid-rows-1 gap-3 p-3';

type TSideState = 'auth-loading' | 'auth-required' | 'backend-loading' | 'backend-error' | 'ready';
type TMapState = 'auth' | 'backend-loading' | 'backend-error' | 'ready';

type TSideWrapperProps = {
	state: TSideState;
	backendError?: string | null;
	onRetryBackendAction?: () => Promise<void>;
};

function SideWrapper({state, backendError, onRetryBackendAction}: TSideWrapperProps): ReactElement {
	if (state === 'ready') {
		return <PhotoListContainer />;
	}

	if (state === 'auth-required') {
		return (
			<div
				className={
					'flex animate-fade-in items-center justify-center overflow-y-auto rounded-xl border border-(--color-border) bg-(--color-surface)'
				}>
				<AuthSidebar />
			</div>
		);
	}

	if (state === 'backend-error') {
		return (
			<div
				className={
					'flex animate-fade-in flex-col items-center justify-center gap-3 rounded-xl border border-(--color-border) bg-(--color-surface) text-(--color-text-secondary)'
				}>
				<h2 className={'text-[1.25rem] text-(--color-text)'}>{'Backend not reachable'}</h2>
				<p className={'text-center'}>{backendError}</p>
				<button
					className={
						'cursor-pointer rounded-md border-0 bg-(--color-primary) px-5 py-2 text-[0.875rem] text-white'
					}
					onClick={() => {
						void onRetryBackendAction?.();
					}}>
					{'Retry'}
				</button>
			</div>
		);
	}

	return <div className={'rounded-xl border border-(--color-border) bg-(--color-surface)'} />;
}

type TMapWrapperProps = {
	state: TMapState;
};

function MapWrapper({state}: TMapWrapperProps): ReactElement {
	if (state === 'auth') {
		return (
			<div className={'overflow-hidden rounded-xl border border-(--color-border)'}>
				<AuthMapDynamic />
			</div>
		);
	}

	return <MapViewDynamic />;
}

type TAppShellProps = {
	sideState: TSideState;
	mapState: TMapState;
	backendError?: string | null;
	onRetryBackendAction?: () => Promise<void>;
	showMap?: boolean;
};

function AppShell({
	sideState,
	mapState,
	backendError,
	onRetryBackendAction,
	showMap = true
}: TAppShellProps): ReactElement {
	return (
		<div className={`relative ${showMap ? layoutWithMapClass : layoutWithoutMapClass}`}>
			<SideWrapper
				state={sideState}
				backendError={backendError}
				onRetryBackendAction={onRetryBackendAction}
			/>
			{showMap && <MapWrapper state={mapState} />}
		</div>
	);
}

function AuthenticatedAppRoutes(): ReactElement {
	const {isReady, backendError, retryBackendAction} = useBackend();
	const {viewMode, selectedAlbumID} = useView();
	const isMainCatalogView = viewMode === 'timeline' || (viewMode === 'album' && !selectedAlbumID);
	const showMap = !isMainCatalogView;

	if (backendError) {
		return (
			<AppShell
				sideState={'backend-error'}
				mapState={'backend-error'}
				backendError={backendError}
				onRetryBackendAction={retryBackendAction}
				showMap={showMap}
			/>
		);
	}

	if (!isReady) {
		return (
			<AppShell
				sideState={'backend-loading'}
				mapState={'backend-loading'}
				showMap={showMap}
			/>
		);
	}

	return (
		<AppShell
			sideState={'ready'}
			mapState={'ready'}
			showMap={showMap}
		/>
	);
}

function AppRoutes(): ReactElement {
	const {user, hasImmichAPIKey, isLoading} = useAuth();

	if (isLoading) {
		return (
			<AppShell
				sideState={'auth-loading'}
				mapState={'auth'}
			/>
		);
	}

	if (!user || !hasImmichAPIKey) {
		return (
			<AppShell
				sideState={'auth-required'}
				mapState={'auth'}
			/>
		);
	}

	return (
		<AppProvider>
			<AuthenticatedAppRoutes />
		</AppProvider>
	);
}

export default function Home(): ReactElement {
	return (
		<AuthProvider>
			<AppRoutes />
		</AuthProvider>
	);
}
