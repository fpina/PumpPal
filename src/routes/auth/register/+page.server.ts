import { auth } from '$lib/auth';
import { isExpectedAuthFailure } from '$lib/server/auth-error';
import { logOperationalFailure } from '$lib/server/operational-log';
import { registerSchema } from '$lib/types/register.validation';
import { fail, redirect } from '@sveltejs/kit';
import type { Actions, PageServerLoad } from './$types';

export const load: PageServerLoad = ({ locals }) => {
	if (locals.user) {
		throw redirect(302, '/');
	}
};

export const actions: Actions = {
	register: async ({ request }) => {
		const formData = await request.formData();
		const values = {
			name: String(formData.get('name') ?? ''),
			email: String(formData.get('email') ?? '')
		};
		const result = registerSchema.safeParse(Object.fromEntries(formData));

		if (!result.success) {
			return fail(400, {
				success: false,
				message: 'Check the highlighted fields.',
				errors: result.error.flatten().fieldErrors,
				values
			});
		}

		const { name, email, password } = result.data;

		try {
			await auth.api.signUpEmail({
				body: { name, email, password },
				headers: request.headers
			});
		} catch (cause) {
			if (isExpectedAuthFailure('register', cause)) {
				return fail(400, {
					success: false,
					message: 'Could not create that account. The email may already be registered.',
					errors: {
						name: undefined,
						email: undefined,
						password: undefined,
						confirmPassword: undefined
					},
					values
				});
			}
			logOperationalFailure('auth.register', cause);
			return fail(500, {
				success: false,
				message: 'Could not create that account. Please try again.',
				errors: {
					name: undefined,
					email: undefined,
					password: undefined,
					confirmPassword: undefined
				},
				values
			});
		}

		throw redirect(303, '/');
	}
};
