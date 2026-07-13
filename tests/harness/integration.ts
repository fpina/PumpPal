import { randomUUID } from 'node:crypto';
import { db } from '$lib/server/db';
import { exercise, user } from '$lib/server/db/schema';
import postgres from 'postgres';
import { test as vitestTest } from 'vitest';
import { resetTestDatabase } from './database';
import { databaseUrlFor } from './environment';

interface AthleteOptions {
	name?: string;
	emailPrefix?: string;
}

export class DatabaseTestHarness {
	async athlete(options: AthleteOptions = {}) {
		const id = `test-athlete-${randomUUID()}`;
		const now = new Date();
		const [created] = await db
			.insert(user)
			.values({
				id,
				name: options.name ?? 'Test Athlete',
				email: `${options.emailPrefix ?? id}@example.com`,
				emailVerified: true,
				createdAt: now,
				updatedAt: now
			})
			.returning();
		return created;
	}

	async catalogExercise(name = `Catalog Exercise ${randomUUID()}`) {
		const [created] = await db
			.insert(exercise)
			.values({ name, normalizedName: name.trim().toLowerCase() })
			.returning();
		return created;
	}
}

export const databaseTest = vitestTest.extend<{ harness: DatabaseTestHarness }>({
	// Vitest requires an object-destructuring fixture context even when no fixture is consumed.
	// eslint-disable-next-line no-empty-pattern
	harness: async ({}, use) => {
		const databaseUrl = databaseUrlFor('integration');
		const lock = postgres(databaseUrl, { max: 1 });
		await lock`SELECT pg_advisory_lock(hashtext('pumppal-integration-test'))`;
		try {
			await resetTestDatabase(databaseUrl);
			await use(new DatabaseTestHarness());
		} finally {
			await lock`SELECT pg_advisory_unlock(hashtext('pumppal-integration-test'))`;
			await lock.end();
		}
	}
});
