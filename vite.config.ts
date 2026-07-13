import tailwindcss from '@tailwindcss/vite';
import { svelteTesting } from '@testing-library/svelte/vite';
import { sveltekit } from '@sveltejs/kit/vite';
import { defineConfig } from 'vite';
import { databaseUrlFor } from './tests/harness/environment';

export default defineConfig({
	plugins: [tailwindcss(), sveltekit()],
	test: {
		fileParallelism: false,
		projects: [
			{
				extends: './vite.config.ts',
				plugins: [svelteTesting()],
				test: {
					name: 'client',
					environment: 'jsdom',
					clearMocks: true,
					include: ['src/**/*.svelte.{test,spec}.{js,ts}'],
					exclude: ['src/lib/server/**'],
					setupFiles: ['./vitest-setup-client.ts']
				}
			},
			{
				extends: './vite.config.ts',
				test: {
					name: 'server',
					environment: 'node',
					include: ['src/**/*.{test,spec}.{js,ts}', 'tests/harness/**/*.{test,spec}.{js,ts}'],
					exclude: ['src/**/*.svelte.{test,spec}.{js,ts}', '**/*.integration.{test,spec}.{js,ts}']
				}
			},
			{
				extends: './vite.config.ts',
				test: {
					name: 'integration',
					environment: 'node',
					env: { PUMPPAL_TEST_DATABASE_URL: databaseUrlFor('integration') },
					include: [
						'src/**/*.integration.{test,spec}.{js,ts}',
						'tests/**/*.integration.{test,spec}.{js,ts}'
					],
					globalSetup: ['./tests/harness/vitest-global-setup.ts'],
					setupFiles: ['./tests/harness/vitest-setup.ts']
				}
			}
		]
	}
});
