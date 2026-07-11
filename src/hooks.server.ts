import { building } from '$app/environment';
import { auth } from '$lib/auth';
import { svelteKitHandler } from 'better-auth/svelte-kit';

export async function handle({ event, resolve }) {
	const authSession = await auth.api.getSession({
		headers: event.request.headers
	});

	event.locals.user = authSession?.user ?? null;
	event.locals.session = authSession?.session ?? null;

	return svelteKitHandler({ event, resolve, auth, building });
}
