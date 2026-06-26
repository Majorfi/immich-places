'use client';

import {TagIcon} from 'lucide-react';
import {useMemo, useState} from 'react';

import {Popover, PopoverContent, PopoverTrigger} from '@/components/ui/popover';
import {useTags} from '@/features/tags/useTags';
import {cn} from '@/utils/cn';

import type {TTagRow} from '@/shared/types/tag';
import type {ReactElement} from 'react';

type TTagFilterGroupProps = {
	selectedTagID: string | null;
	onTagAction: (tagID: string | null) => void;
	disabled?: boolean;
};

const buttonBase =
	'cursor-pointer rounded-md border px-2 py-1 text-[0.6875rem] font-medium transition-all duration-150';
const buttonActive = 'border-(--color-primary) bg-(--color-selected) text-(--color-primary)';
const buttonInactive =
	'border-(--color-border) bg-transparent text-(--color-text-secondary) hover:border-(--color-text-secondary)';

function resolveTriggerStyle(open: boolean, hasSelection: boolean): string {
	if (open) {
		return buttonActive;
	}
	if (hasSelection) {
		return 'border-(--color-primary) bg-(--color-primary)/10 text-(--color-primary)';
	}
	return buttonInactive;
}

function formatTagLabel(tag: TTagRow | null): string {
	if (!tag) {
		return 'All tags';
	}
	return tag.value;
}

function matchesQuery(tag: TTagRow, query: string): boolean {
	if (!query) {
		return true;
	}
	return tag.value.toLowerCase().includes(query.toLowerCase());
}

export function TagFilterGroup({selectedTagID, onTagAction, disabled = false}: TTagFilterGroupProps): ReactElement {
	const [isOpen, setIsOpen] = useState(false);
	const [query, setQuery] = useState('');
	const {tags, isLoading, error} = useTags(isOpen);

	const selectedTag = useMemo(() => {
		if (!selectedTagID) {
			return null;
		}
		return tags.find(t => t.immichID === selectedTagID) ?? null;
	}, [selectedTagID, tags]);

	const filteredTags = useMemo(() => tags.filter(t => matchesQuery(t, query)), [tags, query]);

	let triggerLabel = formatTagLabel(selectedTag);
	if (selectedTagID && !selectedTag && !isLoading) {
		triggerLabel = 'Tag';
	}

	let listBody: ReactElement;
	if (isLoading) {
		listBody = <div className={'px-3 py-2 text-[0.6875rem] text-(--color-text-secondary)'}>{'Loading…'}</div>;
	} else if (error) {
		listBody = <div className={'px-3 py-2 text-[0.6875rem] text-[#b91c1c]'}>{error}</div>;
	} else if (tags.length === 0) {
		listBody = <div className={'px-3 py-2 text-[0.6875rem] text-(--color-text-secondary)'}>{'No tags found.'}</div>;
	} else if (filteredTags.length === 0) {
		listBody = <div className={'px-3 py-2 text-[0.6875rem] text-(--color-text-secondary)'}>{'No matches.'}</div>;
	} else {
		listBody = (
			<ul className={'max-h-72 overflow-y-auto py-1'}>
				{filteredTags.map(tag => {
					const isActive = tag.immichID === selectedTagID;
					return (
						<li key={tag.immichID}>
							<button
								onClick={() => {
									onTagAction(tag.immichID);
									setIsOpen(false);
								}}
								className={cn(
									'flex w-full items-center justify-between gap-2 px-3 py-1.5 text-left text-[0.75rem] transition-colors',
									isActive && 'bg-(--color-selected) text-(--color-primary)',
									!isActive && 'text-(--color-text) hover:bg-(--accent)'
								)}>
								<span className={'truncate'}>{tag.value}</span>
								<span className={'shrink-0 text-[0.625rem] tabular-nums text-(--color-text-secondary)'}>
									{tag.assetCount}
								</span>
							</button>
						</li>
					);
				})}
			</ul>
		);
	}

	return (
		<div className={'flex-1 rounded-lg bg-(--color-bg) p-2.5'}>
			<div className={'mb-1 flex items-center justify-between'}>
				<div
					className={
						'text-[0.5625rem] font-semibold uppercase tracking-[0.08em] text-(--color-text-secondary)'
					}>
					{'Tag'}
				</div>
				{selectedTagID && !disabled && (
					<button
						onClick={() => {
							onTagAction(null);
							setIsOpen(false);
						}}
						className={
							'cursor-pointer border-0 bg-transparent text-[0.5625rem] font-medium text-(--color-primary) hover:underline'
						}>
						{'Clear'}
					</button>
				)}
			</div>
			<Popover
				open={isOpen && !disabled}
				onOpenChange={open => {
					if (disabled) {
						return;
					}
					setIsOpen(open);
					if (!open) {
						setQuery('');
					}
				}}>
				<PopoverTrigger asChild>
					<button
						disabled={disabled}
						className={cn(
							buttonBase,
							'flex w-full items-center gap-1.5',
							disabled &&
								'cursor-not-allowed border-(--color-border) bg-transparent text-(--color-text-secondary) opacity-50',
							!disabled && resolveTriggerStyle(isOpen, selectedTagID !== null)
						)}>
						<TagIcon className={'h-3 w-3'} />
						<span className={'truncate'}>{triggerLabel}</span>
					</button>
				</PopoverTrigger>
				<PopoverContent
					className={'w-64 p-0'}
					align={'start'}
					sideOffset={6}>
					<div className={'border-b border-(--color-border) p-2'}>
						<input
							autoFocus
							value={query}
							onChange={e => setQuery(e.target.value)}
							placeholder={'Search tags…'}
							className={
								'w-full rounded-md border border-(--color-border) bg-transparent px-2 py-1 text-[0.75rem] text-(--color-text) focus:border-(--color-primary) focus:outline-none'
							}
						/>
					</div>
					{listBody}
				</PopoverContent>
			</Popover>
		</div>
	);
}
