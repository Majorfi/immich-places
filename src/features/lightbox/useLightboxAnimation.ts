import {useEffect, useRef, useState} from 'react';

import {LIGHTBOX_UNMOUNT_DELAY_MS} from '@/features/lightbox/constant';

/**
 * Animation state returned by the lightbox animation hook.
 */
type TUseLightboxAnimationResult = {
	isMounted: boolean;
	isVisible: boolean;
	displayAssetID: string | null;
};

/**
 * Controls mounting/visibility and displayed asset id for lightbox transition timing.
 *
 * Uses two requestAnimationFrame ticks to stage the enter animation and delays
 * unmounting after fade-out to avoid abrupt disappearance.
 *
 * @param lightboxAssetID - Requested asset id to open, or null to close.
 * @returns Animation state consumed by the `AssetLightbox` render logic.
 */
export function useLightboxAnimation(lightboxAssetID: string | null): TUseLightboxAnimationResult {
	const [isMounted, setIsMounted] = useState(false);
	const [isVisible, setIsVisible] = useState(false);
	const [displayAssetID, setDisplayAssetID] = useState<string | null>(null);

	const showFrameRef = useRef<number | null>(null);
	const revealFrameRef = useRef<number | null>(null);

	useEffect(() => {
		if (showFrameRef.current !== null) {
			cancelAnimationFrame(showFrameRef.current);
			showFrameRef.current = null;
		}
		if (revealFrameRef.current !== null) {
			cancelAnimationFrame(revealFrameRef.current);
			revealFrameRef.current = null;
		}

		if (lightboxAssetID) {
			setDisplayAssetID(lightboxAssetID);
			setIsMounted(true);
			showFrameRef.current = requestAnimationFrame(() => {
				revealFrameRef.current = requestAnimationFrame(() => {
					setIsVisible(true);
					revealFrameRef.current = null;
				});
				showFrameRef.current = null;
			});
			return;
		}

		setIsVisible(false);
		const timer = setTimeout(() => {
			setIsMounted(false);
			setDisplayAssetID(null);
		}, LIGHTBOX_UNMOUNT_DELAY_MS);

		return () => {
			clearTimeout(timer);
			if (showFrameRef.current !== null) {
				cancelAnimationFrame(showFrameRef.current);
				showFrameRef.current = null;
			}
			if (revealFrameRef.current !== null) {
				cancelAnimationFrame(revealFrameRef.current);
				revealFrameRef.current = null;
			}
		};
	}, [lightboxAssetID]);

	return {isMounted, isVisible, displayAssetID};
}
