import type {KeyboardEvent} from 'react';

export function handleActivate(callback: () => void): (event: KeyboardEvent) => void {
	return (event: KeyboardEvent) => {
		if (event.key === 'Enter' || event.key === ' ') {
			event.preventDefault();
			callback();
		}
	};
}

/** Score weight for same-day suggestion source. */
export const SUGGESTION_SAME_DAY_SCORE = 6;
/** Score weight for two-day suggestion source. */
export const SUGGESTION_TWO_DAY_SCORE = 4;
/** Score weight for weekly suggestion source. */
export const SUGGESTION_WEEKLY_SCORE = 2;
/** Bonus for album-based suggestion source. */
export const SUGGESTION_ALBUM_BONUS = 1;
/** Decimal precision used to normalize cluster coordinates. */
export const SUGGESTION_COORDINATE_PRECISION_DIGITS = 2;
/** Chevron transition duration (ms). */
const CHEVRON_ROTATE_TRANSITION_MS = 200;
/** Suggestion menu fade-in duration (ms). */
const SUGGESTION_MENU_ANIMATION_MS = 150;

/** CSS transition token for chevron rotation. */
export const CHEVRON_TRANSITION = `transform ${CHEVRON_ROTATE_TRANSITION_MS}ms`;
/** CSS animation token for suggestion panel entry. */
export const PANEL_FADE_IN_ANIMATION = `fadeInMenu ${SUGGESTION_MENU_ANIMATION_MS}ms ease-out`;
