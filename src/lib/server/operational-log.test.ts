import { afterEach, describe, expect, it, vi } from 'vitest';
import { isDatabaseFailure, logOperationalFailure } from './operational-log';

describe('operational failure logging', () => {
	afterEach(() => vi.restoreAllMocks());

	it('recognizes PostgreSQL SQLSTATE errors without treating domain errors as operational', () => {
		expect(isDatabaseFailure({ code: '23505' })).toBe(true);
		expect(isDatabaseFailure({ code: '42P01' })).toBe(true);
		expect(isDatabaseFailure({ code: 'CONNECT_TIMEOUT' })).toBe(true);
		expect(isDatabaseFailure({ code: 'CONNECTION_CLOSED' })).toBe(true);
		expect(isDatabaseFailure({ code: 'ECONNREFUSED' })).toBe(true);
		expect(isDatabaseFailure({ code: 'ENOTFOUND' })).toBe(true);
		expect(isDatabaseFailure({ code: 'EAI_AGAIN' })).toBe(true);
		expect(isDatabaseFailure(new Error('Workout not found.'))).toBe(false);
	});

	it('uses an error code wrapped by Better Auth in its structured event', () => {
		const error = vi.spyOn(console, 'error').mockImplementation(() => undefined);

		logOperationalFailure('auth.register', {
			body: { code: 'FAILED_TO_CREATE_USER' },
			message: 'Failed to create user'
		});

		expect(JSON.parse(error.mock.calls[0][0] as string)).toMatchObject({
			operation: 'auth.register',
			errorCode: 'FAILED_TO_CREATE_USER'
		});
	});

	it('emits a structured event with the operation and SQLSTATE', () => {
		const error = vi.spyOn(console, 'error').mockImplementation(() => undefined);

		logOperationalFailure('workout.load', {
			code: '42P01',
			message: 'relation "workout" does not exist'
		});

		expect(JSON.parse(error.mock.calls[0][0] as string)).toEqual({
			level: 'error',
			event: 'operational_failure',
			operation: 'workout.load',
			errorCode: '42P01',
			message: 'relation "workout" does not exist'
		});
	});
});
