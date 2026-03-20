import {clsx} from 'clsx';
import {twMerge} from 'tailwind-merge';

import type {ClassValue} from 'clsx';

export function cn(...inputs: ClassValue[]): string {
	return twMerge(clsx(inputs));
}
