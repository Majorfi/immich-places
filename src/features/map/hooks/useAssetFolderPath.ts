'use client';

import {useEffect, useState} from 'react';

import {fetchAssetFolder} from '@/shared/services/backendApi';

/**
 * Resolves the folder an asset lives in.
 *
 * Map markers carry only an immichID, so the path has to be fetched on demand. Returns
 * null while unknown, and for assets that resolve to no folder — the signal to hide the
 * "Go to folder" entry rather than offer one that would do nothing.
 *
 * @param assetID - Asset to resolve, or null when no marker menu is open.
 * @returns The folder path, or null when there is none to offer.
 */
export function useAssetFolderPath(assetID: string | null): string | null {
	const [folderPath, setFolderPath] = useState<string | null>(null);

	useEffect(() => {
		setFolderPath(null);
		if (!assetID) {
			return;
		}
		const controller = new AbortController();
		fetchAssetFolder(assetID, {signal: controller.signal})
			.then(path => {
				if (!controller.signal.aborted && path !== '') {
					setFolderPath(path);
				}
			})
			.catch(() => {
				// An unresolvable folder just means no menu entry.
			});

		return () => {
			controller.abort();
		};
	}, [assetID]);

	return folderPath;
}
