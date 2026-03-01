'use client';

import {useEffect, useState} from 'react';

import {useAuth} from '@/features/auth/AuthContext';
import {DialogShell} from '@/shared/components/DialogShell';

import type {ChangeEvent, ReactElement} from 'react';

type TAPIKeyDialogProps = {
	isOpen: boolean;
	onClose: () => void;
	onSuccess: () => void;
};

export function APIKeyDialog({isOpen, onClose, onSuccess}: TAPIKeyDialogProps): ReactElement {
	const {updateAPIKey, error} = useAuth();
	const [apiKey, setAPIKey] = useState('');
	const [shouldShowKey, setShouldShowKey] = useState(false);
	const [isSubmitting, setIsSubmitting] = useState(false);

	useEffect(() => {
		if (!isOpen) {
			setAPIKey('');
			setShouldShowKey(false);
			setIsSubmitting(false);
		}
	}, [isOpen]);

	async function handleSubmit(e: ChangeEvent): Promise<void> {
		e.preventDefault();
		if (!apiKey.trim()) {
			return;
		}
		setIsSubmitting(true);
		try {
			const didSucceed = await updateAPIKey(apiKey.trim());
			if (didSucceed) {
				onClose();
				onSuccess();
			}
		} finally {
			setIsSubmitting(false);
		}
	}

	let inputType = 'password';
	if (shouldShowKey) {
		inputType = 'text';
	}

	let toggleLabel = 'Show';
	if (shouldShowKey) {
		toggleLabel = 'Hide';
	}

	let submitLabel = 'Save API Key';
	if (isSubmitting) {
		submitLabel = 'Validating...';
	}

	return (
		<DialogShell
			isOpen={isOpen}
			onClose={onClose}
			title={'API Key'}
			subtitle={'Update your Immich API key.'}>
			<div className={'min-h-16 px-4 py-3'}>
				<form
					onSubmit={handleSubmit}
					className={'flex flex-col gap-3'}>
					<div className={'relative'}>
						<input
							type={inputType}
							placeholder={'Immich API Key'}
							value={apiKey}
							onChange={e => setAPIKey(e.target.value)}
							required
							className={
								'w-full rounded-lg border border-(--color-border) bg-(--color-bg) px-3 py-2 pr-16 text-sm outline-none focus:border-(--color-primary)'
							}
						/>
						<button
							type={'button'}
							onClick={() => setShouldShowKey(!shouldShowKey)}
							className={
								'absolute top-1/2 right-2 -translate-y-1/2 cursor-pointer border-0 bg-transparent px-2 py-1 text-xs text-(--color-text-secondary) hover:text-(--color-text)'
							}>
							{toggleLabel}
						</button>
					</div>
					{error && <p className={'text-sm text-red-600'}>{error}</p>}
					<button
						type={'submit'}
						disabled={isSubmitting || !apiKey.trim()}
						className={
							'cursor-pointer rounded-lg border-0 bg-(--color-primary) py-2 text-sm font-medium text-white disabled:opacity-50'
						}>
						{submitLabel}
					</button>
				</form>
			</div>
		</DialogShell>
	);
}
