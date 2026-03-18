import {CHEVRON_TRANSITION} from '@/features/suggestions/constant';

import type {ReactElement} from 'react';

type TChevronIconProps = {
	open: boolean;
};

function resolveChevronTransform(open: boolean): string {
	if (open) {
		return 'rotate(180deg)';
	}
	return '';
}

export function ChevronIcon({open}: TChevronIconProps): ReactElement {
	return (
		<svg
			width={'10'}
			height={'10'}
			viewBox={'0 0 10 10'}
			style={{transform: resolveChevronTransform(open), transition: CHEVRON_TRANSITION}}>
			<path
				d={'M2 4l3 3 3-3'}
				stroke={'currentColor'}
				strokeWidth={'1.5'}
				fill={'none'}
				strokeLinecap={'round'}
			/>
		</svg>
	);
}
