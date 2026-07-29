'use client';

import {useState} from 'react';

import {useCatalog} from '@/shared/context/AppContext';

import type {TFolderNode} from '@/shared/types/folder';
import type {ReactElement} from 'react';

type TFolderTreeProps = {
	onSelectAction: (folderPath: string) => void;
	isSyncing: boolean;
};

function FolderNodeItem({
	node,
	depth,
	onSelectAction
}: {
	node: TFolderNode;
	depth: number;
	onSelectAction: (path: string) => void;
}): ReactElement {
	const [isExpanded, setExpanded] = useState(depth === 0);
	const hasChildren = node.children.length > 0;

	return (
		<div>
			<div
				role={'button'}
				tabIndex={0}
				className={
					'flex cursor-pointer items-center gap-1 rounded-md px-2 py-1.5 text-[0.8125rem] transition-colors hover:bg-(--color-hover)'
				}
				style={{paddingLeft: `${depth * 16 + 8}px`}}
				onClick={() => onSelectAction(node.path)}
				onKeyDown={event => {
					if (event.key === 'Enter' || event.key === ' ') {
						event.preventDefault();
						onSelectAction(node.path);
					}
				}}>
				{hasChildren && (
					<button
						type={'button'}
						aria-label={isExpanded ? 'Collapse folder' : 'Expand folder'}
						aria-expanded={isExpanded}
						className={'flex h-4 w-4 items-center justify-center text-(--color-text-secondary)'}
						onClick={e => {
							e.stopPropagation();
							setExpanded(!isExpanded);
						}}>
						<svg
							className={`h-3 w-3 transition-transform ${isExpanded ? 'rotate-90' : ''}`}
							viewBox={'0 0 24 24'}
							fill={'none'}
							stroke={'currentColor'}
							strokeWidth={'2'}>
							<path d={'M9 18l6-6-6-6'} />
						</svg>
					</button>
				)}
				{!hasChildren && <div className={'w-4'} />}
				<span className={'flex-1 truncate'}>{node.name}</span>
				<span className={'text-[0.6875rem] text-(--color-text-secondary)'}>{node.assetCount}</span>
			</div>
			{isExpanded && hasChildren && (
				<div>
					{node.children.map(child => (
						<FolderNodeItem
							key={child.path}
							node={child}
							depth={depth + 1}
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

	if (isLoadingFolders) {
		return (
			<div
				className={
					'flex items-center justify-center px-4 py-12 text-center text-[0.875rem] text-(--color-text-secondary)'
				}>
				{'Loading folders...'}
			</div>
		);
	}

	if (foldersError) {
		return (
			<div
				className={
					'flex flex-col items-center justify-center gap-3 px-4 py-12 text-center text-[0.875rem] text-(--color-text-secondary)'
				}>
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
				<div
					className={
						'flex flex-col items-center justify-center gap-3 px-4 py-12 text-center text-[0.875rem] text-(--color-text-secondary)'
					}>
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
		return (
			<div
				className={
					'flex items-center justify-center px-4 py-12 text-center text-[0.875rem] text-(--color-text-secondary)'
				}>
				{'No folders found'}
			</div>
		);
	}

	return (
		<div className={'flex-1 overflow-y-auto py-1'}>
			{folderTree.children.map(node => (
				<FolderNodeItem
					key={node.path}
					node={node}
					depth={0}
					onSelectAction={onSelectAction}
				/>
			))}
		</div>
	);
}
