import type {ReactElement} from 'react';

const STAR_PATH =
	'M11.48 3.499a.562.562 0 0 1 1.04 0l2.125 5.111a.563.563 0 0 0 .475.345l5.518.442c.499.04.701.663.321.988l-4.204 3.602a.563.563 0 0 0-.182.557l1.285 5.385a.562.562 0 0 1-.84.61l-4.725-2.885a.562.562 0 0 0-.586 0L6.982 20.54a.562.562 0 0 1-.84-.61l1.285-5.386a.562.562 0 0 0-.182-.557l-4.204-3.602a.562.562 0 0 1 .321-.988l5.518-.442a.563.563 0 0 0 .475-.345L11.48 3.5Z';

type TStarIconProps = {
	filled: boolean;
	size?: number;
};

function resolveStarFill(filled: boolean): string {
	if (filled) {
		return 'currentColor';
	}
	return 'none';
}

export function resolveStarColorClass(isStarred: boolean): string {
	if (isStarred) {
		return 'text-amber-500';
	}
	return 'text-gray-300 hover:text-amber-400';
}

export function StarIcon({filled, size = 14}: TStarIconProps): ReactElement {
	return (
		<svg
			width={String(size)}
			height={String(size)}
			viewBox={'0 0 24 24'}
			fill={resolveStarFill(filled)}
			stroke={'currentColor'}
			strokeWidth={'1.5'}
			strokeLinecap={'round'}
			strokeLinejoin={'round'}>
			<path d={STAR_PATH} />
		</svg>
	);
}
