type AuthAction = 'login' | 'register';

interface BetterAuthFailure {
	body?: { code?: unknown };
}

const expectedAuthFailureCodes: Record<AuthAction, ReadonlySet<string>> = {
	login: new Set(['INVALID_EMAIL_OR_PASSWORD']),
	register: new Set(['USER_ALREADY_EXISTS_USE_ANOTHER_EMAIL'])
};

export function isExpectedAuthFailure(action: AuthAction, cause: unknown) {
	if (typeof cause !== 'object' || cause === null) return false;
	const { body } = cause as BetterAuthFailure;
	return typeof body?.code === 'string' && expectedAuthFailureCodes[action].has(body.code);
}
