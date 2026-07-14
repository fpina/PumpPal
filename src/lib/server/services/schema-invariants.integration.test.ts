import { db } from '$lib/server/db';
import { set, trainingSegment, workoutExercise } from '$lib/server/db/schema';
import { databaseTest } from '../../../../tests/harness/integration';
import { eq } from 'drizzle-orm';
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
	'Prescription Exercises reject duplicate sibling order from direct writes',
	async ({ harness }) => {
		const athlete = await harness.athlete();
		const firstExercise = await harness.catalogExercise('First ordered exercise');
		const duplicateExercise = await harness.catalogExercise('Duplicate ordered exercise');
		const prescriptionId = await createPrescription(athlete.id, 'Ordered constraint workout');
		await addPrescriptionExercise(athlete.id, prescriptionId, firstExercise.id);

		await expect(
			db.transaction(async (tx) => {
				await tx.insert(workoutExercise).values({
					workoutId: prescriptionId,
					exerciseId: duplicateExercise.id,
					order: 1
				});
			})
		).rejects.toMatchObject({
			code: '23505',
			constraint_name: 'workout_exercise_order_unique'
		});
	}
);

databaseTest(
	'Set Targets reject duplicate sibling numbers from direct writes',
	async ({ harness }) => {
		const athlete = await harness.athlete();
		const catalogExercise = await harness.catalogExercise('Uniquely numbered targets');
		const prescriptionId = await createPrescription(athlete.id, 'Set number constraint workout');
		const prescriptionExerciseId = await addPrescriptionExercise(
			athlete.id,
			prescriptionId,
			catalogExercise.id
		);
		await workoutBuilder.execute(athlete.id, {
			type: 'add_set_target',
			prescriptionExerciseId,
			setNumber: 1,
			reps: 8
		});

		await expect(
			db.transaction(async (tx) => {
				await tx
					.insert(set)
					.values({ workoutExerciseId: prescriptionExerciseId, setNumber: 1, reps: 10 });
			})
		).rejects.toMatchObject({
			code: '23505',
			constraint_name: 'set_target_number_unique'
		});
	}
);

databaseTest(
	'Prescription Exercises reject ordering gaps from direct writes',
	async ({ harness }) => {
		const athlete = await harness.athlete();
		const prescriptionId = await createPrescription(athlete.id, 'Exercise gap constraint workout');
		const exerciseIds = await Promise.all(
			['Gap squat', 'Gap press', 'Gap row'].map(
				async (name) => (await harness.catalogExercise(name)).id
			)
		);
		const prescriptionExerciseIds: number[] = [];
		for (const exerciseId of exerciseIds) {
			prescriptionExerciseIds.push(
				await addPrescriptionExercise(athlete.id, prescriptionId, exerciseId)
			);
		}

		await expect(
			db.transaction(async (tx) => {
				await tx
					.update(workoutExercise)
					.set({ order: 4 })
					.where(eq(workoutExercise.id, prescriptionExerciseIds[2]));
			})
		).rejects.toMatchObject({
			code: '23514',
			constraint_name: 'workout_exercise_order_contiguous'
		});
	}
);

databaseTest('Set Targets reject numbering gaps from direct writes', async ({ harness }) => {
	const athlete = await harness.athlete();
	const catalogExercise = await harness.catalogExercise('Target gap exercise');
	const prescriptionId = await createPrescription(athlete.id, 'Set gap constraint workout');
	const prescriptionExerciseId = await addPrescriptionExercise(
		athlete.id,
		prescriptionId,
		catalogExercise.id
	);
	const targetIds: number[] = [];
	for (const reps of [5, 10, 15]) {
		const outcome = await workoutBuilder.execute(athlete.id, {
			type: 'add_set_target',
			prescriptionExerciseId,
			setNumber: targetIds.length + 1,
			reps
		});
		if (!outcome.ok || outcome.command !== 'add_set_target') {
			throw new Error('Failed to add Set Target for test setup.');
		}
		targetIds.push(outcome.setTargetId);
	}

	await expect(
		db.transaction(async (tx) => {
			await tx.update(set).set({ setNumber: 4 }).where(eq(set.id, targetIds[2]));
		})
	).rejects.toMatchObject({
		code: '23514',
		constraint_name: 'set_target_number_contiguous'
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
