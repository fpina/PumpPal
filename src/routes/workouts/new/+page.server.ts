import { workoutService } from '$lib/server/services/workout.service';
import { createWorkoutSchema } from '$lib/types/workout.validation';
import { fail, redirect } from '@sveltejs/kit';
import type { Actions, PageServerLoad } from './$types';

export const load: PageServerLoad = ({ locals }) => {
	if (!locals.user) {
		throw redirect(302, '/auth');
	}
};

export const actions: Actions = {
	create: async ({ request, locals }) => {
		if (!locals.user) {
			throw redirect(302, '/auth');
		}

		const formData = await request.formData();
		const values = {
			date: String(formData.get('date') ?? ''),
			name: String(formData.get('name') ?? ''),
			notes: String(formData.get('notes') ?? '')
		};
		const result = createWorkoutSchema.safeParse(Object.fromEntries(formData));

		if (!result.success) {
			return fail(400, {
				success: false,
				message: 'Check the highlighted fields.',
				errors: result.error.flatten().fieldErrors,
				values
			});
		}

		let workoutId: number;
		try {
			const newWorkout = await workoutService.createWorkout(locals.user.id, result.data);
			workoutId = newWorkout.id;
		} catch (cause) {
			console.error('Failed to create workout:', cause);
			return fail(500, {
				success: false,
				message: 'Could not save the workout. Please try again.',
				errors: { date: undefined, name: undefined, notes: undefined },
				values
			});
		}

		throw redirect(303, `/workouts/${workoutId}`);
	}
};
