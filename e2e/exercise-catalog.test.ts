import { expect, test, type Page } from '@playwright/test';

async function registerAthlete(page: Page, identity: string) {
	const email = `catalog-${identity}@example.com`;
	await page.goto('/auth/register');
	await page.getByLabel('Name').fill('Catalog Athlete');
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

async function createWorkoutPrescription(page: Page, name: string) {
	await page.getByRole('link', { name: /New workout/i }).click();
	await page.getByLabel('Workout name').fill(name);
	await page.getByRole('button', { name: /Save & build workout/i }).click();
	await expect(page).toHaveURL(/\/workouts\/\d+$/);
}

test('a Custom Exercise is visible only to its owning Athlete', async ({ page }) => {
	const suffix = `${Date.now()}-${Math.random().toString(16).slice(2)}`;
	const customExercise = `Private press ${suffix}`;

	await registerAthlete(page, `${suffix}-owner`);
	await createWorkoutPrescription(page, 'Owner prescription');
	await page.getByLabel('Exercise name').fill(customExercise);
	await page.getByRole('button', { name: 'Create & add' }).click();
	await expect(page.getByRole('heading', { name: customExercise })).toBeVisible();
	const ownerExerciseId = await page
		.getByLabel('Choose exercise')
		.locator('option', { hasText: customExercise })
		.getAttribute('value');
	expect(ownerExerciseId).not.toBeNull();

	await page.getByRole('button', { name: 'Sign out' }).click();
	await registerAthlete(page, `${suffix}-other`);
	await createWorkoutPrescription(page, 'Other prescription');
	await expect(
		page.getByLabel('Choose exercise').locator('option', { hasText: customExercise })
	).toHaveCount(0);
	const unauthorizedAdd = await page.request.post(`${page.url()}?/addExercise`, {
		headers: {
			accept: 'application/json',
			origin: 'http://localhost:4173',
			'x-sveltekit-action': 'true'
		},
		form: { exerciseId: ownerExerciseId!, order: '1', notes: '' }
	});
	expect(await unauthorizedAdd.json()).toMatchObject({ type: 'failure' });
	await page.reload();
	await expect(page.getByRole('heading', { name: customExercise })).toHaveCount(0);

	await page.getByLabel('Exercise name').fill(customExercise);
	await page.getByRole('button', { name: 'Create & add' }).click();
	await expect(page.getByRole('heading', { name: customExercise })).toBeVisible();

	const normalizedCollision = `  ${customExercise.toUpperCase().replaceAll(' ', '   ')}  `;
	await page.getByLabel('Exercise name').fill(normalizedCollision);
	await page.getByRole('button', { name: 'Create & add' }).click();
	await expect(page.getByText('A Custom Exercise with that name already exists.')).toBeVisible();
	await expect(page.getByRole('heading', { name: customExercise })).toHaveCount(1);

	const sourceUrl = page.url();
	await page.getByRole('button', { name: 'Repeat workout' }).click();
	await expect(page).not.toHaveURL(sourceUrl);
	await expect(page.getByRole('heading', { name: customExercise })).toBeVisible();
});
