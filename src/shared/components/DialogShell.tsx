'use client';

import * as Dialog from '@radix-ui/react-dialog';

import type {ReactElement, ReactNode} from 'react';

type TDialogShellProps = {
	isOpen: boolean;
	onClose: () => void;
	title: string;
	subtitle: string;
	maxWidth?: 'sm' | 'md';
	headerTrailing?: ReactNode;
	children: ReactNode;
};

export function DialogShell({
	isOpen,
	onClose,
	title,
	subtitle,
	maxWidth = 'md',
	headerTrailing,
	children
}: TDialogShellProps): ReactElement {
	let maxWidthClass = 'max-w-md';
	if (maxWidth === 'sm') {
		maxWidthClass = 'max-w-sm';
	}

	return (
		<Dialog.Root
			open={isOpen}
			onOpenChange={open => {
				if (!open) {
					onClose();
				}
			}}>
			<Dialog.Portal>
				<Dialog.Overlay className={'fixed inset-0 z-[2000] bg-black/50'} />
				<Dialog.Content
					className={`fixed top-1/2 left-(--dialog-left) z-[2001] w-full ${maxWidthClass} -translate-x-1/2 -translate-y-1/2 rounded-lg border border-(--color-border) bg-(--color-surface) shadow-lg focus:outline-none`}>
					<div className={'flex items-center justify-between border-b border-(--color-border) px-4 py-3'}>
						<div>
							<Dialog.Title className={'text-sm font-semibold text-(--color-text)'}>{title}</Dialog.Title>
							<p className={'mt-0.5 text-xs text-(--color-text-secondary)'}>{subtitle}</p>
						</div>
						<div className={'flex items-center gap-2'}>
							{headerTrailing}
							<Dialog.Close
								aria-label={'Close dialog'}
								className={
									'flex h-6 w-6 cursor-pointer items-center justify-center rounded border-0 bg-transparent text-(--color-text-secondary) hover:text-(--color-text)'
								}>
								{'\u00D7'}
							</Dialog.Close>
						</div>
					</div>
					{children}
				</Dialog.Content>
			</Dialog.Portal>
		</Dialog.Root>
	);
}
