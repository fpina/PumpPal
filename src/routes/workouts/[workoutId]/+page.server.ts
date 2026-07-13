import {
	ExerciseNameConflictError,
	WorkoutDomainError,
	workoutService
} from '$lib/server/services/workout.service';
import { logOperationalFailure } from '$lib/server/operational-log';
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

	let workout;
	let availableExercises;
	try {
		[workout, availableExercises] = await Promise.all([
			workoutService.getWorkoutById(locals.user.id, workoutId),
			workoutService.getExercises(locals.user.id)
		]);
	} catch (cause) {
		logOperationalFailure('workout.load', cause);
		throw error(500, 'Could not load this workout.');
	}

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
			repeatToken: String(formData.get('repeatToken') ?? ''),
			date: String(formData.get('date') ?? '')
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
			if (cause instanceof WorkoutDomainError) {
				return fail(404, {
					intent: 'repeatWorkout' as const,
					success: false,
					message: 'Workout not found.',
					errors: {},
					values
				});
			}
			logOperationalFailure('workout.repeat', cause);
			return fail(500, {
				intent: 'repeatWorkout' as const,
				success: false,
				message: 'Could not repeat this workout. Please try again.',
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
			if (cause instanceof WorkoutDomainError) {
				return fail(404, {
					intent: 'updateWorkout' as const,
					success: false,
					message: 'Workout not found.',
					errors: {},
					values
				});
			}
			logOperationalFailure('workout.update', cause);
			return fail(500, {
				intent: 'updateWorkout' as const,
				success: false,
				message: 'Could not update this workout. Please try again.',
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
			if (cause instanceof WorkoutDomainError) {
				return fail(404, {
					intent: 'deleteWorkout' as const,
					success: false,
					message: 'Workout not found.',
					errors: {},
					values: {}
				});
			}
			logOperationalFailure('workout.delete', cause);
			return fail(500, {
				intent: 'deleteWorkout' as const,
				success: false,
				message: 'Could not delete this workout. Please try again.',
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
			if (cause instanceof WorkoutDomainError) {
				return fail(404, {
					intent: 'addExercise' as const,
					success: false,
					message: 'Exercise not found.',
					errors: {},
					values
				});
			}
			logOperationalFailure('workout.add_exercise', cause);
			return fail(500, {
				intent: 'addExercise' as const,
				success: false,
				message: 'Could not add that exercise. Please try again.',
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
			const conflict = cause instanceof ExerciseNameConflictError;
			if (conflict || cause instanceof WorkoutDomainError) {
				return fail(conflict ? 409 : 404, {
					intent: 'createExercise' as const,
					success: false,
					message: conflict ? cause.message : 'Workout not found.',
					errors: {},
					values
				});
			}
			logOperationalFailure('workout.create_exercise', cause);
			return fail(500, {
				intent: 'createExercise' as const,
				success: false,
				message: 'Could not create that Custom Exercise. Please try again.',
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
			if (cause instanceof WorkoutDomainError) {
				return fail(404, {
					intent: 'addSet' as const,
					success: false,
					targetId,
					message: 'Exercise entry not found.',
					errors: {},
					values
				});
			}
			logOperationalFailure('workout.add_set', cause);
			return fail(500, {
				intent: 'addSet' as const,
				success: false,
				targetId,
				message: 'Could not save that set. Please try again.',
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
			if (cause instanceof WorkoutDomainError) {
				return fail(404, {
					intent: 'updateSet' as const,
					success: false,
					targetId,
					message: 'Set not found.',
					errors: {},
					values
				});
			}
			logOperationalFailure('workout.update_set', cause);
			return fail(500, {
				intent: 'updateSet' as const,
				success: false,
				targetId,
				message: 'Could not update that set. Please try again.',
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
			if (cause instanceof WorkoutDomainError) {
				return fail(404, {
					intent: 'deleteSet' as const,
					success: false,
					message: 'Set not found.',
					errors: {},
					values: {}
				});
			}
			logOperationalFailure('workout.delete_set', cause);
			return fail(500, {
				intent: 'deleteSet' as const,
				success: false,
				message: 'Could not delete that set. Please try again.',
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
			if (cause instanceof WorkoutDomainError) {
				return fail(404, {
					intent: 'removeExercise' as const,
					success: false,
					message: 'Exercise entry not found.',
					errors: {},
					values: {}
				});
			}
			logOperationalFailure('workout.remove_exercise', cause);
			return fail(500, {
				intent: 'removeExercise' as const,
				success: false,
				message: 'Could not remove that exercise. Please try again.',
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
