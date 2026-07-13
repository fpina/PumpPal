import { randomUUID } from 'node:crypto';
import { databaseTest } from '../../../../tests/harness/integration';
import { describe, expect } from 'vitest';
import { ExerciseNameConflictError, workoutService } from './workout.service';

describe('Exercise Catalog ownership', () => {
	databaseTest(
		'shares Catalog Exercises while isolating normalized Custom Exercise names by Athlete',
		async ({ harness }) => {
			const suffix = randomUUID();
			const owner = await harness.athlete({ name: 'Catalog Owner' });
			const other = await harness.athlete({ name: 'Other Athlete' });
			const catalogName = `Catalog squat ${suffix}`;
			await harness.catalogExercise(catalogName);

			const ownerWorkout = await workoutService.createWorkout(owner.id, {
				name: 'Owner prescription',
				date: '2026-07-13'
			});
			const otherWorkout = await workoutService.createWorkout(other.id, {
				name: 'Other prescription',
				date: '2026-07-13'
			});
			const customName = `Private press ${suffix}`;
			await workoutService.createExerciseForWorkout(owner.id, {
				workoutId: ownerWorkout.id,
				name: customName
			});

			const ownerCatalog = await workoutService.getExercises(owner.id);
			const otherCatalog = await workoutService.getExercises(other.id);
			expect(ownerCatalog.map(({ name }) => name)).toEqual(
				expect.arrayContaining([catalogName, customName])
			);
			expect(otherCatalog.map(({ name }) => name)).toContain(catalogName);
			expect(otherCatalog.map(({ name }) => name)).not.toContain(customName);

			const ownerCustomExercise = ownerCatalog.find(({ name }) => name === customName);
			expect(ownerCustomExercise).toBeDefined();
			await expect(
				workoutService.addExerciseToWorkout(other.id, {
					workoutId: otherWorkout.id,
					exerciseId: ownerCustomExercise!.id
				})
			).rejects.toThrow('Exercise not found.');

			await workoutService.createExerciseForWorkout(other.id, {
				workoutId: otherWorkout.id,
				name: customName
			});
			await expect(
				workoutService.createExerciseForWorkout(other.id, {
					workoutId: otherWorkout.id,
					name: `  ${customName.toUpperCase().replaceAll(' ', '   ')}  `
				})
			).rejects.toBeInstanceOf(ExerciseNameConflictError);
		}
	);
});
