import { assert, describe, test } from 'vitest';
import '@testing-library/jest-dom/vitest';
import { render, screen } from '@testing-library/svelte';
import Page from './+page.svelte';

describe('/+page.svelte', () => {
	test('should render h1', () => {
		render(Page, { data: { user: null, workouts: [] } });
		assert.strictEqual(screen.getByRole('heading', { level: 1 }).textContent, 'My workouts');
	});
});
