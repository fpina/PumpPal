import { describe, expect, it } from 'vitest';
import { deriveTestDatabaseUrl } from './database';

describe('database test harness', () => {
	it('derives a suite-specific database without changing connection credentials', () => {
		expect(
			deriveTestDatabaseUrl('postgres://athlete:secret@localhost:5433/local', 'integration')
		).toBe('postgres://athlete:secret@localhost:5433/local_test_integration');
	});
});
