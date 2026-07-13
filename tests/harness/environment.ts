import { loadEnv } from 'vite';
import { deriveTestDatabaseUrl } from './database';

const fileEnvironment = loadEnv('test', process.cwd(), '');
const sourceDatabaseUrl =
	process.env.PUMPPAL_SOURCE_DATABASE_URL ??
	process.env.DATABASE_URL ??
	fileEnvironment.DATABASE_URL;

if (!sourceDatabaseUrl) {
	throw new Error('DATABASE_URL is required to derive isolated test databases.');
}

const runId = process.env.PUMPPAL_TEST_RUN_ID;

export function databaseUrlFor(suite: 'integration' | 'e2e') {
	return deriveTestDatabaseUrl(sourceDatabaseUrl, runId ? `${suite}_${runId}` : suite);
}
