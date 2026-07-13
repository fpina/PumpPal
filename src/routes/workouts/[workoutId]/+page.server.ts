import { workoutService } from '$lib/server/services/workout.service';
import {
	addExerciseSchema,
	addSetSchema,
	createExerciseSchema,
	repeatWorkoutSchema,
	setMutationSchema,
	updateSetSchema,
	updateWorkoutSchema,
	workoutExerciseMutationSchema,
	workoutMutationSchema
} from '$lib/types/workout.validation';
import { error, fail, redirect } from '@sveltejs/kit';
import { randomUUID } from 'node:crypto';
import type { Actions, PageServerLoad } from './$types';

function parseWorkoutId(value: string) {
	const workoutId = Number(value);
	return Number.isInteger(workoutId) && workoutId > 0 ? workoutId : null;
}

export const load: PageServerLoad = async ({ params, locals }) => {
	if (!locals.user) {
		throw redirect(302, '/auth');
	}

	const workoutId = parseWorkoutId(params.workoutId);
	if (!workoutId) {
		throw error(404, 'Workout not found.');
	}

	const [workout, availableExercises] = await Promise.all([
		workoutService.getWorkoutById(locals.user.id, workoutId),
		workoutService.getExercises()
	]);

	if (!workout) {
		throw error(404, 'Workout not found.');
	}

	return { workout, availableExercises, repeatToken: randomUUID() };
};

