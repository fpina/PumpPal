import { getRequestEvent } from '$app/server';
import { env } from '$env/dynamic/private';
import { db } from '$lib/server/db';
import * as schema from '$lib/server/db/schema';
import { drizzleAdapter } from 'better-auth/adapters/drizzle';
import { betterAuth } from 'better-auth/minimal';
import { sveltekitCookies } from 'better-auth/svelte-kit';

export const auth = betterAuth({
	appName: 'PumpPal',
	baseURL: env.BETTER_AUTH_URL,
	secret: env.AUTH_SECRET,
	database: drizzleAdapter(db, {
		provider: 'pg',
		schema
	}),
	emailAndPassword: {
		enabled: true
	},
	rateLimit: {
		enabled: env.E2E_TESTING !== 'true'
	},
	plugins: [sveltekitCookies(getRequestEvent)]
});
