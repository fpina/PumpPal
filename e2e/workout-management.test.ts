import { expect, test } from '@playwright/test';

async function register(page: import('@playwright/test').Page, suffix: string) {
	const email = `issue-two-${suffix}@example.com`;
	await page.goto('/auth/register');
	await page.getByLabel('Name').fill('Issue Two Athlete');
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

test('an athlete can edit and delete their workout log while other users cannot access it', async ({
	page
}) => {
	test.setTimeout(60_000);
	const suffix = `${Date.now()}-${Math.random().toString(16).slice(2)}`;
	const ownerSuffix = `${suffix}-owner`;
	await register(page, ownerSuffix);

	await page.getByRole('link', { name: /New workout/i }).click();
	await page.getByLabel('Workout name').fill('Heavy push');
	await page.getByLabel('Session notes').fill('Original note');
	await page.getByRole('button', { name: /Save & build workout/i }).click();
	await expect(page).toHaveURL(/\/workouts\/\d+$/);

	await page.getByLabel('Exercise name').fill(`Incline press ${suffix}`);
	await page.getByLabel('Muscle group').fill('Chest');
	await page.getByRole('button', { name: 'Create & add' }).click();
	await expect(page.getByRole('heading', { name: `Incline press ${suffix}` })).toBeVisible();

	await page.getByLabel('Reps').fill('8');
	await page.getByLabel('Weight').fill('70');
	await page.getByLabel('Rest').fill('90');
	await page.getByRole('button', { name: 'Add set' }).click();
	await expect(page.getByText('70 kg')).toBeVisible();

	await page.getByText('Edit workout details').click();
	await page.getByLabel('Workout name').fill('Heavy push updated');
	await page.getByLabel('Notes', { exact: true }).fill('Updated note');
	await page.getByRole('button', { name: 'Save workout' }).click();
	await expect(page.getByRole('heading', { level: 1, name: 'Heavy push updated' })).toBeVisible();
	await expect(page.getByText('Updated note')).toBeVisible();

	await page.getByText('Edit', { exact: true }).click();
	const editSetForm = page.getByRole('button', { name: 'Save set' }).locator('..');
	await editSetForm.getByLabel('Reps').fill('10');
	await editSetForm.getByLabel('Weight').fill('72.5');
	await page.getByRole('button', { name: 'Save set' }).click();
	await expect(page.getByText('72.5 kg')).toBeVisible();
	await expect(page.getByText('10', { exact: true })).toBeVisible();

	page.once('dialog', (dialog) => dialog.accept());
	await page.getByRole('button', { name: 'Delete set' }).click();
	await expect(page.getByText('No sets logged.')).toBeVisible();

	await page.getByLabel('Reps').fill('6');
	await page.getByLabel('Weight').fill('60');
	await page.getByRole('button', { name: 'Add set' }).click();
	await expect(page.getByText('60 kg')).toBeVisible();
	page.once('dialog', (dialog) => dialog.accept());
	await page.getByRole('button', { name: 'Remove' }).click();
	await expect(page.getByText('Build your first movement')).toBeVisible();

	await page.getByLabel('Exercise name').fill(`Populated delete ${suffix}`);
	await page.getByRole('button', { name: 'Create & add' }).click();
	await page.getByLabel('Reps').fill('5');
	await page.getByLabel('Weight').fill('80');
	await page.getByRole('button', { name: 'Add set' }).click();
	await expect(page.getByText('80 kg')).toBeVisible();
	page.once('dialog', (dialog) => dialog.accept());
	await page.getByRole('button', { name: 'Delete workout' }).click();
	await expect(page).toHaveURL('/');
	await expect(page.getByText('Heavy push updated')).not.toBeVisible();

	await page.getByRole('link', { name: /New workout/i }).click();
	await page.getByLabel('Workout name').fill('Private ownership check');
	await page.getByRole('button', { name: /Save & build workout/i }).click();
	await expect(page).toHaveURL(/\/workouts\/\d+$/);
	const privateWorkoutUrl = page.url();
	const privateWorkoutId = privateWorkoutUrl.split('/').at(-1)!;
	await page.getByLabel('Exercise name').fill(`Private exercise ${suffix}`);
	await page.getByRole('button', { name: 'Create & add' }).click();
	await page.getByLabel('Reps').fill('7');
	await page.getByRole('button', { name: 'Add set' }).click();
	await page.getByText('Edit', { exact: true }).click();
	const privateSetId = await page.locator('input[name="setId"]').first().inputValue();
	const privateWorkoutExerciseId = await page
		.locator('input[name="workoutExerciseId"]')
		.first()
		.inputValue();

	await page.getByRole('button', { name: 'Sign out' }).click();
	await register(page, `${suffix}-outsider`);

	const actionHeaders = {
		accept: 'application/json',
		origin: 'http://localhost:4173',
		'x-sveltekit-action': 'true'
	};
	const ownershipAttempts = await Promise.all([
		page.request.post(`${privateWorkoutUrl}?/updateWorkout`, {
			headers: actionHeaders,
			form: {
				workoutId: privateWorkoutId,
				name: 'Stolen workout',
				date: '2026-07-11',
				notes: ''
			}
		}),
		page.request.post(`${privateWorkoutUrl}?/deleteWorkout`, {
			headers: actionHeaders,
			form: { workoutId: privateWorkoutId }
		}),
		page.request.post(`${privateWorkoutUrl}?/updateSet`, {
			headers: actionHeaders,
			form: {
				setId: privateSetId,
				workoutExerciseId: privateWorkoutExerciseId,
				setNumber: '1',
				reps: '99',
				weight: '',
				weightUnit: 'kg',
				restTimeSeconds: '',
				completed: 'on'
			}
		}),
		page.request.post(`${privateWorkoutUrl}?/deleteSet`, {
			headers: actionHeaders,
			form: { setId: privateSetId }
		}),
		page.request.post(`${privateWorkoutUrl}?/removeExercise`, {
			headers: actionHeaders,
			form: { workoutExerciseId: privateWorkoutExerciseId }
		})
	]);
	for (const response of ownershipAttempts) {
		expect(await response.json()).toMatchObject({ type: 'failure', status: 404 });
	}

	await page.goto(privateWorkoutUrl);
	await expect(page.getByText('Workout not found.')).toBeVisible();
});
