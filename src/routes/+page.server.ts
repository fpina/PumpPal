import { logOperationalFailure } from '$lib/server/operational-log';
import { workoutService } from '$lib/server/services/workout.service';
import { error, redirect } from '@sveltejs/kit';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ locals }) => {
	if (!locals.user) {
		throw redirect(302, '/auth');
	}

	try {
		return {
			workouts: await workoutService.getWorkoutsByUserId(locals.user.id)
		};
	} catch (cause) {
		logOperationalFailure('workout.list', cause);
		throw error(500, 'Could not load your workouts.');
	}
};
