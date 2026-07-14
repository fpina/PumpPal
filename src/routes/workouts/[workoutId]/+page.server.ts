import {
	workoutBuilder,
	type WorkoutBuilderCommand,
	type WorkoutBuilderOutcome
} from '$lib/server/services/workout-builder';
import { trainingSession } from '$lib/server/services/training-session';
import { logOperationalFailure } from '$lib/server/operational-log';
import { positiveRouteId, requireAthleteId } from '$lib/server/workout-route';
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

type BuilderRejection = Extract<WorkoutBuilderOutcome, { ok: false }>;

interface BuilderFailureMessages {
	notFound: string;
	invalidTransition: string;
	conflict?: string;
	operational: string;
}

function builderRejectionStatus(outcome: BuilderRejection) {
	return outcome.code === 'not_found' ? 404 : 409;
}

function builderRejectionMessage(outcome: BuilderRejection, messages: BuilderFailureMessages) {
	switch (outcome.code) {
		case 'not_found':
			return messages.notFound;
		case 'invalid_transition':
			return messages.invalidTransition;
		case 'conflict':
			return messages.conflict ?? messages.invalidTransition;
	}
}

async function applyBuilderCommand<T extends Record<string, unknown>>(
	operation: string,
	athleteId: string,
	command: WorkoutBuilderCommand,
	failureData: T,
	messages: BuilderFailureMessages
) {
	try {
		const outcome = await workoutBuilder.execute(athleteId, command);
		if (outcome.ok) return { ok: true, outcome } as const;
		return {
			ok: false,
			response: fail(builderRejectionStatus(outcome), {
				...failureData,
				success: false,
				message: builderRejectionMessage(outcome, messages)
			})
		} as const;
	} catch (cause) {
		logOperationalFailure(operation, cause);
		return {
			ok: false,
			response: fail(500, {
				...failureData,
				success: false,
				message: messages.operational
			})
		} as const;
	}
}

