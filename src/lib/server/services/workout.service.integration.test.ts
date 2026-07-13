import { randomUUID } from 'node:crypto';
import { db } from '$lib/server/db';
import { exercise, user } from '$lib/server/db/schema';
import { eq } from 'drizzle-orm';
import { describe, expect, it } from 'vitest';
import { workoutService } from './workout.service';

describe('WorkoutService training records', () => {
	it('preserves its prescription, first finish, and results across repeat and reopen', async () => {
		const suffix = randomUUID();
		const userId = `integration-${suffix}`;
		let exerciseId: number | undefined;

		try {
			await db.insert(user).values({
				id: userId,
				name: 'Integration Athlete',
				email: `${userId}@example.com`,
				emailVerified: true,
				createdAt: new Date(),
				updatedAt: new Date()
			});
			const [createdExercise] = await db
				.insert(exercise)
				.values({
					name: `Integration press ${suffix}`,
					normalizedName: `integration press ${suffix}`
				})
				.returning({ id: exercise.id });
			exerciseId = createdExercise.id;

			const createdWorkout = await workoutService.createWorkout(userId, {
				name: 'Prescription preservation',
				date: '2026-07-13'
			});
			const workoutEntry = await workoutService.addExerciseToWorkout(userId, {
				workoutId: createdWorkout.id,
				exerciseId
			});
			const targetSet = await workoutService.addSetToWorkoutExercise(userId, {
				workoutExerciseId: workoutEntry.id,
				setNumber: 1,
				reps: 8,
				weight: 100,
				weightUnit: 'kg',
				completed: false
			});

			await workoutService.startWorkout(userId, createdWorkout.id);
			await workoutService.activateSet(userId, createdWorkout.id, targetSet.id);
			await workoutService.completeLiveSet(userId, createdWorkout.id, {
				setId: targetSet.id,
				reps: 9,
				weight: 102.5,
				weightUnit: 'kg'
			});
			await workoutService.finishWorkout(userId, createdWorkout.id);

			const firstFinish = await workoutService.getWorkoutById(userId, createdWorkout.id);
			expect(firstFinish?.workoutExercises[0].sets[0]).toMatchObject({
				reps: 8,
				weight: 100,
				actualReps: 9,
				actualWeight: 102.5
			});
			expect(firstFinish?.trainingSegments).toHaveLength(1);
			const originalFinishedAt = firstFinish?.finishedAt;
			const originalSegment = firstFinish?.trainingSegments[0];

			const repeated = await workoutService.repeatWorkout(userId, {
				workoutId: createdWorkout.id,
				repeatToken: randomUUID(),
				date: '2026-07-14'
			});
			const repeatedWorkout = await workoutService.getWorkoutById(userId, repeated.id);
			expect(repeatedWorkout?.workoutExercises[0].sets[0]).toMatchObject({
				reps: 8,
				weight: 100,
				actualReps: null,
				actualWeight: null
			});

			await workoutService.reopenWorkout(userId, createdWorkout.id);
			await expect(
				workoutService.activateSet(userId, createdWorkout.id, targetSet.id)
			).rejects.toThrow('Set is not available.');
			await expect(
				workoutService.updateSet(userId, {
					workoutExerciseId: workoutEntry.id,
					setId: targetSet.id,
					setNumber: 1,
					reps: 12,
					weight: 120,
					weightUnit: 'kg',
					completed: true
				})
			).rejects.toThrow('Set not found.');
			await expect(workoutService.deleteSet(userId, targetSet.id)).rejects.toThrow(
				'Set not found.'
			);
			await workoutService.finishWorkout(userId, createdWorkout.id);

			const resumed = await workoutService.getWorkoutById(userId, createdWorkout.id);
			expect(resumed?.finishedAt).toEqual(originalFinishedAt);
			expect(resumed?.trainingSegments).toHaveLength(2);
			expect(resumed?.trainingSegments[0]).toEqual(originalSegment);
			expect(resumed?.workoutExercises[0].sets[0]).toMatchObject({
				reps: 8,
				actualReps: 9
			});
		} finally {
			await db.delete(user).where(eq(user.id, userId));
			if (exerciseId) await db.delete(exercise).where(eq(exercise.id, exerciseId));
		}
	});
});
