import {useEffect} from 'react';

import {KEYDOWN_EVENT, KEY_ARROW_LEFT, KEY_ARROW_RIGHT, KEY_ESCAPE} from '@/features/lightbox/constant';

/**
 * Arguments required to wire keyboard controls for the lightbox.
 */
type TUseLightboxKeyboardArgs = {
	isEnabled: boolean;
	closeLightbox: () => void;
	goPrev: () => void;
	goNext: () => void;
};

/**
 * Binds arrow/escape keyboard shortcuts for lightbox navigation.
 *
 * - Escape closes the lightbox,
 * - ArrowLeft moves to the previous asset,
 * - ArrowRight moves to the next asset.
 *
 * @param args - Keyboard interaction callbacks and enabled state.
 */
export function useLightboxKeyboard(args: TUseLightboxKeyboardArgs): void {
	const {isEnabled, closeLightbox, goPrev, goNext} = args;

	useEffect(() => {
		if (!isEnabled) {
			return;
		}

		function handleKeyDown(event: KeyboardEvent): void {
			if (event.key === KEY_ESCAPE) {
				closeLightbox();
				return;
			}
			if (event.key === KEY_ARROW_LEFT) {
				goPrev();
				return;
			}
			if (event.key === KEY_ARROW_RIGHT) {
				goNext();
			}
		}

		document.addEventListener(KEYDOWN_EVENT, handleKeyDown);
		return () => document.removeEventListener(KEYDOWN_EVENT, handleKeyDown);
	}, [isEnabled, closeLightbox, goPrev, goNext]);
}
