import {saveAssetLocation} from '@/shared/services/backendApi';
import {getErrorMessage} from '@/utils/error';
import {LOCATION_SAVE_REQUEST_DELAY_MS} from '@/utils/locationAssignment';

type TSaveBatchResult = {
	savedIDs: string[];
	failedIDs: string[];
	failedErrorsByID: Record<string, string>;
};

/**
 * Input contract for persisting one or more assets at a coordinate.
 */
type TSaveLocationArgs = {
	assetIDs: string[];
	latitude: number;
	longitude: number;
};

export async function delayMs(milliseconds: number): Promise<void> {
	return new Promise(resolve => {
		setTimeout(resolve, milliseconds);
	});
}

type TSaveOneResult = {
	ok: boolean;
	error?: string;
};

/**
 * Saves one asset location and converts API failures to a result object.
 *
 * @param assetID - Asset identifier.
 * @param latitude - Target latitude.
 * @param longitude - Target longitude.
 * @returns Success flag and optional error message.
 */
async function saveOneAssetLocation(assetID: string, latitude: number, longitude: number): Promise<TSaveOneResult> {
	try {
		await saveAssetLocation(assetID, latitude, longitude);
		return {ok: true};
	} catch (error) {
		return {
			ok: false,
			error: getErrorMessage(error, 'Unknown save failure')
		};
	}
}

/**
 * Writes a single pass sequentially with a fixed delay between requests.
 *
 * @param args - Save request.
 * @returns IDs that succeeded and failed during this pass.
 */
async function runSavePass({assetIDs, latitude, longitude}: TSaveLocationArgs): Promise<TSaveBatchResult> {
	const savedIDs: string[] = [];
	const failedIDs: string[] = [];
	const failedErrorsByID: Record<string, string> = {};
	for (let index = 0; index < assetIDs.length; index += 1) {
		const id = assetIDs[index];
		const result = await saveOneAssetLocation(id, latitude, longitude);
		if (result.ok) {
			savedIDs.push(id);
		} else {
			failedIDs.push(id);
			failedErrorsByID[id] = result.error ?? 'Unknown save failure';
		}
		if (index < assetIDs.length - 1) {
			await delayMs(LOCATION_SAVE_REQUEST_DELAY_MS);
		}
	}

	return {savedIDs, failedIDs, failedErrorsByID};
}

/**
 * Persist locations with one retry pass for failed assets.
 *
 * Runs a second pass for failures from the first pass to recover transient errors.
 *
 * @param args - Save request payload.
 * @returns Combined pass result containing saved and still-failed IDs.
 */
export async function saveAssetLocationsWithRetry(args: TSaveLocationArgs): Promise<TSaveBatchResult> {
	const firstPass = await runSavePass(args);
	if (firstPass.failedIDs.length === 0) {
		return firstPass;
	}

	const retryPass = await runSavePass({
		...args,
		assetIDs: firstPass.failedIDs
	});

	return {
		savedIDs: [...firstPass.savedIDs, ...retryPass.savedIDs],
		failedIDs: retryPass.failedIDs,
		failedErrorsByID: {
			...firstPass.failedErrorsByID,
			...retryPass.failedErrorsByID
		}
	};
}
