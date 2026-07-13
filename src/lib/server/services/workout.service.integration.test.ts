import { randomUUID } from 'node:crypto';
import { databaseTest } from '../../../../tests/harness/integration';
import { describe, expect } from 'vitest';
import { workoutService } from './workout.service';

describe('WorkoutService training records', () => {
	databaseTest(
		'preserves its prescription, first finish, and results across repeat and reopen',
		async ({ harness }) => {
			const suffix = randomUUID();
			const athlete = await harness.athlete({ name: 'Integration Athlete' });
			const createdExercise = await harness.catalogExercise(`Integration press ${suffix}`);

			const createdWorkout = await workoutService.createWorkout(athlete.id, {
				name: 'Prescription preservation',
				date: '2026-07-13'
			});
			const workoutEntry = await workoutService.addExerciseToWorkout(athlete.id, {
				workoutId: createdWorkout.id,
				exerciseId: createdExercise.id
			});
			const targetSet = await workoutService.addSetToWorkoutExercise(athlete.id, {
				workoutExerciseId: workoutEntry.id,
				setNumber: 1,
				reps: 8,
				weight: 100,
				weightUnit: 'kg'
			});
			expect(targetSet).toMatchObject({ completed: false, status: 'planned' });

			await workoutService.startWorkout(athlete.id, createdWorkout.id);
			await workoutService.activateSet(athlete.id, createdWorkout.id, targetSet.id);
			await workoutService.completeLiveSet(athlete.id, createdWorkout.id, {
				setId: targetSet.id,
				reps: 9,
				weight: 102.5,
				weightUnit: 'kg'
			});
			await workoutService.finishWorkout(athlete.id, createdWorkout.id);

			const firstFinish = await workoutService.getWorkoutById(athlete.id, createdWorkout.id);
			expect(firstFinish?.workoutExercises[0].sets[0]).toMatchObject({
				reps: 8,
				weight: 100,
				actualReps: 9,
				actualWeight: 102.5
			});
			expect(firstFinish?.trainingSegments).toHaveLength(1);
			const originalFinishedAt = firstFinish?.finishedAt;
			const originalSegment = firstFinish?.trainingSegments[0];

			const repeated = await workoutService.repeatWorkout(athlete.id, {
				workoutId: createdWorkout.id,
				repeatToken: randomUUID(),
				date: '2026-07-14'
			});
			const repeatedWorkout = await workoutService.getWorkoutById(athlete.id, repeated.id);
			expect(repeatedWorkout?.workoutExercises[0].sets[0]).toMatchObject({
				reps: 8,
				weight: 100,
				actualReps: null,
				actualWeight: null
			});

			await workoutService.reopenWorkout(athlete.id, createdWorkout.id);
			await expect(
				workoutService.activateSet(athlete.id, createdWorkout.id, targetSet.id)
			).rejects.toThrow('Set is not available.');
			await expect(
				workoutService.updateSet(athlete.id, {
					workoutExerciseId: workoutEntry.id,
					setId: targetSet.id,
					setNumber: 1,
					reps: 12,
					weight: 120,
					weightUnit: 'kg',
					completed: true
				})
			).rejects.toThrow('Set not found.');
			await expect(workoutService.deleteSet(athlete.id, targetSet.id)).rejects.toThrow(
				'Set not found.'
			);
			await workoutService.finishWorkout(athlete.id, createdWorkout.id);

			const resumed = await workoutService.getWorkoutById(athlete.id, createdWorkout.id);
			expect(resumed?.finishedAt).toEqual(originalFinishedAt);
			expect(resumed?.trainingSegments).toHaveLength(2);
			expect(resumed?.trainingSegments[0]).toEqual(originalSegment);
			expect(resumed?.workoutExercises[0].sets[0]).toMatchObject({
				reps: 8,
				actualReps: 9
			});
		}
	);

	databaseTest(
		'commits one ordered Workout Prescription for concurrent repeat requests',
		async ({ harness }) => {
			const athlete = await harness.athlete();
			const firstExercise = await harness.catalogExercise('Harness deadlift');
			const secondExercise = await harness.catalogExercise('Harness row');
			const source = await workoutService.createWorkout(athlete.id, {
				name: 'Ordered pull day',
				date: '2026-07-13'
			});
			const secondEntry = await workoutService.addExerciseToWorkout(athlete.id, {
				workoutId: source.id,
				exerciseId: secondExercise.id,
				order: 2
			});
			const firstEntry = await workoutService.addExerciseToWorkout(athlete.id, {
				workoutId: source.id,
				exerciseId: firstExercise.id,
				order: 1
			});
			await workoutService.addSetToWorkoutExercise(athlete.id, {
				workoutExerciseId: firstEntry.id,
				setNumber: 2,
				reps: 5,
				completed: false
			});
			await workoutService.addSetToWorkoutExercise(athlete.id, {
				workoutExerciseId: firstEntry.id,
				setNumber: 1,
				reps: 8,
				completed: false
			});
			await workoutService.addSetToWorkoutExercise(athlete.id, {
				workoutExerciseId: secondEntry.id,
				setNumber: 1,
				reps: 10,
				completed: false
			});

			const repeatToken = randomUUID();
			const repeat = () =>
				workoutService.repeatWorkout(athlete.id, {
					workoutId: source.id,
					repeatToken,
					date: '2026-07-14'
				});
			const [firstRepeat, duplicateRepeat] = await Promise.all([repeat(), repeat()]);

			expect(duplicateRepeat.id).toBe(firstRepeat.id);
			const repeated = await workoutService.getWorkoutById(athlete.id, firstRepeat.id);
			expect(repeated?.workoutExercises.map(({ exercise }) => exercise.name)).toEqual([
				'Harness deadlift',
				'Harness row'
			]);
			expect(repeated?.workoutExercises[0].sets.map(({ reps }) => reps)).toEqual([8, 5]);
			expect(repeated?.workoutExercises[1].sets.map(({ reps }) => reps)).toEqual([10]);
		}
	);
});
