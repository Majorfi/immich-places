export function getErrorMessage(error: unknown, fallback: string): string {
	if (error instanceof Error) {
		const cause = error.cause instanceof Error ? error.cause.message : '';
		if (cause) {
			return `${error.message}: ${cause}`;
		}
		return error.message;
	}
	return fallback;
}
