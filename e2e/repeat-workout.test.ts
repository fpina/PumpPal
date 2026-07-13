import { expect, test, type Page } from '@playwright/test';

async function register(page: Page, suffix: string) {
	const email = `repeat-${suffix}@example.com`;
	await page.goto('/auth/register');
	await page.getByLabel('Name').fill('Repeat Workout Athlete');
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

test('an athlete can repeat populated and empty workouts without duplicating submissions', async ({
	page
}) => {
	test.setTimeout(60_000);
	const suffix = `${Date.now()}-${Math.random().toString(16).slice(2)}`;
	const warmupName = `Warm-up press ${suffix}`;
	const exerciseName = `Tempo press ${suffix}`;
	await register(page, suffix);

	await page.getByRole('link', { name: /New workout/i }).click();
	await page.getByLabel('Workout name').fill('Repeatable push day');
	await page.getByLabel('Session notes').fill('Keep one rep in reserve');
	await page.getByRole('button', { name: /Save & build workout/i }).click();
	await expect(page).toHaveURL(/\/workouts\/\d+$/);
	const sourceUrl = page.url();

	await page.getByLabel('Exercise name').fill(warmupName);
	await page.getByLabel('Muscle group').fill('Chest');
	await page.getByRole('button', { name: 'Create & add' }).click();
	await expect(page.getByRole('heading', { name: warmupName })).toBeVisible();
	await page.getByLabel('Exercise name').fill(exerciseName);
	await page.getByLabel('Muscle group').fill('Chest');
	await page.getByRole('button', { name: 'Create & add' }).click();
	await expect(page.getByRole('heading', { name: exerciseName })).toBeVisible();
	await page.getByLabel('Choose exercise').selectOption({ label: `${exerciseName} · Chest` });
	await page.getByLabel('Notes — optional').fill('Three-second lowering phase');
	await page.getByRole('button', { name: 'Add from library' }).click();

	const sourceExercise = page.locator('article').nth(2);
	await sourceExercise.getByLabel('Reps').fill('8');
	await sourceExercise.getByLabel('Weight').fill('70');
	await sourceExercise.getByLabel('Rest').fill('90');
	await sourceExercise.getByRole('button', { name: 'Add set' }).click();
	await expect(sourceExercise.getByText('70 kg')).toBeVisible();

	const repeatForm = page.getByRole('button', { name: 'Repeat workout' }).locator('..');
	const workoutId = await repeatForm.locator('input[name="workoutId"]').inputValue();
	const repeatToken = await repeatForm.locator('input[name="repeatToken"]').inputValue();
	const actionHeaders = {
		accept: 'application/json',
		origin: 'http://localhost:4173',
		'x-sveltekit-action': 'true'
	};
	const repeatRequest = () =>
		page.request.post(`${sourceUrl}?/repeatWorkout`, {
			headers: actionHeaders,
			form: { workoutId, repeatToken }
		});
	const [firstRepeat, duplicateRepeat] = await Promise.all([repeatRequest(), repeatRequest()]);
	const firstResult = await firstRepeat.json();
	const duplicateResult = await duplicateRepeat.json();
	for (const result of [firstResult, duplicateResult]) {
		expect(result).toMatchObject({ type: 'redirect', status: 303 });
	}
	expect(duplicateResult.location).toBe(firstResult.location);

	await page.goto(firstResult.location);
	await expect(page.getByRole('heading', { level: 1, name: 'Repeatable push day' })).toBeVisible();
	await expect(page.getByText('Keep one rep in reserve')).toBeVisible();
	await expect(page.getByText('Three-second lowering phase')).toBeVisible();
	await expect(page.locator('article h3')).toHaveText([warmupName, exerciseName, exerciseName]);
	await expect(page.getByText('Planned', { exact: true })).toBeVisible();
	await expect(page.getByText('70 kg')).toBeVisible();

	const repeatedExercise = page.locator('article').nth(2);
	await repeatedExercise.getByText('Edit', { exact: true }).click();
	const editForm = repeatedExercise.getByRole('button', { name: 'Save set' }).locator('..');
	await expect(editForm.getByLabel('Completed')).not.toBeChecked();
	await editForm.getByLabel('Reps').fill('9');
	await editForm.getByLabel('Completed').check();
	await editForm.getByRole('button', { name: 'Save set' }).click();
	await expect(repeatedExercise.getByText('Complete', { exact: true })).toBeVisible();
	await expect(repeatedExercise.getByText('9', { exact: true })).toBeVisible();

	await page.goto(sourceUrl);
	const unchangedSourceExercise = page.locator('article').nth(2);
	await expect(unchangedSourceExercise.getByText('8', { exact: true })).toBeVisible();
	await expect(unchangedSourceExercise.getByText('Complete', { exact: true })).toBeVisible();

	await page.goto('/');
	await expect(page.getByRole('link', { name: 'Repeatable push day' })).toHaveCount(2);

	await page.getByRole('link', { name: /New workout/i }).click();
	await page.getByLabel('Workout name').fill('Empty recovery session');
	await page.getByRole('button', { name: /Save & build workout/i }).click();
	await expect(page).toHaveURL(/\/workouts\/\d+$/);
	const emptySourceUrl = page.url();
	await page.getByRole('button', { name: 'Repeat workout' }).click();
	await expect(page).not.toHaveURL(emptySourceUrl);
	await expect(page.getByText('Build your first movement')).toBeVisible();

	await page.getByRole('button', { name: 'Sign out' }).click();
	await register(page, `${suffix}-outsider`);
	const unauthorizedRepeat = await page.request.post(`${sourceUrl}?/repeatWorkout`, {
		headers: actionHeaders,
		form: { workoutId, repeatToken: crypto.randomUUID() }
	});
	expect(await unauthorizedRepeat.json()).toMatchObject({ type: 'failure', status: 404 });
	await page.goto(sourceUrl);
	await expect(page.getByText('Workout not found.')).toBeVisible();
});
