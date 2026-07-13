import { expect, test } from './fixtures';

test.use({ timezoneId: 'Pacific/Kiritimati' });

test('an Athlete can create, edit, and repeat an exact Workout Date in UTC+14', async ({
	page,
	athlete
}) => {
	const suffix = `${Date.now()}-${Math.random().toString(16).slice(2)}`;
	await athlete.register({
		name: 'Workout Date Athlete',
		emailPrefix: `workout-date-${suffix}`
	});

	await page.getByRole('link', { name: /New workout/i }).click();
	await page.getByLabel('Workout Date').fill('2026-03-08');
	await page.getByLabel('Workout name').fill('Timezone-proof session');
	await page.getByRole('button', { name: /Save & build workout/i }).click();
	await expect(page.getByLabel('Workout Date')).toHaveValue('2026-03-08');
	await expect(page.getByText('March 8, 2026')).toBeVisible();

	await page.getByText('Edit workout details').click();
	await page.getByLabel('Workout Date').fill('2026-11-01');
	await page.getByRole('button', { name: 'Save workout' }).click();
	await expect(page.getByLabel('Workout Date')).toHaveValue('2026-11-01');
	await expect(page.getByText('November 1, 2026')).toBeVisible();

	await page.getByLabel('Repeat on').fill('2027-01-02');
	await page.getByRole('button', { name: 'Repeat workout' }).click();
	await expect(page.getByLabel('Workout Date')).toHaveValue('2027-01-02');
	await expect(page.getByText('January 2, 2027')).toBeVisible();

	await page.getByRole('link', { name: 'Start workout' }).click();
	await page.getByRole('button', { name: 'Start workout' }).click();
	await expect(page.locator('.session-clock')).toHaveAttribute(
		'aria-label',
		/Workout duration 00:[01]\d/
	);

	await page.reload();
	await expect(page.locator('.session-clock')).toHaveAttribute(
		'aria-label',
		/Workout duration 00:[01]\d/
	);
});
