import { expect, test } from './fixtures';

test('an athlete can repeat populated and empty workouts without duplicating submissions', async ({
	page,
	athlete
}) => {
	test.setTimeout(60_000);
	const suffix = `${Date.now()}-${Math.random().toString(16).slice(2)}`;
	const warmupName = `Warm-up press ${suffix}`;
	const exerciseName = `Tempo press ${suffix}`;
	await athlete.register({ name: 'Repeat Workout Athlete', emailPrefix: `repeat-${suffix}` });

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
	await page.getByRole('button', { name: 'Add from Catalog' }).click();

	const sourceExercise = page.locator('article').nth(2);
	await sourceExercise.getByLabel('Reps').fill('8');
	await sourceExercise.getByLabel('Weight').fill('70');
	await sourceExercise.getByLabel('Rest').fill('90');
	await sourceExercise.getByRole('button', { name: 'Add set' }).click();
	await expect(sourceExercise.getByText('Set Target: 8 reps · 70 kg')).toBeVisible();

	const workoutId = sourceUrl.split('/').at(-1)!;
	const repeatDate = await page.getByLabel('Repeat on').inputValue();
	const actionHeaders = {
		accept: 'application/json',
		origin: 'http://localhost:4173',
		'x-sveltekit-action': 'true'
	};
	await page.getByRole('button', { name: 'Repeat workout' }).click();
	await expect(page).not.toHaveURL(sourceUrl);
	await expect(page.getByRole('heading', { level: 1, name: 'Repeatable push day' })).toBeVisible();
	await expect(page.getByText('Keep one rep in reserve')).toBeVisible();
	await expect(page.getByText('Three-second lowering phase')).toBeVisible();
	await expect(page.locator('article h3')).toHaveText([warmupName, exerciseName, exerciseName]);
	await expect(page.getByText('Planned', { exact: true })).toBeVisible();
	await expect(page.getByText('Set Target: 8 reps · 70 kg')).toBeVisible();
	const repeatedUrl = page.url();

	await page.getByRole('link', { name: 'Start Training Session' }).click();
	await page.getByRole('button', { name: 'Start Training Session' }).click();
	const liveSet = page.locator('.live-set').first();
	await liveSet.getByRole('button', { name: 'Activate Set Target' }).click();
	await liveSet.getByLabel('Set Result reps').fill('9');
	await liveSet.getByLabel('Set Result load').fill('70');
	await liveSet.getByRole('button', { name: 'Record Set Result' }).click();
	page.once('dialog', (dialog) => dialog.accept());
	await page.getByRole('button', { name: 'Finish Training Session' }).click();

	await page.goto(repeatedUrl);
	const repeatedExercise = page.locator('article').nth(2);
	await expect(repeatedExercise.getByText('Complete', { exact: true })).toBeVisible();
	await expect(repeatedExercise.getByText('Set Target: 8 reps · 70 kg')).toBeVisible();
	await expect(repeatedExercise.getByText('Set Result: 9 reps · 70 kg')).toBeVisible();

	await page.goto(sourceUrl);
	const unchangedSourceExercise = page.locator('article').nth(2);
	await expect(unchangedSourceExercise.getByText('Set Target: 8 reps · 70 kg')).toBeVisible();
	await expect(unchangedSourceExercise.getByText('Planned', { exact: true })).toBeVisible();
	await expect(unchangedSourceExercise.getByText('Set Result: —')).toBeVisible();

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
	await athlete.register({
		name: 'Repeat Workout Athlete',
		emailPrefix: `repeat-${suffix}-outsider`
	});
	const unauthorizedRepeat = await page.request.post(`${sourceUrl}?/repeatWorkout`, {
		headers: actionHeaders,
		form: { workoutId, repeatToken: crypto.randomUUID(), date: repeatDate }
	});
	expect(await unauthorizedRepeat.json()).toMatchObject({ type: 'failure', status: 404 });
	await page.goto(sourceUrl);
	await expect(page.getByText('Workout not found.')).toBeVisible();
});
