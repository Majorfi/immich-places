'use client';

import {useRouter} from 'next/navigation';
import {useEffect, useRef, useState} from 'react';

import {APIKeyDialog} from '@/features/auth/APIKeyDialog';
import {useAuth} from '@/features/auth/AuthContext';
import {LibrarySettingsDialog} from '@/features/librarySettings/LibrarySettingsDialog';
import {useBackend} from '@/shared/context/AppContext';

import type {ReactElement} from 'react';

/**
 * User dropdown menu for signed-in sessions.
 *
 * Shows account email and exposes a sign-out action with automatic redirect.
 *
 * @returns User menu element or `null` when unauthenticated.
 */
export function UserMenu(): ReactElement | null {
	const {user, hasLibraries, logout} = useAuth();
	const {refreshDataAction, resyncAction, clearCatalogAction} = useBackend();
	const router = useRouter();
	const [isOpen, setIsOpen] = useState(false);
	const [isAPIKeyDialogOpen, setIsAPIKeyDialogOpen] = useState(false);
	const [isLibraryDialogOpen, setIsLibraryDialogOpen] = useState(false);
	const menuRef = useRef<HTMLDivElement>(null);

	useEffect(() => {
		function handleClickOutside(e: MouseEvent): void {
			if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
				setIsOpen(false);
			}
		}
		if (isOpen) {
			document.addEventListener('mousedown', handleClickOutside);
		}
		return () => document.removeEventListener('mousedown', handleClickOutside);
	}, [isOpen]);

	if (!user) {
		return null;
	}

	return (
		<div
			ref={menuRef}
			className={'relative'}>
			<button
				onClick={() => setIsOpen(previous => !previous)}
				className={
					'flex h-8 w-8 cursor-pointer items-center justify-center rounded-full border border-(--color-border) bg-(--color-surface) text-xs font-medium text-(--color-text) hover:bg-(--color-hover)'
				}
				title={user.email}>
				{user.email.charAt(0).toUpperCase()}
			</button>
			{isOpen && (
				<div
					className={
						'absolute top-10 right-0 z-50 min-w-48 rounded-lg border border-(--color-border) bg-(--color-surface) py-1 shadow-lg'
					}>
					<div className={'border-b border-(--color-border) px-3 py-2'}>
						<p className={'text-sm font-medium text-(--color-text)'}>{user.email}</p>
					</div>
					{hasLibraries && (
						<button
							onClick={() => {
								setIsOpen(false);
								setIsLibraryDialogOpen(true);
							}}
							className={
								'w-full cursor-pointer border-0 bg-transparent px-3 py-2 text-left text-sm text-(--color-text-secondary) hover:bg-(--color-hover) hover:text-(--color-text)'
							}>
							{'Libraries'}
						</button>
					)}
					<button
						onClick={() => {
							setIsOpen(false);
							setIsAPIKeyDialogOpen(true);
						}}
						className={
							'w-full cursor-pointer border-0 bg-transparent px-3 py-2 text-left text-sm text-(--color-text-secondary) hover:bg-(--color-hover) hover:text-(--color-text)'
						}>
						{'API Key'}
					</button>
					<button
						onClick={async () => {
							await logout();
							router.replace('/');
						}}
						className={
							'w-full cursor-pointer border-0 bg-transparent px-3 py-2 text-left text-sm text-(--color-text-secondary) hover:bg-(--color-hover) hover:text-(--color-text)'
						}>
						{'Sign out'}
					</button>
				</div>
			)}
			<APIKeyDialog
				isOpen={isAPIKeyDialogOpen}
				onClose={() => setIsAPIKeyDialogOpen(false)}
				onSuccess={() => {
					clearCatalogAction();
					resyncAction();
				}}
			/>
			<LibrarySettingsDialog
				isOpen={isLibraryDialogOpen}
				onClose={() => setIsLibraryDialogOpen(false)}
				onVisibilityChanged={refreshDataAction}
			/>
		</div>
	);
}
