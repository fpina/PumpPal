import { db } from '$lib/server/db';
import { set, trainingSegment } from '$lib/server/db/schema';
import { databaseTest } from '../../../../tests/harness/integration';
import { expect } from 'vitest';
import { trainingSession } from './training-session';
import { workoutBuilder } from './workout-builder';

async function createPrescription(athleteId: string, name: string) {
	const outcome = await workoutBuilder.execute(athleteId, {
		type: 'create_prescription',
		name,
		date: '2026-07-13'
	});
	if (!outcome.ok || outcome.command !== 'create_prescription') {
		throw new Error('Failed to create Workout Prescription for test setup.');
	}
	return outcome.prescriptionId;
}

async function addPrescriptionExercise(
	athleteId: string,
	prescriptionId: number,
	exerciseId: number
) {
	const outcome = await workoutBuilder.execute(athleteId, {
		type: 'add_prescription_exercise',
		prescriptionId,
		exerciseId
	});
	if (!outcome.ok || outcome.command !== 'add_prescription_exercise') {
		throw new Error('Failed to add Prescription Exercise for test setup.');
	}
	return outcome.prescriptionExerciseId;
}

databaseTest(
	'a default Set Target satisfies the planned persistence invariants',
	async ({ harness }) => {
		const athlete = await harness.athlete();
		const catalogExercise = await harness.catalogExercise();
		const prescriptionId = await createPrescription(athlete.id, 'Persistence invariant workout');
		const prescriptionExerciseId = await addPrescriptionExercise(
			athlete.id,
			prescriptionId,
			catalogExercise.id
		);

		const [createdSet] = await db
			.insert(set)
			.values({ workoutExerciseId: prescriptionExerciseId, setNumber: 1, reps: 8 })
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
	const prescriptionId = await createPrescription(athlete.id, 'Constraint workout');
	const prescriptionExerciseId = await addPrescriptionExercise(
		athlete.id,
		prescriptionId,
		catalogExercise.id
	);

	await expect(
		db
			.insert(set)
			.values({
				workoutExerciseId: prescriptionExerciseId,
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
		const prescriptionId = await createPrescription(athlete.id, 'Segment invariant workout');
		await trainingSession.start(athlete.id, prescriptionId);

		await expect(
			db.insert(trainingSegment).values({ workoutId: prescriptionId, startedAt: new Date() })
		).rejects.toMatchObject({
			cause: { code: '23505', constraint_name: 'training_segment_one_open_per_workout_unique' }
		});
	}
);
