import postgres from 'postgres';
import { db } from '$lib/server/db';
import { sql } from 'drizzle-orm';
import { expect } from 'vitest';
import { databaseTest } from './integration';
import { databaseUrlFor } from './environment';
import { resetTestDatabase } from './database';

databaseTest(
	'the integration database starts migrated and can be reset to a known empty state',
	async () => {
		const databaseUrl = databaseUrlFor('integration');
		const client = postgres(databaseUrl, { max: 1 });

		try {
			const [applicationDatabase] = await db.execute<{ name: string }>(
				sql`SELECT current_database() AS name`
			);
			expect(applicationDatabase.name).toBe(new URL(databaseUrl).pathname.slice(1));
			await client`INSERT INTO "user" (id, name, email, email_verified, created_at, updated_at)
			VALUES ('harness-athlete', 'Harness Athlete', 'harness@example.com', true, now(), now())`;
			await resetTestDatabase(databaseUrl);
			const [{ count }] = await client<
				{ count: number }[]
			>`SELECT count(*)::int AS count FROM "user"`;

			expect(count).toBe(0);
		} finally {
			await client.end();
		}
	}
);