export const actions: Actions = {
	repeatWorkout: async ({ request, locals, params }) => {
		if (!locals.user) throw redirect(302, '/auth');
		const routeWorkoutId = parseWorkoutId(params.workoutId);
		const formData = await request.formData();
		const values = {
			workoutId: String(formData.get('workoutId') ?? ''),
			repeatToken: String(formData.get('repeatToken') ?? '')
		};
		const result = repeatWorkoutSchema.safeParse(values);

		if (!result.success || result.data.workoutId !== routeWorkoutId) {
			return fail(400, {
				intent: 'repeatWorkout' as const,
				success: false,
				message: 'Could not repeat this workout.',
				errors: result.success ? {} : result.error.flatten().fieldErrors,
				values
			});
		}

		let repeatedWorkout;
		try {
			repeatedWorkout = await workoutService.repeatWorkout(locals.user.id, result.data);
		} catch (cause) {
			console.error('Failed to repeat workout:', cause);
			return fail(404, {
				intent: 'repeatWorkout' as const,
				success: false,
				message: 'Workout not found.',
				errors: {},
				values
			});
		}
		throw redirect(303, `/workouts/${repeatedWorkout.id}`);
	},
	updateWorkout: async ({ request, locals, params }) => {
		if (!locals.user) throw redirect(302, '/auth');
		const routeWorkoutId = parseWorkoutId(params.workoutId);
		const formData = await request.formData();
		const values = {
			workoutId: String(formData.get('workoutId') ?? ''),
			name: String(formData.get('name') ?? ''),
			date: String(formData.get('date') ?? ''),
			notes: String(formData.get('notes') ?? '')
		};
		const result = updateWorkoutSchema.safeParse(values);

		if (!result.success || result.data.workoutId !== routeWorkoutId) {
			return fail(400, {
				intent: 'updateWorkout' as const,
				success: false,
				message: 'Check the workout details.',
				errors: result.success ? {} : result.error.flatten().fieldErrors,
				values
			});
		}

		try {
			await workoutService.updateWorkout(locals.user.id, result.data);
		} catch (cause) {
			console.error('Failed to update workout:', cause);
			return fail(404, {
				intent: 'updateWorkout' as const,
				success: false,
				message: 'Workout not found.',
				errors: {},
				values
			});
		}

		return {
			intent: 'updateWorkout' as const,
			success: true,
			message: 'Workout updated.',
			errors: {},
			values
		};
	},

	deleteWorkout: async ({ request, locals, params }) => {
		if (!locals.user) throw redirect(302, '/auth');
		const routeWorkoutId = parseWorkoutId(params.workoutId);
		const formData = await request.formData();
		const result = workoutMutationSchema.safeParse({ workoutId: formData.get('workoutId') });
		if (!result.success || result.data.workoutId !== routeWorkoutId)
			return fail(400, {
				intent: 'deleteWorkout' as const,
				success: false,
				message: 'Invalid workout.',
				errors: {},
				values: {}
			});

		try {
			await workoutService.deleteWorkout(locals.user.id, result.data.workoutId);
		} catch (cause) {
			console.error('Failed to delete workout:', cause);
			return fail(404, {
				intent: 'deleteWorkout' as const,
				success: false,
				message: 'Workout not found.',
				errors: {},
				values: {}
			});
		}
		throw redirect(303, '/');
	},
	addExercise: async ({ request, locals, params }) => {
		if (!locals.user) {
			throw redirect(302, '/auth');
		}

		const workoutId = parseWorkoutId(params.workoutId);
		if (!workoutId) {
			return fail(400, {
				intent: 'addExercise' as const,
				success: false,
				message: 'Invalid workout.',
				errors: {},
				values: { exerciseId: '', order: '', notes: '' }
			});
		}

		const formData = await request.formData();
		const values = {
			exerciseId: String(formData.get('exerciseId') ?? ''),
			order: String(formData.get('order') ?? ''),
			notes: String(formData.get('notes') ?? '')
		};
		const result = addExerciseSchema.safeParse(values);

		if (!result.success) {
			return fail(400, {
				intent: 'addExercise' as const,
				success: false,
				message: 'Choose a valid exercise.',
				errors: result.error.flatten().fieldErrors,
				values
			});
		}

		try {
			await workoutService.addExerciseToWorkout(locals.user.id, {
				workoutId,
				...result.data
			});
		} catch (cause) {
			console.error('Failed to add exercise:', cause);
			return fail(500, {
				intent: 'addExercise' as const,
				success: false,
				message: 'Could not add that exercise.',
				errors: {},
				values
			});
		}

		return {
			intent: 'addExercise' as const,
			success: true,
			message: 'Exercise added.',
			errors: {},
			values: { exerciseId: '', order: '', notes: '' }
		};
	},

	createExercise: async ({ request, locals, params }) => {
		if (!locals.user) {
			throw redirect(302, '/auth');
		}

		const workoutId = parseWorkoutId(params.workoutId);
		if (!workoutId) {
			return fail(400, {
				intent: 'createExercise' as const,
				success: false,
				message: 'Invalid workout.',
				errors: {},
				values: { name: '', muscleGroup: '', order: '' }
			});
		}

		const formData = await request.formData();
		const values = {
			name: String(formData.get('name') ?? ''),
			muscleGroup: String(formData.get('muscleGroup') ?? ''),
			order: String(formData.get('order') ?? '')
		};
		const result = createExerciseSchema.safeParse(values);

		if (!result.success) {
			return fail(400, {
				intent: 'createExercise' as const,
				success: false,
				message: 'Check the new exercise details.',
				errors: result.error.flatten().fieldErrors,
				values
			});
		}

		try {
			await workoutService.createExerciseForWorkout(locals.user.id, {
				workoutId,
				...result.data
			});
		} catch (cause) {
			console.error('Failed to create exercise:', cause);
			return fail(500, {
				intent: 'createExercise' as const,
				success: false,
				message: 'Could not create that exercise. Its name may already be in the library.',
				errors: {},
				values
			});
		}

		return {
			intent: 'createExercise' as const,
			success: true,
			message: 'Exercise created and added.',
			errors: {},
			values: { name: '', muscleGroup: '', order: '' }
		};
	},

	addSet: async ({ request, locals }) => {
		if (!locals.user) {
			throw redirect(302, '/auth');
		}

		const formData = await request.formData();
		const values = {
			workoutExerciseId: String(formData.get('workoutExerciseId') ?? ''),
			setNumber: String(formData.get('setNumber') ?? ''),
			reps: String(formData.get('reps') ?? ''),
			weight: String(formData.get('weight') ?? ''),
			weightUnit: String(formData.get('weightUnit') ?? 'kg'),
			restTimeSeconds: String(formData.get('restTimeSeconds') ?? ''),
			completed: String(formData.get('completed') ?? '')
		};
		const result = addSetSchema.safeParse(values);
		const targetId = Number(formData.get('workoutExerciseId')) || null;

		if (!result.success) {
			return fail(400, {
				intent: 'addSet' as const,
				success: false,
				targetId,
				message: 'Check the set details.',
				errors: result.error.flatten().fieldErrors,
				values
			});
		}

		try {
			await workoutService.addSetToWorkoutExercise(locals.user.id, result.data);
		} catch (cause) {
			console.error('Failed to add set:', cause);
			return fail(500, {
				intent: 'addSet' as const,
				success: false,
				targetId,
				message: 'Could not save that set.',
				errors: {},
				values
			});
		}

		return {
			intent: 'addSet' as const,
			targetId,
			success: true,
			message: 'Set added.',
			errors: {},
			values: {
				workoutExerciseId: '',
				setNumber: '',
				reps: '',
				weight: '',
				weightUnit: 'kg',
				restTimeSeconds: '',
				completed: ''
			}
		};
	},

	updateSet: async ({ request, locals }) => {
		if (!locals.user) throw redirect(302, '/auth');
		const formData = await request.formData();
		const values = {
			setId: String(formData.get('setId') ?? ''),
			workoutExerciseId: String(formData.get('workoutExerciseId') ?? ''),
			setNumber: String(formData.get('setNumber') ?? ''),
			reps: String(formData.get('reps') ?? ''),
			weight: String(formData.get('weight') ?? ''),
			weightUnit: String(formData.get('weightUnit') ?? 'kg'),
			restTimeSeconds: String(formData.get('restTimeSeconds') ?? ''),
			completed: String(formData.get('completed') ?? '')
		};
		const result = updateSetSchema.safeParse(values);
		const targetId = Number(formData.get('workoutExerciseId')) || null;
		if (!result.success)
			return fail(400, {
				intent: 'updateSet' as const,
				success: false,
				targetId,
				message: 'Check the set details.',
				errors: result.error.flatten().fieldErrors,
				values
			});

		try {
			await workoutService.updateSet(locals.user.id, result.data);
		} catch (cause) {
			console.error('Failed to update set:', cause);
			return fail(404, {
				intent: 'updateSet' as const,
				success: false,
				targetId,
				message: 'Set not found.',
				errors: {},
				values
			});
		}
		return {
			intent: 'updateSet' as const,
			success: true,
			targetId,
			message: 'Set updated.',
			errors: {},
			values
		};
	},

	deleteSet: async ({ request, locals }) => {
		if (!locals.user) throw redirect(302, '/auth');
		const formData = await request.formData();
		const result = setMutationSchema.safeParse({ setId: formData.get('setId') });
		if (!result.success)
			return fail(400, {
				intent: 'deleteSet' as const,
				success: false,
				message: 'Invalid set.',
				errors: {},
				values: {}
			});
		try {
			await workoutService.deleteSet(locals.user.id, result.data.setId);
		} catch (cause) {
			console.error('Failed to delete set:', cause);
			return fail(404, {
				intent: 'deleteSet' as const,
				success: false,
				message: 'Set not found.',
				errors: {},
				values: {}
			});
		}
		return {
			intent: 'deleteSet' as const,
			success: true,
			message: 'Set deleted.',
			errors: {},
			values: {}
		};
	},

	removeExercise: async ({ request, locals }) => {
		if (!locals.user) throw redirect(302, '/auth');
		const formData = await request.formData();
		const result = workoutExerciseMutationSchema.safeParse({
			workoutExerciseId: formData.get('workoutExerciseId')
		});
		if (!result.success)
			return fail(400, {
				intent: 'removeExercise' as const,
				success: false,
				message: 'Invalid exercise entry.',
				errors: {},
				values: {}
			});
		try {
			await workoutService.removeExerciseFromWorkout(locals.user.id, result.data.workoutExerciseId);
		} catch (cause) {
			console.error('Failed to remove exercise:', cause);
			return fail(404, {
				intent: 'removeExercise' as const,
				success: false,
				message: 'Exercise entry not found.',
				errors: {},
				values: {}
			});
		}
		return {
			intent: 'removeExercise' as const,
			success: true,
			message: 'Exercise removed.',
			errors: {},
			values: {}
		};
	}
};
