import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import * as schema from './schema';
import { env } from '$env/dynamic/private';

const databaseUrl = process.env.PUMPPAL_TEST_DATABASE_URL ?? env.DATABASE_URL;
if (!databaseUrl) throw new Error('DATABASE_URL is not set');
if (process.env.PUMPPAL_TEST_DATABASE_URL && !databaseUrl.includes('_test_')) {
	throw new Error('PUMPPAL_TEST_DATABASE_URL must target an isolated test database.');
}

const client = postgres(databaseUrl);

export const db = drizzle(client, { schema });
