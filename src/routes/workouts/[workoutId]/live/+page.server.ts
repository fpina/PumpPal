import { logOperationalFailure } from '$lib/server/operational-log';
import { WorkoutDomainError, workoutService } from '$lib/server/services/workout.service';
import {
	liveSetSchema,
	setMutationSchema,
	workoutMutationSchema
} from '$lib/types/workout.validation';
import { error, fail, redirect } from '@sveltejs/kit';
import type { Actions, PageServerLoad } from './$types';

function routeId(value: string) {
	const id = Number(value);
	return Number.isInteger(id) && id > 0 ? id : null;
}

export const load: PageServerLoad = async ({ params, locals }) => {
	if (!locals.user) throw redirect(302, '/auth');
	const workoutId = routeId(params.workoutId);
	if (!workoutId) throw error(404, 'Workout not found.');
	let workout;
	try {
		workout = await workoutService.getWorkoutById(locals.user.id, workoutId);
	} catch (cause) {
		logOperationalFailure('training_session.load', cause);
		throw error(500, 'Could not load this Training Session.');
	}
	if (!workout) throw error(404, 'Workout not found.');
	return { workout };
};

export const actions: Actions = {
	start: async ({ request, params, locals }) => {
		if (!locals.user) throw redirect(302, '/auth');
		const workoutId = routeId(params.workoutId);
		const formData = await request.formData();
		const result = workoutMutationSchema.safeParse({ workoutId: formData.get('workoutId') });
		if (!result.success || result.data.workoutId !== workoutId)
			return fail(400, { success: false, message: 'Invalid workout.' });
		try {
			await workoutService.startWorkout(locals.user.id, result.data.workoutId);
		} catch (cause) {
			if (cause instanceof WorkoutDomainError) {
				return fail(409, { success: false, message: 'This workout cannot be started.' });
			}
			logOperationalFailure('training_session.start', cause);
			return fail(500, { success: false, message: 'Could not start this Training Session.' });
		}
		return { success: true };
	},
	reopen: async ({ request, params, locals }) => {
		if (!locals.user) throw redirect(302, '/auth');
		const workoutId = routeId(params.workoutId);
		const formData = await request.formData();
		const result = workoutMutationSchema.safeParse({ workoutId: formData.get('workoutId') });
		if (!result.success || result.data.workoutId !== workoutId)
			return fail(400, { success: false, message: 'Invalid workout.' });
		try {
			await workoutService.reopenWorkout(locals.user.id, result.data.workoutId);
		} catch (cause) {
			if (cause instanceof WorkoutDomainError) {
				return fail(409, { success: false, message: 'This workout cannot be reopened.' });
			}
			logOperationalFailure('training_session.reopen', cause);
			return fail(500, { success: false, message: 'Could not reopen this Training Session.' });
		}
		return { success: true };
	},
	finish: async ({ request, params, locals }) => {
		if (!locals.user) throw redirect(302, '/auth');
		const workoutId = routeId(params.workoutId);
		const formData = await request.formData();
		const result = workoutMutationSchema.safeParse({ workoutId: formData.get('workoutId') });
		if (!result.success || result.data.workoutId !== workoutId)
			return fail(400, { success: false, message: 'Invalid workout.' });
		try {
			await workoutService.finishWorkout(locals.user.id, result.data.workoutId);
		} catch (cause) {
			if (cause instanceof WorkoutDomainError) {
				return fail(409, { success: false, message: 'Only an active workout can be finished.' });
			}
			logOperationalFailure('training_session.finish', cause);
			return fail(500, { success: false, message: 'Could not finish this Training Session.' });
		}
		return { success: true };
	},
	activateSet: async ({ request, params, locals }) => {
		if (!locals.user) throw redirect(302, '/auth');
		const workoutId = routeId(params.workoutId);
		const formData = await request.formData();
		const result = setMutationSchema.safeParse({ setId: formData.get('setId') });
		if (!result.success || !workoutId)
			return fail(400, { success: false, message: 'Invalid set.' });
		try {
			await workoutService.activateSet(locals.user.id, workoutId, result.data.setId);
		} catch (cause) {
			if (cause instanceof WorkoutDomainError) {
				return fail(409, { success: false, message: 'That set is not available.' });
			}
			logOperationalFailure('training_session.activate_set', cause);
			return fail(500, { success: false, message: 'Could not activate that Set Target.' });
		}
		return { success: true };
	},
	completeSet: async ({ request, params, locals }) => {
		if (!locals.user) throw redirect(302, '/auth');
		const workoutId = routeId(params.workoutId);
		const formData = await request.formData();
		const values = {
			setId: formData.get('setId'),
			reps: formData.get('reps'),
			weight: formData.get('weight'),
			weightUnit: formData.get('weightUnit')
		};
		const result = liveSetSchema.safeParse(values);
		if (!result.success || !workoutId)
			return fail(400, {
				success: false,
				message: 'Check the actual reps and load.',
				errors: result.success ? {} : result.error.flatten().fieldErrors
			});
		try {
			await workoutService.completeLiveSet(locals.user.id, workoutId, result.data);
		} catch (cause) {
			if (cause instanceof WorkoutDomainError) {
				return fail(409, { success: false, message: 'Activate this set before completing it.' });
			}
			logOperationalFailure('training_session.complete_set', cause);
			return fail(500, { success: false, message: 'Could not complete that Set Result.' });
		}
		return { success: true };
	},
	skipSet: async ({ request, params, locals }) => {
		if (!locals.user) throw redirect(302, '/auth');
		const workoutId = routeId(params.workoutId);
		const formData = await request.formData();
		const result = setMutationSchema.safeParse({ setId: formData.get('setId') });
		if (!result.success || !workoutId)
			return fail(400, { success: false, message: 'Invalid set.' });
		try {
			await workoutService.skipSet(locals.user.id, workoutId, result.data.setId);
		} catch (cause) {
			if (cause instanceof WorkoutDomainError) {
				return fail(409, { success: false, message: 'That set cannot be skipped.' });
			}
			logOperationalFailure('training_session.skip_set', cause);
			return fail(500, { success: false, message: 'Could not skip that Set Target.' });
		}
		return { success: true };
	},
	dismissRest: async ({ params, locals }) => {
		if (!locals.user) throw redirect(302, '/auth');
		const workoutId = routeId(params.workoutId);
		if (!workoutId) return fail(400, { success: false, message: 'Invalid workout.' });
		try {
			await workoutService.dismissRest(locals.user.id, workoutId);
		} catch (cause) {
			if (cause instanceof WorkoutDomainError) {
				return fail(409, { success: false, message: 'Rest timer could not be dismissed.' });
			}
			logOperationalFailure('training_session.dismiss_rest', cause);
			return fail(500, { success: false, message: 'Could not dismiss the rest timer.' });
		}
		return { success: true };
	}
};
