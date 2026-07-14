import { logOperationalFailure } from '$lib/server/operational-log';
import { trainingSession } from '$lib/server/services/training-session';
import type { TrainingSessionOutcome } from '$lib/server/services/training-session';
import { positiveRouteId, requireAthleteId } from '$lib/server/workout-route';
import {
	liveSetSchema,
	setMutationSchema,
	workoutMutationSchema
} from '$lib/types/workout.validation';
import { error, fail } from '@sveltejs/kit';
import type { Actions, PageServerLoad } from './$types';

function transitionFailure(code: 'not_found' | 'invalid_transition', message: string) {
	return fail(code === 'not_found' ? 404 : 409, { success: false, message });
}

async function applyTransition<T extends string>(
	operation: string,
	command: () => Promise<TrainingSessionOutcome<T>>,
	rejectionMessage: string,
	operationalMessage: string
) {
	try {
		const outcome = await command();
		return outcome.ok ? { success: true } : transitionFailure(outcome.code, rejectionMessage);
	} catch (cause) {
		logOperationalFailure(operation, cause);
		return fail(500, { success: false, message: operationalMessage });
	}
}

export const load: PageServerLoad = async ({ params, locals }) => {
	const athleteId = requireAthleteId(locals);
	const workoutId = positiveRouteId(params.workoutId);
	if (!workoutId) throw error(404, 'Workout not found.');
	let workout;
	try {
		workout = await trainingSession.get(athleteId, workoutId);
	} catch (cause) {
		logOperationalFailure('training_session.load', cause);
		throw error(500, 'Could not load this Training Session.');
	}
	if (!workout) throw error(404, 'Workout not found.');
	return { workout };
};

export const actions: Actions = {
	start: async ({ request, params, locals }) => {
		const athleteId = requireAthleteId(locals);
		const workoutId = positiveRouteId(params.workoutId);
		const formData = await request.formData();
		const parsed = workoutMutationSchema.safeParse({ workoutId: formData.get('workoutId') });
		if (!parsed.success || parsed.data.workoutId !== workoutId) {
			return fail(400, { success: false, message: 'Invalid workout.' });
		}
		return applyTransition(
			'training_session.start',
			() => trainingSession.start(athleteId, parsed.data.workoutId),
			'This Training Session cannot be started.',
			'Could not start this Training Session.'
		);
	},
	reopen: async ({ request, params, locals }) => {
		const athleteId = requireAthleteId(locals);
		const workoutId = positiveRouteId(params.workoutId);
		const formData = await request.formData();
		const parsed = workoutMutationSchema.safeParse({ workoutId: formData.get('workoutId') });
		if (!parsed.success || parsed.data.workoutId !== workoutId) {
			return fail(400, { success: false, message: 'Invalid workout.' });
		}
		return applyTransition(
			'training_session.reopen',
			() => trainingSession.reopen(athleteId, parsed.data.workoutId),
			'This Training Session cannot be reopened.',
			'Could not reopen this Training Session.'
		);
	},
	finish: async ({ request, params, locals }) => {
		const athleteId = requireAthleteId(locals);
		const workoutId = positiveRouteId(params.workoutId);
		const formData = await request.formData();
		const parsed = workoutMutationSchema.safeParse({ workoutId: formData.get('workoutId') });
		if (!parsed.success || parsed.data.workoutId !== workoutId) {
			return fail(400, { success: false, message: 'Invalid workout.' });
		}
		return applyTransition(
			'training_session.finish',
			() => trainingSession.finish(athleteId, parsed.data.workoutId),
			'Only an active Training Session can be finished.',
			'Could not finish this Training Session.'
		);
	},
	activateSetTarget: async ({ request, params, locals }) => {
		const athleteId = requireAthleteId(locals);
		const workoutId = positiveRouteId(params.workoutId);
		const formData = await request.formData();
		const parsed = setMutationSchema.safeParse({ setId: formData.get('setId') });
		if (!parsed.success || !workoutId) {
			return fail(400, { success: false, message: 'Invalid set.' });
		}
		return applyTransition(
			'training_session.activate_set_target',
			() => trainingSession.activateSetTarget(athleteId, workoutId, parsed.data.setId),
			'That Set Target is not available.',
			'Could not activate that Set Target.'
		);
	},
	recordSetResult: async ({ request, params, locals }) => {
		const athleteId = requireAthleteId(locals);
		const workoutId = positiveRouteId(params.workoutId);
		const formData = await request.formData();
		const parsed = liveSetSchema.safeParse({
			setId: formData.get('setId'),
			reps: formData.get('reps'),
			weight: formData.get('weight'),
			weightUnit: formData.get('weightUnit')
		});
		if (!parsed.success || !workoutId) {
			return fail(400, {
				success: false,
				message: 'Check the actual reps and load.',
				errors: parsed.success ? {} : parsed.error.flatten().fieldErrors
			});
		}
		return applyTransition(
			'training_session.record_set_result',
			() =>
				trainingSession.recordSetResult(athleteId, workoutId, {
					setTargetId: parsed.data.setId,
					reps: parsed.data.reps,
					weight: parsed.data.weight,
					weightUnit: parsed.data.weightUnit
				}),
			'Activate this Set Target before recording its Set Result.',
			'Could not record that Set Result.'
		);
	},
	skipSetTarget: async ({ request, params, locals }) => {
		const athleteId = requireAthleteId(locals);
		const workoutId = positiveRouteId(params.workoutId);
		const formData = await request.formData();
		const parsed = setMutationSchema.safeParse({ setId: formData.get('setId') });
		if (!parsed.success || !workoutId) {
			return fail(400, { success: false, message: 'Invalid set.' });
		}
		return applyTransition(
			'training_session.skip_set_target',
			() => trainingSession.skipSetTarget(athleteId, workoutId, parsed.data.setId),
			'That Set Target cannot be skipped.',
			'Could not skip that Set Target.'
		);
	},
	dismissRest: async ({ params, locals }) => {
		const athleteId = requireAthleteId(locals);
		const workoutId = positiveRouteId(params.workoutId);
		if (!workoutId) return fail(400, { success: false, message: 'Invalid workout.' });
		return applyTransition(
			'training_session.dismiss_rest',
			() => trainingSession.dismissRest(athleteId, workoutId),
			'The rest timer cannot be dismissed.',
			'Could not dismiss the rest timer.'
		);
	}
};
