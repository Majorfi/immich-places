'use client';

import {useCallback, useRef, useState} from 'react';

import type {KeyboardEvent, ReactElement} from 'react';

/**
 * Inline text field for naming or renaming a favorite place.
 *
 * Enter confirms the trimmed value (falling back to `defaultName` when blank);
 * Escape cancels. Styled to match the app's floating panels.
 */
export function FavoriteNameField({
	defaultName,
	onConfirmAction,
	onCancelAction
}: {
	defaultName: string;
	onConfirmAction: (name: string) => void;
	onCancelAction: () => void;
}): ReactElement {
	const [value, setValue] = useState(defaultName);
	const hasCommittedRef = useRef(false);

	const commit = useCallback(() => {
		if (hasCommittedRef.current) {
			return;
		}
		hasCommittedRef.current = true;
		const trimmed = value.trim();
		onConfirmAction(trimmed || defaultName);
	}, [value, defaultName, onConfirmAction]);

	const cancel = useCallback(() => {
		if (hasCommittedRef.current) {
			return;
		}
		hasCommittedRef.current = true;
		onCancelAction();
	}, [onCancelAction]);

	const handleKeyDown = useCallback(
		(event: KeyboardEvent<HTMLInputElement>) => {
			if (event.key === 'Enter') {
				event.preventDefault();
				commit();
			} else if (event.key === 'Escape') {
				event.preventDefault();
				cancel();
			}
		},
		[commit, cancel]
	);

	return (
		<span
			className={'flex min-w-0 flex-1 items-center gap-1'}
			onClick={event => event.stopPropagation()}>
			<input
				autoFocus
				type={'text'}
				value={value}
				placeholder={defaultName}
				onChange={event => setValue(event.target.value)}
				onKeyDown={handleKeyDown}
				onBlur={commit}
				className={
					'min-w-0 flex-1 rounded-md border border-white/60 bg-white px-2 py-1 text-[0.8125rem] text-(--color-text) outline-none'
				}
			/>
			<button
				type={'button'}
				aria-label={'Confirm name'}
				onMouseDown={event => event.preventDefault()}
				onClick={commit}
				className={'flex-shrink-0 px-1 text-(--color-primary)'}>
				{'✓'}
			</button>
			<button
				type={'button'}
				aria-label={'Cancel'}
				onMouseDown={event => event.preventDefault()}
				onClick={cancel}
				className={'flex-shrink-0 px-1 text-(--color-text-secondary)'}>
				{'×'}
			</button>
		</span>
	);
}
