import { db } from '$lib/server/db';
import { set, trainingSegment } from '$lib/server/db/schema';
import { databaseTest } from '../../../../tests/harness/integration';
import { expect } from 'vitest';
import { workoutService } from './workout.service';
import { trainingSession } from './training-session';

databaseTest(
	'a default Set Target satisfies the planned persistence invariants',
	async ({ harness }) => {
		const athlete = await harness.athlete();
		const catalogExercise = await harness.catalogExercise();
		const workout = await workoutService.createWorkout(athlete.id, {
			name: 'Persistence invariant workout',
			date: '2026-07-13'
		});
		const workoutEntry = await workoutService.addExerciseToWorkout(athlete.id, {
			workoutId: workout.id,
			exerciseId: catalogExercise.id
		});

		const [createdSet] = await db
			.insert(set)
			.values({ workoutExerciseId: workoutEntry.id, setNumber: 1, reps: 8 })
			.returning();

		expect(createdSet).toMatchObject({
			status: 'planned',
			completed: false,
			actualReps: null,
			actualWeight: null,
			actualWeightUnit: null
		});
	}
);

databaseTest('Set Targets reject invalid persisted values', async ({ harness }) => {
	const athlete = await harness.athlete();
	const catalogExercise = await harness.catalogExercise();
	const workout = await workoutService.createWorkout(athlete.id, {
		name: 'Constraint workout',
		date: '2026-07-13'
	});
	const workoutEntry = await workoutService.addExerciseToWorkout(athlete.id, {
		workoutId: workout.id,
		exerciseId: catalogExercise.id
	});

	await expect(
		db
			.insert(set)
			.values({
				workoutExerciseId: workoutEntry.id,
				setNumber: 1,
				reps: -1,
				completed: false
			})
			.returning()
	).rejects.toMatchObject({
		cause: { code: '23514', constraint_name: 'set_reps_nonnegative_check' }
	});
});

databaseTest(
	'a Training Session cannot persist two open Training Segments',
	async ({ harness }) => {
		const athlete = await harness.athlete();
		const workout = await workoutService.createWorkout(athlete.id, {
			name: 'Segment invariant workout',
			date: '2026-07-13'
		});
		await trainingSession.start(athlete.id, workout.id);

		await expect(
			db.insert(trainingSegment).values({ workoutId: workout.id, startedAt: new Date() })
		).rejects.toMatchObject({
			cause: { code: '23505', constraint_name: 'training_segment_one_open_per_workout_unique' }
		});
	}
);
