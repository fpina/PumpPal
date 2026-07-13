import { defineConfig } from '@playwright/test';

export default defineConfig({
	workers: 1,
	webServer: {
		command: 'npm run build && npm run preview',
		port: 4173,
		env: {
			...process.env,
			BETTER_AUTH_URL: 'http://localhost:4173',
			E2E_TESTING: 'true'
		}
	},
	testDir: 'e2e'
});
