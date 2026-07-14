import { logOperationalFailure } from '$lib/server/operational-log';
import { workoutBuilder } from '$lib/server/services/workout-builder';
import { requireAthleteId } from '$lib/server/workout-route';
import { error } from '@sveltejs/kit';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ locals }) => {
	const athleteId = requireAthleteId(locals);

	try {
		return {
			workouts: await workoutBuilder.listPrescriptions(athleteId)
		};
	} catch (cause) {
		logOperationalFailure('workout.list', cause);
		throw error(500, 'Could not load your workouts.');
	}
};
