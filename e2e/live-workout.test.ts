import { expect, test, type Page } from '@playwright/test';

async function register(page: Page, suffix: string) {
	const email = `live-${suffix}@example.com`;
	await page.goto('/auth/register');
	await page.getByLabel('Name').fill('Live Training Athlete');
	await page.getByLabel('Email address').fill(email);
	await page.getByLabel('Password', { exact: true }).fill('correct-horse-42');
	await page.getByLabel('Confirm password').fill('correct-horse-42');
	await page.getByRole('button', { name: 'Create account' }).click();
	await page.waitForLoadState('networkidle');
	if (new URL(page.url()).pathname !== '/') {
		await page.goto('/auth');
		await page.getByLabel('Email address').fill(email);
		await page.getByLabel('Password').fill('correct-horse-42');
		await page.getByRole('button', { name: 'Sign in' }).click();
	}
	await expect(page).toHaveURL('/');
}

test('an athlete can run, resume, finish, and reopen a live workout', async ({ page }) => {
	test.setTimeout(60_000);
	const suffix = `${Date.now()}-${Math.random().toString(16).slice(2)}`;
	await register(page, suffix);

	await page.getByRole('link', { name: /New workout/i }).click();
	await page.getByLabel('Workout name').fill('Live strength session');
	await page.getByRole('button', { name: /Save & build workout/i }).click();
	await expect(page).toHaveURL(/\/workouts\/\d+$/);
	const detailUrl = page.url();
	const workoutId = detailUrl.split('/').at(-1)!;

	await page.getByLabel('Exercise name').fill(`Live squat ${suffix}`);
	await page.getByLabel('Muscle group').fill('Legs');
	await page.getByRole('button', { name: 'Create & add' }).click();
	for (const [index, [reps, weight]] of [
		['8', '100'],
		['6', '105']
	].entries()) {
		const addSetForm = page
			.locator('form')
			.filter({ has: page.getByRole('button', { name: 'Add set' }) });
		await addSetForm.getByLabel('Reps').fill(reps);
		await addSetForm.getByLabel('Weight').fill(weight);
		await addSetForm.getByLabel('Rest').fill('2');
		await addSetForm.getByLabel('Completed').uncheck();
		await addSetForm.getByRole('button', { name: 'Add set' }).click();
		await expect(page.locator('tbody tr')).toHaveCount(index + 1);
	}

	await page.getByRole('link', { name: 'Start workout' }).click();
	await expect(page).toHaveURL(`${detailUrl}/live`);
	await page.getByRole('button', { name: 'Start workout' }).click();
	await expect(page.getByText('0 / 2 sets complete')).toBeVisible();

	const firstSet = page.locator('.live-set').first();
	await firstSet.getByRole('button', { name: 'Start set' }).click();
	await firstSet.getByLabel('Actual reps').fill('9');
	await firstSet.getByLabel('Actual load').fill('102.5');
	await firstSet.getByRole('button', { name: 'Complete set' }).click();
	await expect(page.getByText('1 / 2 sets complete')).toBeVisible();
	await expect(page.getByText('Rest timer')).toBeVisible();

	await page.reload();
	await expect(page.getByText('1 / 2 sets complete')).toBeVisible();
	await expect(firstSet.getByText('9 reps')).toBeVisible();
	await expect(firstSet.getByText(/102\.5 kg/)).toBeVisible();
	await expect(page.getByText(/Rest (timer|complete)/)).toBeVisible();
	await expect(page.getByText('Rest complete')).toBeVisible({ timeout: 5_000 });

	const secondSet = page.locator('.live-set').nth(1);
	await secondSet.getByRole('button', { name: 'Skip' }).click();
	await expect(secondSet.getByText('skipped', { exact: true })).toBeVisible();

	await page.goto(detailUrl);
	await expect(page.getByRole('link', { name: 'Resume workout' })).toBeVisible();
	await page.getByRole('link', { name: 'Resume workout' }).click();
	page.once('dialog', (dialog) => dialog.accept());
	await page.getByRole('button', { name: 'Finish workout' }).click();
	await expect(page.getByRole('heading', { name: 'Session locked.' })).toBeVisible();

	const actionHeaders = {
		accept: 'application/json',
		origin: 'http://localhost:4173',
		'x-sveltekit-action': 'true'
	};
	const lockedEdit = await page.request.post(`${detailUrl}?/updateWorkout`, {
		headers: actionHeaders,
		form: {
			workoutId,
			name: 'Accidental edit',
			date: '2026-07-13',
			notes: ''
		}
	});
	expect(await lockedEdit.json()).toMatchObject({ type: 'failure', status: 404 });
	const lockedDelete = await page.request.post(`${detailUrl}?/deleteWorkout`, {
		headers: actionHeaders,
		form: { workoutId }
	});
	expect(await lockedDelete.json()).toMatchObject({ type: 'failure', status: 404 });

	await page.getByRole('button', { name: 'Reopen workout' }).click();
	await expect(page.getByRole('button', { name: 'Finish workout' })).toBeVisible();
	await page.goto(detailUrl);
	await expect(page.getByRole('link', { name: 'Resume workout' })).toBeVisible();
});
