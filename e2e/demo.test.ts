import { expect, test } from './fixtures';

test('unauthenticated users can reach the sign-in page', async ({ page }) => {
	await page.goto('/auth');
	await expect(page.getByRole('heading', { level: 1 })).toHaveText('Sign in to PumpPal');
});
