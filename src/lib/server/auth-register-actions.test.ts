import { afterEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({ signUpEmail: vi.fn() }));

vi.mock('$lib/auth', () => ({
	auth: { api: { signUpEmail: mocks.signUpEmail } }
}));

import { actions } from '../../routes/auth/register/+page.server';

function registerRequest() {
	const formData = new FormData();
	formData.set('name', 'Athlete');
	formData.set('email', 'athlete@example.com');
	formData.set('password', 'safe-password');
	formData.set('confirmPassword', 'safe-password');

	return {
		request: new Request('http://localhost/auth/register', { method: 'POST', body: formData })
	} as never;
}

describe('registration action', () => {
	afterEach(() => {
		vi.clearAllMocks();
		vi.restoreAllMocks();
	});

	it('keeps the expected existing-email response as a client error', async () => {
		const operationalLog = vi.spyOn(console, 'error').mockImplementation(() => undefined);
		mocks.signUpEmail.mockRejectedValue({
			body: { code: 'USER_ALREADY_EXISTS_USE_ANOTHER_EMAIL' }
		});

		const result = await actions.register(registerRequest());

		expect(result).toMatchObject({
			status: 400,
			data: { message: 'Could not create that account. The email may already be registered.' }
		});
		expect(operationalLog).not.toHaveBeenCalled();
	});

	it('logs a wrapped adapter failure and returns a generic server error', async () => {
		const operationalLog = vi.spyOn(console, 'error').mockImplementation(() => undefined);
		mocks.signUpEmail.mockRejectedValue({
			body: { code: 'FAILED_TO_CREATE_USER' },
			message: 'Failed to create user'
		});

		const result = await actions.register(registerRequest());

		expect(result).toMatchObject({
			status: 500,
			data: { message: 'Could not create that account. Please try again.' }
		});
		expect(JSON.parse(operationalLog.mock.calls[0][0] as string)).toMatchObject({
			event: 'operational_failure',
			operation: 'auth.register',
			errorCode: 'FAILED_TO_CREATE_USER'
		});
	});
});
