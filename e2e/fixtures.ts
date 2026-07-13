import { randomUUID } from 'node:crypto';
import { expect, test as base, type Page } from '@playwright/test';
import { deleteAthletesByEmail } from '../tests/harness/database';
import { databaseUrlFor } from '../tests/harness/environment';

interface RegisterAthleteOptions {
	name?: string;
	emailPrefix?: string;
	password?: string;
}

export interface AthleteCredentials {
	name: string;
	email: string;
	password: string;
}

class BrowserAthleteHarness {
	readonly #emails: string[] = [];

	constructor(private readonly page: Page) {}

	async register(options: RegisterAthleteOptions = {}) {
		const credentials = {
			name: options.name ?? 'Test Athlete',
			email: `${options.emailPrefix ?? 'athlete'}-${randomUUID()}@example.com`,
			password: options.password ?? 'correct-horse-42'
		};
		this.#emails.push(credentials.email);

		await this.page.goto('/auth/register');
		await this.page.getByLabel('Name').fill(credentials.name);
		await this.page.getByLabel('Email address').fill(credentials.email);
		await this.page.getByLabel('Password', { exact: true }).fill(credentials.password);
		await this.page.getByLabel('Confirm password').fill(credentials.password);
		await this.page.getByRole('button', { name: 'Create account' }).click();
		await this.page.waitForLoadState('networkidle');
		if (new URL(this.page.url()).pathname !== '/') await this.login(credentials);
		await expect(this.page).toHaveURL('/');
		return credentials;
	}

	async login(credentials: AthleteCredentials) {
		await this.page.goto('/auth');
		await this.page.getByLabel('Email address').fill(credentials.email);
		await this.page.getByLabel('Password').fill(credentials.password);
		await this.page.getByRole('button', { name: 'Sign in' }).click();
		await expect(this.page).toHaveURL('/');
	}

	async cleanup() {
		await deleteAthletesByEmail(databaseUrlFor('e2e'), this.#emails);
	}
}

export const test = base.extend<{ athlete: BrowserAthleteHarness }>({
	athlete: async ({ page }, use) => {
		const athlete = new BrowserAthleteHarness(page);
		await use(athlete);
		await athlete.cleanup();
	}
});

export { expect };
