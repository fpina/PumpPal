import { randomUUID } from 'node:crypto';
import { db } from '$lib/server/db';
import { exercise, user } from '$lib/server/db/schema';
import { eq, inArray } from 'drizzle-orm';
import { describe, expect, it } from 'vitest';
import { ExerciseNameConflictError, workoutService } from './workout.service';

describe('Exercise Catalog ownership', () => {
	it('shares Catalog Exercises while isolating normalized Custom Exercise names by Athlete', async () => {
		const suffix = randomUUID();
		const ownerId = `catalog-owner-${suffix}`;
		const otherId = `catalog-other-${suffix}`;
		let catalogExerciseId: number | undefined;

		try {
			const now = new Date();
			await db.insert(user).values([
				{
					id: ownerId,
					name: 'Catalog Owner',
					email: `${ownerId}@example.com`,
					emailVerified: true,
					createdAt: now,
					updatedAt: now
				},
				{
					id: otherId,
					name: 'Other Athlete',
					email: `${otherId}@example.com`,
					emailVerified: true,
					createdAt: now,
					updatedAt: now
				}
			]);

			const catalogName = `Catalog squat ${suffix}`;
			const [catalogExercise] = await db
				.insert(exercise)
				.values({ name: catalogName, normalizedName: catalogName.toLowerCase() })
				.returning({ id: exercise.id });
			catalogExerciseId = catalogExercise.id;

			const ownerWorkout = await workoutService.createWorkout(ownerId, {
				name: 'Owner prescription',
				date: '2026-07-13'
			});
			const otherWorkout = await workoutService.createWorkout(otherId, {
				name: 'Other prescription',
				date: '2026-07-13'
			});
			const customName = `Private press ${suffix}`;
			await workoutService.createExerciseForWorkout(ownerId, {
				workoutId: ownerWorkout.id,
				name: customName
			});

			const ownerCatalog = await workoutService.getExercises(ownerId);
			const otherCatalog = await workoutService.getExercises(otherId);
			expect(ownerCatalog.map(({ name }) => name)).toEqual(
				expect.arrayContaining([catalogName, customName])
			);
			expect(otherCatalog.map(({ name }) => name)).toContain(catalogName);
			expect(otherCatalog.map(({ name }) => name)).not.toContain(customName);

			const ownerCustomExercise = ownerCatalog.find(({ name }) => name === customName);
			expect(ownerCustomExercise).toBeDefined();
			await expect(
				workoutService.addExerciseToWorkout(otherId, {
					workoutId: otherWorkout.id,
					exerciseId: ownerCustomExercise!.id
				})
			).rejects.toThrow('Exercise not found.');

			await workoutService.createExerciseForWorkout(otherId, {
				workoutId: otherWorkout.id,
				name: customName
			});
			await expect(
				workoutService.createExerciseForWorkout(otherId, {
					workoutId: otherWorkout.id,
					name: `  ${customName.toUpperCase().replaceAll(' ', '   ')}  `
				})
			).rejects.toBeInstanceOf(ExerciseNameConflictError);
		} finally {
			await db.delete(user).where(inArray(user.id, [ownerId, otherId]));
			if (catalogExerciseId) {
				await db.delete(exercise).where(eq(exercise.id, catalogExerciseId));
			}
		}
	});
});
