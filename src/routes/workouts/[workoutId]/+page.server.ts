import { workoutService } from '$lib/server/services/workout.service';
import {
	addExerciseSchema,
	addSetSchema,
	createExerciseSchema
} from '$lib/types/workout.validation';
import { error, fail, redirect } from '@sveltejs/kit';
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

	return { workout, availableExercises };
};

export const actions: Actions = {
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
	}
};
