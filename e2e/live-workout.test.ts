import { expect, test } from './fixtures';

test('an Athlete can run, resume, finish, and reopen a Training Session', async ({
	page,
	athlete
}) => {
	test.setTimeout(60_000);
	const suffix = `${Date.now()}-${Math.random().toString(16).slice(2)}`;
	await athlete.register({ name: 'Live Training Athlete', emailPrefix: `live-${suffix}` });

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
		await addSetForm.getByRole('button', { name: 'Add set' }).click();
		await expect(page.locator('tbody tr')).toHaveCount(index + 1);
	}

	await page.getByRole('link', { name: 'Start Training Session' }).click();
	await expect(page).toHaveURL(`${detailUrl}/live`);
	await page.getByRole('button', { name: 'Start Training Session' }).click();
	await expect(page.getByText('0 / 2 sets complete')).toBeVisible();

	const firstSet = page.locator('.live-set').first();
	await firstSet.getByRole('button', { name: 'Activate Set Target' }).click();
	await firstSet.getByLabel('Set Result reps').fill('9');
	await firstSet.getByLabel('Set Result load').fill('102.5');
	await firstSet.getByRole('button', { name: 'Record Set Result' }).click();
	await expect(page.getByText('1 / 2 sets complete')).toBeVisible();
	await expect(page.getByText('Rest timer')).toBeVisible();

	await page.reload();
	await expect(page.getByText('1 / 2 sets complete')).toBeVisible();
	await expect(firstSet.getByText('Set Target 8 reps · 100 kg')).toBeVisible();
	await expect(firstSet.getByText('Set Result 9 reps · 102.5 kg')).toBeVisible();
	await expect(page.getByText(/Rest (timer|complete)/)).toBeVisible();
	await expect(page.getByText('Rest complete', { exact: true })).toBeVisible({ timeout: 5_000 });

	const secondSet = page.locator('.live-set').nth(1);
	await secondSet.getByRole('button', { name: 'Skip Set Target' }).click();
	await expect(secondSet.getByText('skipped', { exact: true })).toBeVisible();

	await page.goto(detailUrl);
	await expect(page.getByRole('link', { name: 'Resume Training Session' })).toBeVisible();
	await page.getByRole('link', { name: 'Resume Training Session' }).click();
	page.once('dialog', (dialog) => dialog.accept());
	await page.getByRole('button', { name: 'Finish Training Session' }).click();
	await expect(page.getByRole('heading', { name: 'Session locked.' })).toBeVisible();
	await expect(page.getByText('1 Training Segment')).toBeVisible();

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
	expect(await lockedEdit.json()).toMatchObject({ type: 'failure', status: 409 });
	const lockedDelete = await page.request.post(`${detailUrl}?/deleteWorkout`, {
		headers: actionHeaders,
		form: { workoutId }
	});
	expect(await lockedDelete.json()).toMatchObject({ type: 'failure', status: 409 });

	await page.getByRole('button', { name: 'Reopen Training Session' }).click();
	await expect(page.getByRole('button', { name: 'Finish Training Session' })).toBeVisible();
	await expect(
		page.locator('.live-set').first().getByText('Set Result 9 reps · 102.5 kg')
	).toBeVisible();
	await expect(
		page.locator('.live-set').first().getByRole('button', { name: 'Activate Set Target' })
	).toHaveCount(0);
	page.once('dialog', (dialog) => dialog.accept());
	await page.getByRole('button', { name: 'Finish Training Session' }).click();
	await expect(page.getByText('2 Training Segments')).toBeVisible();
	await page.goto(detailUrl);
	await expect(page.getByText('Set Target: 8 reps · 100 kg')).toBeVisible();
	await expect(page.getByText('Set Result: 9 reps · 102.5 kg')).toBeVisible();

	await page.getByRole('button', { name: 'Repeat workout' }).click();
	await expect(page.getByText('Set Target: 8 reps · 100 kg')).toBeVisible();
	await expect(page.getByText('Set Result: —')).toBeVisible();
});
