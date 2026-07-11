import { auth } from '$lib/auth';
import { redirect } from '@sveltejs/kit';
import type { RequestHandler } from './$types';

export const POST: RequestHandler = async ({ request }) => {
	await auth.api.signOut({
		headers: request.headers
	});

	throw redirect(303, '/auth');
};