export const load: PageServerLoad = async ({ params, locals }) => {
	const athleteId = requireAthleteId(locals);

	const workoutId = positiveRouteId(params.workoutId);
	if (!workoutId) {
		throw error(404, 'Workout not found.');
	}

	let workout;
	let availableExercises;
	try {
		[workout, availableExercises] = await Promise.all([
			trainingSession.get(athleteId, workoutId),
			workoutBuilder.listAvailableExercises(athleteId)
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
		const athleteId = requireAthleteId(locals);
		const routeWorkoutId = positiveRouteId(params.workoutId);
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

		const applied = await applyBuilderCommand(
			'workout.repeat',
			athleteId,
			{
				type: 'repeat_prescription',
				prescriptionId: result.data.workoutId,
				repeatToken: result.data.repeatToken,
				date: result.data.date
			},
			{
				intent: 'repeatWorkout' as const,
				errors: {},
				values
			},
			{
				notFound: 'Workout not found.',
				invalidTransition: 'This Workout Prescription cannot be repeated.',
				conflict: 'That repeat request has already been used.',
				operational: 'Could not repeat this workout. Please try again.'
			}
		);
		if (!applied.ok) return applied.response;
		const outcome = applied.outcome;
		if (outcome.command !== 'repeat_prescription') {
			throw new Error('Workout Builder returned the wrong command outcome.');
		}
		throw redirect(303, `/workouts/${outcome.prescriptionId}`);
	},
	updateWorkout: async ({ request, locals, params }) => {
		const athleteId = requireAthleteId(locals);
		const routeWorkoutId = positiveRouteId(params.workoutId);
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

		const applied = await applyBuilderCommand(
			'workout.update',
			athleteId,
			{
				type: 'update_prescription',
				prescriptionId: result.data.workoutId,
				name: result.data.name,
				date: result.data.date,
				notes: result.data.notes
			},
			{
				intent: 'updateWorkout' as const,
				errors: {},
				values
			},
			{
				notFound: 'Workout not found.',
				invalidTransition: 'Finished Workout Prescriptions cannot be edited.',
				operational: 'Could not update this workout. Please try again.'
			}
		);
		if (!applied.ok) return applied.response;

		return {
			intent: 'updateWorkout' as const,
			success: true,
			message: 'Workout updated.',
			errors: {},
			values
		};
	},

	deleteWorkout: async ({ request, locals, params }) => {
		const athleteId = requireAthleteId(locals);
		const routeWorkoutId = positiveRouteId(params.workoutId);
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

		const applied = await applyBuilderCommand(
			'workout.delete',
			athleteId,
			{ type: 'delete_prescription', prescriptionId: result.data.workoutId },
			{
				intent: 'deleteWorkout' as const,
				errors: {},
				values: {}
			},
			{
				notFound: 'Workout not found.',
				invalidTransition: 'This Workout Prescription can no longer be deleted.',
				operational: 'Could not delete this workout. Please try again.'
			}
		);
		if (!applied.ok) return applied.response;
		throw redirect(303, '/');
	},
	addExercise: async ({ request, locals, params }) => {
		const athleteId = requireAthleteId(locals);

		const workoutId = positiveRouteId(params.workoutId);
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

		const applied = await applyBuilderCommand(
			'workout.add_exercise',
			athleteId,
			{
				type: 'add_prescription_exercise',
				prescriptionId: workoutId,
				...result.data
			},
			{
				intent: 'addExercise' as const,
				errors: {},
				values
			},
			{
				notFound: 'Exercise not found.',
				invalidTransition: 'Finished Workout Prescriptions cannot be edited.',
				operational: 'Could not add that exercise. Please try again.'
			}
		);
		if (!applied.ok) return applied.response;

		return {
			intent: 'addExercise' as const,
			success: true,
			message: 'Exercise added.',
			errors: {},
			values: { exerciseId: '', order: '', notes: '' }
		};
	},

	createExercise: async ({ request, locals, params }) => {
		const athleteId = requireAthleteId(locals);

		const workoutId = positiveRouteId(params.workoutId);
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

		const applied = await applyBuilderCommand(
			'workout.create_exercise',
			athleteId,
			{
				type: 'create_custom_exercise',
				prescriptionId: workoutId,
				...result.data
			},
			{
				intent: 'createExercise' as const,
				errors: {},
				values
			},
			{
				notFound: 'Workout not found.',
				invalidTransition: 'Finished Workout Prescriptions cannot be edited.',
				conflict: 'A Custom Exercise with that name already exists.',
				operational: 'Could not create that Custom Exercise. Please try again.'
			}
		);
		if (!applied.ok) return applied.response;

		return {
			intent: 'createExercise' as const,
			success: true,
			message: 'Exercise created and added.',
			errors: {},
			values: { name: '', muscleGroup: '', order: '' }
		};
	},

	addSet: async ({ request, locals }) => {
		const athleteId = requireAthleteId(locals);

		const formData = await request.formData();
		const values = {
			workoutExerciseId: String(formData.get('workoutExerciseId') ?? ''),
			setNumber: String(formData.get('setNumber') ?? ''),
			reps: String(formData.get('reps') ?? ''),
			weight: String(formData.get('weight') ?? ''),
			weightUnit: String(formData.get('weightUnit') ?? 'kg'),
			restTimeSeconds: String(formData.get('restTimeSeconds') ?? '')
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

		const applied = await applyBuilderCommand(
			'workout.add_set',
			athleteId,
			{
				type: 'add_set_target',
				prescriptionExerciseId: result.data.workoutExerciseId,
				setNumber: result.data.setNumber,
				reps: result.data.reps,
				weight: result.data.weight,
				weightUnit: result.data.weightUnit,
				restTimeSeconds: result.data.restTimeSeconds
			},
			{
				intent: 'addSet' as const,
				targetId,
				errors: {},
				values
			},
			{
				notFound: 'Prescription Exercise not found.',
				invalidTransition: 'Finished Workout Prescriptions cannot be edited.',
				operational: 'Could not save that set. Please try again.'
			}
		);
		if (!applied.ok) return applied.response;

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
				restTimeSeconds: ''
			}
		};
	},

	updateSet: async ({ request, locals }) => {
		const athleteId = requireAthleteId(locals);
		const formData = await request.formData();
		const values = {
			setId: String(formData.get('setId') ?? ''),
			workoutExerciseId: String(formData.get('workoutExerciseId') ?? ''),
			setNumber: String(formData.get('setNumber') ?? ''),
			reps: String(formData.get('reps') ?? ''),
			weight: String(formData.get('weight') ?? ''),
			weightUnit: String(formData.get('weightUnit') ?? 'kg'),
			restTimeSeconds: String(formData.get('restTimeSeconds') ?? '')
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

		const applied = await applyBuilderCommand(
			'workout.update_set',
			athleteId,
			{
				type: 'update_set_target',
				prescriptionExerciseId: result.data.workoutExerciseId,
				setTargetId: result.data.setId,
				setNumber: result.data.setNumber,
				reps: result.data.reps,
				weight: result.data.weight,
				weightUnit: result.data.weightUnit,
				restTimeSeconds: result.data.restTimeSeconds
			},
			{
				intent: 'updateSet' as const,
				targetId,
				errors: {},
				values
			},
			{
				notFound: 'Set not found.',
				invalidTransition: 'This Set Target can no longer be edited.',
				operational: 'Could not update that set. Please try again.'
			}
		);
		if (!applied.ok) return applied.response;
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
		const athleteId = requireAthleteId(locals);
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
		const applied = await applyBuilderCommand(
			'workout.delete_set',
			athleteId,
			{ type: 'delete_set_target', setTargetId: result.data.setId },
			{
				intent: 'deleteSet' as const,
				errors: {},
				values: {}
			},
			{
				notFound: 'Set not found.',
				invalidTransition: 'This Set Target can no longer be deleted.',
				operational: 'Could not delete that set. Please try again.'
			}
		);
		if (!applied.ok) return applied.response;
		return {
			intent: 'deleteSet' as const,
			success: true,
			message: 'Set deleted.',
			errors: {},
			values: {}
		};
	},

	removeExercise: async ({ request, locals }) => {
		const athleteId = requireAthleteId(locals);
		const formData = await request.formData();
		const result = workoutExerciseMutationSchema.safeParse({
			workoutExerciseId: formData.get('workoutExerciseId')
		});
		if (!result.success)
			return fail(400, {
				intent: 'removeExercise' as const,
				success: false,
				message: 'Invalid Prescription Exercise.',
				errors: {},
				values: {}
			});
		const applied = await applyBuilderCommand(
			'workout.remove_exercise',
			athleteId,
			{
				type: 'remove_prescription_exercise',
				prescriptionExerciseId: result.data.workoutExerciseId
			},
			{
				intent: 'removeExercise' as const,
				errors: {},
				values: {}
			},
			{
				notFound: 'Prescription Exercise not found.',
				invalidTransition: 'This Prescription Exercise can no longer be removed.',
				operational: 'Could not remove that exercise. Please try again.'
			}
		);
		if (!applied.ok) return applied.response;
		return {
			intent: 'removeExercise' as const,
			success: true,
			message: 'Exercise removed.',
			errors: {},
			values: {}
		};
	}
};
