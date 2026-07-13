import { afterEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => {
	class WorkoutDomainError extends Error {}
	return { WorkoutDomainError, addSetToWorkoutExercise: vi.fn() };
});

vi.mock('$lib/server/services/workout.service', () => ({
	WorkoutDomainError: mocks.WorkoutDomainError,
	ExerciseNameConflictError: class ExerciseNameConflictError extends Error {},
	workoutService: { addSetToWorkoutExercise: mocks.addSetToWorkoutExercise }
}));

import { actions } from '../../routes/workouts/[workoutId]/+page.server';

function addSetRequest() {
	const formData = new FormData();
	formData.set('workoutExerciseId', '1');
	formData.set('setNumber', '1');
	formData.set('reps', '8');
	formData.set('weight', '');
	formData.set('weightUnit', 'kg');
	formData.set('restTimeSeconds', '');
	formData.set('completed', '');

	return {
		request: new Request('http://localhost/workouts/1', { method: 'POST', body: formData }),
		locals: { user: { id: 'athlete-id' } }
	} as never;
}

describe('workout detail actions', () => {
	afterEach(() => vi.restoreAllMocks());

	it('keeps an expected workout-domain failure separate from operational logging', async () => {
		const operationalLog = vi.spyOn(console, 'error').mockImplementation(() => undefined);
		mocks.addSetToWorkoutExercise.mockRejectedValue(
			new mocks.WorkoutDomainError('Exercise entry not found.')
		);

		const result = await actions.addSet(addSetRequest());

		expect(result).toMatchObject({
			status: 404,
			data: { message: 'Exercise entry not found.' }
		});
		expect(operationalLog).not.toHaveBeenCalled();
	});

	it('logs an unexpected failure and returns a generic server error', async () => {
		const operationalLog = vi.spyOn(console, 'error').mockImplementation(() => undefined);
		mocks.addSetToWorkoutExercise.mockRejectedValue(new Error('Failed to add set.'));

		const result = await actions.addSet(addSetRequest());

		expect(result).toMatchObject({
			status: 500,
			data: { message: 'Could not save that set. Please try again.' }
		});
		expect(JSON.parse(operationalLog.mock.calls[0][0] as string)).toMatchObject({
			event: 'operational_failure',
			operation: 'workout.add_set',
			message: 'Failed to add set.'
		});
	});
});
