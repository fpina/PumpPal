import path from 'node:path';
import { drizzle } from 'drizzle-orm/postgres-js';
import { migrate } from 'drizzle-orm/postgres-js/migrator';
import postgres from 'postgres';

function databaseName(databaseUrl: string) {
	const name = decodeURIComponent(new URL(databaseUrl).pathname.slice(1));
	if (!name) throw new Error('Test database URL must include a database name.');
	return name;
}

function assertTestDatabase(databaseUrl: string) {
	const name = databaseName(databaseUrl);
	if (!name.includes('_test_')) {
		throw new Error(`Refusing to mutate non-test database "${name}".`);
	}
	return name;
}

export function deriveTestDatabaseUrl(sourceDatabaseUrl: string, suite: string) {
	const source = new URL(sourceDatabaseUrl);
	const sourceName = databaseName(sourceDatabaseUrl);
	const safeSuite = suite
		.toLowerCase()
		.replace(/[^a-z0-9]+/gu, '_')
		.replace(/^_+|_+$/gu, '');
	if (!safeSuite) throw new Error('Test database suite name must contain a letter or number.');
	source.pathname = `/${sourceName}_test_${safeSuite}`;
	return source.toString();
}

function adminDatabaseUrl(databaseUrl: string) {
	const adminUrl = new URL(databaseUrl);
	adminUrl.pathname = '/postgres';
	return adminUrl.toString();
}

type PostgresClient = ReturnType<typeof postgres>;

async function withTestDatabaseAdmin(
	databaseUrl: string,
	operation: (admin: PostgresClient, name: string) => Promise<void>
) {
	const name = assertTestDatabase(databaseUrl);
	const admin = postgres(adminDatabaseUrl(databaseUrl), { max: 1 });
	try {
		await operation(admin, name);
	} finally {
		await admin.end();
	}
}

async function removeTestDatabase(admin: PostgresClient, name: string) {
	await admin`SELECT pg_terminate_backend(pid) FROM pg_stat_activity WHERE datname = ${name} AND pid <> pg_backend_pid()`;
	await admin`DROP DATABASE IF EXISTS ${admin(name)}`;
}

export async function provisionTestDatabase(databaseUrl: string) {
	await withTestDatabaseAdmin(databaseUrl, async (admin, name) => {
		await removeTestDatabase(admin, name);
		await admin`CREATE DATABASE ${admin(name)}`;
	});

	const client = postgres(databaseUrl, { max: 1 });
	try {
		await migrate(drizzle(client), { migrationsFolder: path.resolve('drizzle') });
	} finally {
		await client.end();
	}
}

export async function resetTestDatabase(databaseUrl: string) {
	assertTestDatabase(databaseUrl);
	const client = postgres(databaseUrl, { max: 1 });
	try {
		await client.unsafe(
			'TRUNCATE TABLE "verification", "account", "session", "training_segment", "set", "workout_exercise", "workout", "exercise", "user" RESTART IDENTITY CASCADE'
		);
	} finally {
		await client.end();
	}
}

export async function deleteAthletesByEmail(databaseUrl: string, emails: string[]) {
	if (emails.length === 0) return;
	assertTestDatabase(databaseUrl);
	const client = postgres(databaseUrl, { max: 1 });
	try {
		for (const email of emails) {
			await client`DELETE FROM "user" WHERE email = ${email}`;
		}
	} finally {
		await client.end();
	}
}

export async function dropTestDatabase(databaseUrl: string) {
	await withTestDatabaseAdmin(databaseUrl, removeTestDatabase);
}
