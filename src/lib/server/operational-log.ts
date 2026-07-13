interface FailureWithCode {
	code?: unknown;
	message?: unknown;
	body?: { code?: unknown };
}

const postgresConnectionErrorCodes = new Set([
	'CONNECTION_CLOSED',
	'CONNECTION_DESTROYED',
	'CONNECTION_ENDED',
	'CONNECT_TIMEOUT',
	'ECONNABORTED',
	'ECONNREFUSED',
	'ECONNRESET',
	'EAI_AGAIN',
	'EHOSTUNREACH',
	'ENETUNREACH',
	'ENOTFOUND',
	'EPIPE',
	'ETIMEDOUT'
]);

function failureDetails(cause: unknown): FailureWithCode {
	return typeof cause === 'object' && cause !== null ? (cause as FailureWithCode) : {};
}

export function isDatabaseFailure(cause: unknown) {
	const { code } = failureDetails(cause);
	return (
		typeof code === 'string' &&
		(/^[0-9A-Z]{5}$/u.test(code) || postgresConnectionErrorCodes.has(code))
	);
}

export function logOperationalFailure(operation: string, cause: unknown) {
	const { code, message, body } = failureDetails(cause);
	const errorCode = typeof code === 'string' ? code : body?.code;
	console.error(
		JSON.stringify({
			level: 'error',
			event: 'operational_failure',
			operation,
			errorCode: typeof errorCode === 'string' ? errorCode : undefined,
			message: typeof message === 'string' ? message : 'Unknown operational failure'
		})
	);
}
