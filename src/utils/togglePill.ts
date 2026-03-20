import {cn} from '@/utils/cn';

export function togglePillClass(isActive: boolean): string {
	return cn(
		'rounded-md border px-2 py-1 text-[0.6875rem] font-medium transition-all duration-150',
		isActive && 'cursor-default border-(--color-primary) bg-(--color-selected) text-(--color-primary)',
		!isActive &&
			'cursor-pointer border-(--color-border) bg-transparent text-(--color-text-secondary) hover:border-(--color-text-secondary)'
	);
}
