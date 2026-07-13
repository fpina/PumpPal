import { auth } from '$lib/auth';
import { isExpectedAuthFailure } from '$lib/server/auth-error';
import { logOperationalFailure } from '$lib/server/operational-log';
import { loginSchema } from '$lib/types/register.validation';
import { fail, redirect } from '@sveltejs/kit';
import type { Actions, PageServerLoad } from './$types';

export const load: PageServerLoad = ({ locals }) => {
	if (locals.user) {
		throw redirect(302, '/');
	}
};

export const actions: Actions = {
	login: async ({ request }) => {
		const formData = await request.formData();
		const values = {
			email: String(formData.get('email') ?? '')
		};
		const result = loginSchema.safeParse(Object.fromEntries(formData));

		if (!result.success) {
			return fail(400, {
				success: false,
				message: 'Check the highlighted fields.',
				errors: result.error.flatten().fieldErrors,
				values
			});
		}

		try {
			await auth.api.signInEmail({
				body: result.data,
				headers: request.headers
			});
		} catch (cause) {
			if (isExpectedAuthFailure('login', cause)) {
				return fail(400, {
					success: false,
					message: 'Email or password is incorrect.',
					errors: { email: undefined, password: undefined },
					values
				});
			}
			logOperationalFailure('auth.login', cause);
			return fail(500, {
				success: false,
				message: 'Could not sign you in. Please try again.',
				errors: { email: undefined, password: undefined },
				values
			});
		}

		throw redirect(303, '/');
	}
};
