'use client';

import {useCallback, useEffect, useMemo, useRef, useState} from 'react';

import {
	PHOTO_GRID_FALLBACK_ROW_HEIGHT,
	PHOTO_GRID_GAP_PX,
	PHOTO_GRID_PADDING_PX,
	PHOTO_GRID_ROW_OVERSCAN
} from '@/utils/photoGrid';

import type {TAssetRow} from '@/shared/types/asset';
import type {TVirtualizedGridState} from '@/shared/types/grid';
import type {RefObject, UIEvent} from 'react';

/**
 * Public virtualized grid state contract exposed by `useVirtualizedGrid`.
 */
type TUseVirtualizedGridArgs = {
	assets: TAssetRow[];
	gridColumns: number;
	scrollResetKey: string;
	scrollContainerRef: RefObject<HTMLDivElement | null>;
};

/**
 * Manages visible slice and spacer heights for a virtualized photo grid.
 *
 * Tracks scroll position with rAF throttling, container dimensions, and row math
 * to compute a minimal asset window while preserving overall scroll behavior.
 *
 * @param args - Collection and viewport references for virtualization.
 * @returns Computed virtualized state used by the grid renderer.
 */
export function useVirtualizedGrid({
	assets,
	gridColumns,
	scrollResetKey,
	scrollContainerRef
}: TUseVirtualizedGridArgs): TVirtualizedGridState {
	const scrollRafRef = useRef<number | null>(null);
	const pendingScrollTopRef = useRef(0);
	const [scrollTop, setScrollTop] = useState(0);
	const [viewportHeight, setViewportHeight] = useState(0);
	const [containerWidth, setContainerWidth] = useState(0);

	useEffect(() => {
		scrollContainerRef.current?.scrollTo(0, 0);
		pendingScrollTopRef.current = 0;
		setScrollTop(0);
	}, [scrollResetKey, scrollContainerRef]);

	useEffect(() => {
		return () => {
			if (scrollRafRef.current !== null) {
				cancelAnimationFrame(scrollRafRef.current);
				scrollRafRef.current = null;
			}
		};
	}, []);

	const handleScroll = useCallback((event: UIEvent<HTMLDivElement>): void => {
		const nextScrollTop = event.currentTarget.scrollTop;
		pendingScrollTopRef.current = nextScrollTop;
		if (scrollRafRef.current !== null) {
			return;
		}
		scrollRafRef.current = requestAnimationFrame(() => {
			scrollRafRef.current = null;
			const nextScrollTop = pendingScrollTopRef.current;
			setScrollTop(prev => (prev === nextScrollTop ? prev : nextScrollTop));
		});
	}, []);

	useEffect(() => {
		const container = scrollContainerRef.current;
		if (!container) {
			return;
		}

		const updateSize = (): void => {
			setViewportHeight(container.clientHeight);
			setContainerWidth(container.clientWidth);
		};

		updateSize();
		const resizeObserver = new ResizeObserver(updateSize);
		resizeObserver.observe(container);
		return () => {
			resizeObserver.disconnect();
		};
	}, [scrollContainerRef]);

	const rowHeight = useMemo(() => {
		if (containerWidth <= 0) {
			return PHOTO_GRID_FALLBACK_ROW_HEIGHT;
		}
		const cellSize =
			(containerWidth - PHOTO_GRID_PADDING_PX * 2 - PHOTO_GRID_GAP_PX * (gridColumns - 1)) / gridColumns;
		return Math.max(1, cellSize + PHOTO_GRID_GAP_PX);
	}, [containerWidth, gridColumns]);

	const totalRows = Math.ceil(assets.length / gridColumns);
	const startRow = Math.max(0, Math.floor(scrollTop / rowHeight) - PHOTO_GRID_ROW_OVERSCAN);
	const visibleRowCount = Math.ceil((viewportHeight || 0) / rowHeight) + PHOTO_GRID_ROW_OVERSCAN * 2;
	const endRow = Math.min(totalRows, startRow + visibleRowCount);
	const startIndex = startRow * gridColumns;
	const endIndex = Math.min(assets.length, endRow * gridColumns);
	const visibleAssets = assets.slice(startIndex, endIndex);
	const topSpacerHeight = startRow * rowHeight;
	const bottomSpacerHeight = Math.max(0, (totalRows - endRow) * rowHeight);

	return {
		handleScroll,
		rowHeight,
		startIndex,
		visibleAssets,
		topSpacerHeight,
		bottomSpacerHeight,
		viewportHeight
	};
}
