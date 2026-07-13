import { defineConfig } from '@playwright/test';
import { databaseUrlFor } from './tests/harness/environment';

const databaseUrl = databaseUrlFor('e2e');

export default defineConfig({
	workers: 1,
	globalSetup: './tests/harness/playwright-global-setup.ts',
	globalTeardown: './tests/harness/playwright-global-teardown.ts',
	webServer: {
		command: 'npm run build && npm run preview',
		port: 4173,
		env: {
			...process.env,
			DATABASE_URL: databaseUrl,
			BETTER_AUTH_URL: 'http://localhost:4173',
			E2E_TESTING: 'true'
		}
	},
	testDir: 'e2e'
});
