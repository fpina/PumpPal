import { logOperationalFailure } from '$lib/server/operational-log';
import { workoutBuilder } from '$lib/server/services/workout-builder';
import { requireAthleteId } from '$lib/server/workout-route';
import { createWorkoutSchema } from '$lib/types/workout.validation';
import { fail, redirect } from '@sveltejs/kit';
import type { Actions, PageServerLoad } from './$types';

export const load: PageServerLoad = ({ locals }) => {
	requireAthleteId(locals);
};

export const actions: Actions = {
	create: async ({ request, locals }) => {
		const athleteId = requireAthleteId(locals);

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
			const outcome = await workoutBuilder.execute(athleteId, {
				type: 'create_prescription',
				...result.data
			});
			if (!outcome.ok || outcome.command !== 'create_prescription') {
				throw new Error('Workout Builder rejected a validated creation command.');
			}
			workoutId = outcome.prescriptionId;
		} catch (cause) {
			logOperationalFailure('workout.create', cause);
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
