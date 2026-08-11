'use client';

import {useCallback, useEffect, useRef, useState} from 'react';

import {useCatalog} from '@/shared/context/AppContext';
import {cn} from '@/utils/cn';

import type {TFolderNode} from '@/shared/types/folder';
import type {ReactElement} from 'react';

const messageClass =
	'flex items-center justify-center px-4 py-12 text-center text-[0.875rem] text-(--color-text-secondary)';
const messageColumnClass =
	'flex flex-col items-center justify-center gap-3 px-4 py-12 text-center text-[0.875rem] text-(--color-text-secondary)';

type TFolderTreeProps = {
	onSelectAction: (folderPath: string) => void;
	isSyncing: boolean;
};

type TFolderNodeItemProps = {
	node: TFolderNode;
	depth: number;
	expandedPaths: ReadonlySet<string>;
	onToggleAction: (path: string) => void;
	onSelectAction: (path: string) => void;
};

function FolderNodeItem({
	node,
	depth,
	expandedPaths,
	onToggleAction,
	onSelectAction
}: TFolderNodeItemProps): ReactElement {
	const isExpanded = expandedPaths.has(node.path);
	const hasChildren = node.children.length > 0;
	let toggleLabel = 'Expand folder';
	if (isExpanded) {
		toggleLabel = 'Collapse folder';
	}

	return (
		<div>
			{/* The toggle is a sibling of the selectable row, never a child: interactive
			    content nested inside a role="button" is invalid and can hide the toggle
			    from the accessibility tree. */}
			<div
				className={
					'flex items-center gap-1 rounded-md px-2 py-1.5 text-[0.8125rem] transition-colors hover:bg-(--color-hover)'
				}
				style={{paddingLeft: `${depth * 16 + 8}px`}}>
				{hasChildren && (
					<button
						type={'button'}
						aria-label={toggleLabel}
						aria-expanded={isExpanded}
						className={'flex h-4 w-4 shrink-0 items-center justify-center text-(--color-text-secondary)'}
						onClick={() => onToggleAction(node.path)}>
						<svg
							className={cn('h-3 w-3 transition-transform', isExpanded && 'rotate-90')}
							viewBox={'0 0 24 24'}
							fill={'none'}
							stroke={'currentColor'}
							strokeWidth={'2'}>
							<path d={'M9 18l6-6-6-6'} />
						</svg>
					</button>
				)}
				{!hasChildren && <div className={'w-4 shrink-0'} />}
				<div
					role={'button'}
					tabIndex={0}
					className={'flex min-w-0 flex-1 cursor-pointer items-center gap-1'}
					onClick={() => onSelectAction(node.path)}
					onKeyDown={event => {
						if (event.key === 'Enter' || event.key === ' ') {
							event.preventDefault();
							onSelectAction(node.path);
						}
					}}>
					<span className={'flex-1 truncate'}>{node.name}</span>
					<span className={'text-[0.6875rem] text-(--color-text-secondary)'}>{node.assetCount}</span>
				</div>
			</div>
			{isExpanded && hasChildren && (
				<div>
					{node.children.map(child => (
						<FolderNodeItem
							key={child.path}
							node={child}
							depth={depth + 1}
							expandedPaths={expandedPaths}
							onToggleAction={onToggleAction}
							onSelectAction={onSelectAction}
						/>
					))}
				</div>
			)}
		</div>
	);
}

export function FolderTree({onSelectAction, isSyncing}: TFolderTreeProps): ReactElement {
	const {folderTree, isLoadingFolders, foldersError, loadFolderTreeAction} = useCatalog();
	const [expandedPaths, setExpandedPaths] = useState<Set<string>>(new Set());
	const hasSeededRootsRef = useRef(false);

	// Root folders start expanded, but only on the first tree that actually has any:
	// later reloads must leave the user's own expand/collapse choices alone, and an
	// empty tree must not consume the one seeding pass a restrictive filter can produce.
	useEffect(() => {
		if (hasSeededRootsRef.current || !folderTree || folderTree.children.length === 0) {
			return;
		}
		hasSeededRootsRef.current = true;
		setExpandedPaths(new Set(folderTree.children.map(node => node.path)));
	}, [folderTree]);

	const toggleExpandedAction = useCallback((path: string) => {
		setExpandedPaths(previous => {
			const next = new Set(previous);
			if (next.has(path)) {
				next.delete(path);
			} else {
				next.add(path);
			}
			return next;
		});
	}, []);

	// Only the first load blanks the list. A filter switch keeps the previous tree on
	// screen, so expansion state and scroll position survive the refresh.
	if (isLoadingFolders && !folderTree) {
		return <div className={messageClass}>{'Loading folders...'}</div>;
	}

	if (foldersError) {
		return (
			<div className={messageColumnClass}>
				<span>{foldersError}</span>
				<button
					type={'button'}
					className={
						'cursor-pointer rounded-md border px-3 py-1 text-[0.8125rem] transition-colors hover:bg-(--color-hover)'
					}
					onClick={() => void loadFolderTreeAction()}>
					{'Retry'}
				</button>
			</div>
		);
	}

	if (!folderTree || folderTree.children.length === 0) {
		if (isSyncing) {
			return (
				<div className={messageColumnClass}>
					<svg
						className={'h-6 w-6 animate-spin'}
						viewBox={'0 0 24 24'}
						fill={'none'}
						stroke={'currentColor'}
						strokeWidth={'2'}>
						<path d={'M21 12a9 9 0 1 1-6.219-8.56'} />
					</svg>
					{'Syncing with Immich...'}
				</div>
			);
		}
		return <div className={messageClass}>{'No folders found'}</div>;
	}

	return (
		<div className={cn('flex-1 overflow-y-auto py-1 transition-opacity', isLoadingFolders && 'opacity-60')}>
			{folderTree.children.map(node => (
				<FolderNodeItem
					key={node.path}
					node={node}
					depth={0}
					expandedPaths={expandedPaths}
					onToggleAction={toggleExpandedAction}
					onSelectAction={onSelectAction}
				/>
			))}
		</div>
	);
}
