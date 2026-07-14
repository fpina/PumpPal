import { databaseTest } from '../../../../tests/harness/integration';
import { describe, expect } from 'vitest';
import { trainingSession } from './training-session';
import { workoutBuilder } from './workout-builder';

async function createPrescription(
	athleteId: string,
	data: { name?: string; date: string; notes?: string }
) {
	const outcome = await workoutBuilder.execute(athleteId, {
		type: 'create_prescription',
		...data
	});
	if (!outcome.ok || outcome.command !== 'create_prescription') {
		throw new Error('Failed to create Workout Prescription for test setup.');
	}
	return { id: outcome.prescriptionId };
}

async function addPrescriptionExercise(
	athleteId: string,
	data: { prescriptionId: number; exerciseId: number; order?: number; notes?: string }
) {
	const outcome = await workoutBuilder.execute(athleteId, {
		type: 'add_prescription_exercise',
		prescriptionId: data.prescriptionId,
		exerciseId: data.exerciseId,
		order: data.order,
		notes: data.notes
	});
	if (!outcome.ok || outcome.command !== 'add_prescription_exercise') {
		throw new Error('Failed to add Prescription Exercise for test setup.');
	}
	return { id: outcome.prescriptionExerciseId };
}

async function addSetTarget(
	athleteId: string,
	data: {
		prescriptionExerciseId: number;
		setNumber: number;
		reps: number;
		weight?: number;
		weightUnit?: 'kg' | 'lb';
		restTimeSeconds?: number;
	}
) {
	const outcome = await workoutBuilder.execute(athleteId, {
		type: 'add_set_target',
		prescriptionExerciseId: data.prescriptionExerciseId,
		setNumber: data.setNumber,
		reps: data.reps,
		weight: data.weight,
		weightUnit: data.weightUnit,
		restTimeSeconds: data.restTimeSeconds
	});
	if (!outcome.ok || outcome.command !== 'add_set_target') {
		throw new Error('Failed to add Set Target for test setup.');
	}
	return { id: outcome.setTargetId };
}

describe('Training Session lifecycle', () => {
	databaseTest(
		'starts a planned Training Session and exposes its available actions',
		async ({ harness }) => {
			const athlete = await harness.athlete();
			const prescription = await createPrescription(athlete.id, {
				name: 'Lifecycle session',
				date: '2026-07-13'
			});

			const planned = await trainingSession.get(athlete.id, prescription.id);
			expect(planned?.capabilities).toEqual({
				canStart: true,
				canResume: false,
				canFinish: false,
				canReopen: false,
				canEditPrescription: true
			});

			expect(await trainingSession.start(athlete.id, prescription.id)).toEqual({
				ok: true,
				transition: 'started'
			});

			const active = await trainingSession.get(athlete.id, prescription.id);
			expect(active?.sessionStatus).toBe('active');
			expect(active?.capabilities).toEqual({
				canStart: false,
				canResume: true,
				canFinish: true,
				canReopen: false,
				canEditPrescription: true
			});
			expect(active?.trainingSegments).toHaveLength(1);
			expect(active?.trainingSegments[0].finishedAt).toBeNull();
		}
	);

	databaseTest(
		'finishes an active Training Session and closes its active segment',
		async ({ harness }) => {
			const athlete = await harness.athlete();
			const prescription = await createPrescription(athlete.id, {
				name: 'Finish session',
				date: '2026-07-13'
			});
			await trainingSession.start(athlete.id, prescription.id);

			expect(await trainingSession.finish(athlete.id, prescription.id)).toEqual({
				ok: true,
				transition: 'finished'
			});

			const finished = await trainingSession.get(athlete.id, prescription.id);
			expect(finished?.sessionStatus).toBe('finished');
			expect(finished?.finishedAt).toBeInstanceOf(Date);
			expect(finished?.capabilities).toEqual({
				canStart: false,
				canResume: false,
				canFinish: false,
				canReopen: true,
				canEditPrescription: false
			});
			expect(finished?.trainingSegments[0].finishedAt).toBeInstanceOf(Date);
			expect(finished?.trainingSegments[0].durationSeconds).not.toBeNull();
			expect(await trainingSession.start(athlete.id, prescription.id)).toEqual({
				ok: false,
				code: 'invalid_transition'
			});
			expect(await trainingSession.finish(athlete.id, prescription.id)).toEqual({
				ok: false,
				code: 'invalid_transition'
			});
		}
	);

	databaseTest(
		'reopens a finished Training Session by appending a segment',
		async ({ harness }) => {
			const athlete = await harness.athlete();
			const prescription = await createPrescription(athlete.id, {
				name: 'Reopen session',
				date: '2026-07-13'
			});
			await trainingSession.start(athlete.id, prescription.id);
			await trainingSession.finish(athlete.id, prescription.id);
			const firstFinish = await trainingSession.get(athlete.id, prescription.id);

			expect(await trainingSession.reopen(athlete.id, prescription.id)).toEqual({
				ok: true,
				transition: 'reopened'
			});

			const reopened = await trainingSession.get(athlete.id, prescription.id);
			expect(reopened?.sessionStatus).toBe('active');
			expect(reopened?.finishedAt).toEqual(firstFinish?.finishedAt);
			expect(reopened?.capabilities.canEditPrescription).toBe(false);
			expect(reopened?.trainingSegments).toHaveLength(2);
			expect(reopened?.trainingSegments[0]).toEqual(firstFinish?.trainingSegments[0]);
			expect(reopened?.trainingSegments[1].finishedAt).toBeNull();
			expect(await trainingSession.reopen(athlete.id, prescription.id)).toEqual({
				ok: false,
				code: 'invalid_transition'
			});
		}
	);

	databaseTest(
		'activates an available Set Target and exposes its next actions',
		async ({ harness }) => {
			const athlete = await harness.athlete();
			const exercise = await harness.catalogExercise();
			const prescription = await createPrescription(athlete.id, {
				name: 'Set activation',
				date: '2026-07-13'
			});
			const entry = await addPrescriptionExercise(athlete.id, {
				prescriptionId: prescription.id,
				exerciseId: exercise.id
			});
			const target = await addSetTarget(athlete.id, {
				prescriptionExerciseId: entry.id,
				setNumber: 1,
				reps: 8
			});
			await trainingSession.start(athlete.id, prescription.id);

			expect(
				await trainingSession.activateSetTarget(athlete.id, prescription.id, target.id)
			).toEqual({
				ok: true,
				transition: 'activated'
			});

			const active = await trainingSession.get(athlete.id, prescription.id);
			expect(active?.workoutExercises[0].sets[0]).toMatchObject({
				status: 'active',
				capabilities: { canActivate: false, canComplete: true, canSkip: true }
			});
		}
	);

	databaseTest(
		'completes an active Set Target without changing its prescription',
		async ({ harness }) => {
			const athlete = await harness.athlete();
			const exercise = await harness.catalogExercise();
			const prescription = await createPrescription(athlete.id, {
				name: 'Set completion',
				date: '2026-07-13'
			});
			const entry = await addPrescriptionExercise(athlete.id, {
				prescriptionId: prescription.id,
				exerciseId: exercise.id
			});
			const target = await addSetTarget(athlete.id, {
				prescriptionExerciseId: entry.id,
				setNumber: 1,
				reps: 8,
				weight: 100,
				weightUnit: 'kg',
				restTimeSeconds: 90
			});
			await trainingSession.start(athlete.id, prescription.id);
			await trainingSession.activateSetTarget(athlete.id, prescription.id, target.id);

			expect(
				await trainingSession.recordSetResult(athlete.id, prescription.id, {
					setTargetId: target.id,
					reps: 9,
					weight: 102.5,
					weightUnit: 'kg'
				})
			).toEqual({ ok: true, transition: 'completed' });

			const completed = await trainingSession.get(athlete.id, prescription.id);
			expect(completed?.workoutExercises[0].sets[0]).toMatchObject({
				status: 'completed',
				reps: 8,
				weight: 100,
				actualReps: 9,
				actualWeight: 102.5,
				capabilities: { canActivate: false, canComplete: false, canSkip: false }
			});
			expect(completed?.restEndsAt).toBeInstanceOf(Date);

			expect(
				await Promise.all([
					trainingSession.dismissRest(athlete.id, prescription.id),
					trainingSession.dismissRest(athlete.id, prescription.id)
				])
			).toEqual([
				{ ok: true, transition: 'rest_dismissed' },
				{ ok: true, transition: 'rest_dismissed' }
			]);
			expect((await trainingSession.get(athlete.id, prescription.id))?.restEndsAt).toBeNull();
		}
	);

	databaseTest('skips and restores an unfinished Set Target', async ({ harness }) => {
		const athlete = await harness.athlete();
		const exercise = await harness.catalogExercise();
		const prescription = await createPrescription(athlete.id, {
			name: 'Skip target',
			date: '2026-07-13'
		});
		const entry = await addPrescriptionExercise(athlete.id, {
			prescriptionId: prescription.id,
			exerciseId: exercise.id
		});
		const target = await addSetTarget(athlete.id, {
			prescriptionExerciseId: entry.id,
			setNumber: 1,
			reps: 8
		});
		await trainingSession.start(athlete.id, prescription.id);

		expect(await trainingSession.skipSetTarget(athlete.id, prescription.id, target.id)).toEqual({
			ok: true,
			transition: 'skipped'
		});
		const skipped = await trainingSession.get(athlete.id, prescription.id);
		expect(skipped?.workoutExercises[0].sets[0]).toMatchObject({
			status: 'skipped',
			capabilities: { canActivate: true, canComplete: false, canSkip: false }
		});

		expect(await trainingSession.activateSetTarget(athlete.id, prescription.id, target.id)).toEqual(
			{
				ok: true,
				transition: 'activated'
			}
		);
	});

	databaseTest(
		'serializes concurrent starts into one start and one resume',
		async ({ harness }) => {
			const athlete = await harness.athlete();
			const prescription = await createPrescription(athlete.id, {
				name: 'Concurrent start',
				date: '2026-07-13'
			});

			const outcomes = await Promise.all([
				trainingSession.start(athlete.id, prescription.id),
				trainingSession.start(athlete.id, prescription.id)
			]);
			expect(
				outcomes
					.filter((outcome) => outcome.ok)
					.map((outcome) => outcome.transition)
					.sort()
			).toEqual(['resumed', 'started']);

			const active = await trainingSession.get(athlete.id, prescription.id);
			expect(active?.trainingSegments).toHaveLength(1);
			expect(active?.trainingSegments[0].finishedAt).toBeNull();
		}
	);

	databaseTest(
		'returns typed outcomes for illegal and unowned lifecycle commands',
		async ({ harness }) => {
			const athlete = await harness.athlete();
			const otherAthlete = await harness.athlete();
			const prescription = await createPrescription(athlete.id, {
				name: 'Rejected transitions',
				date: '2026-07-13'
			});

			expect(await trainingSession.finish(athlete.id, prescription.id)).toEqual({
				ok: false,
				code: 'invalid_transition'
			});
			expect(await trainingSession.reopen(athlete.id, prescription.id)).toEqual({
				ok: false,
				code: 'invalid_transition'
			});
			expect(await trainingSession.start(otherAthlete.id, prescription.id)).toEqual({
				ok: false,
				code: 'not_found'
			});
		}
	);

	databaseTest('enforces the complete Set Target transition matrix', async ({ harness }) => {
		const athlete = await harness.athlete();
		const exercise = await harness.catalogExercise();
		const prescription = await createPrescription(athlete.id, {
			name: 'Set transition matrix',
			date: '2026-07-13'
		});
		const entry = await addPrescriptionExercise(athlete.id, {
			prescriptionId: prescription.id,
			exerciseId: exercise.id
		});
		const target = await addSetTarget(athlete.id, {
			prescriptionExerciseId: entry.id,
			setNumber: 1,
			reps: 8
		});
		const result = { setTargetId: target.id, reps: 8, weight: null, weightUnit: 'kg' as const };
		const invalid = { ok: false, code: 'invalid_transition' };

		expect(await trainingSession.activateSetTarget(athlete.id, prescription.id, target.id)).toEqual(
			invalid
		);
		expect(await trainingSession.recordSetResult(athlete.id, prescription.id, result)).toEqual(
			invalid
		);
		expect(await trainingSession.skipSetTarget(athlete.id, prescription.id, target.id)).toEqual(
			invalid
		);
		expect(await trainingSession.dismissRest(athlete.id, prescription.id)).toEqual(invalid);

		await trainingSession.start(athlete.id, prescription.id);
		expect(await trainingSession.recordSetResult(athlete.id, prescription.id, result)).toEqual(
			invalid
		);
		await trainingSession.activateSetTarget(athlete.id, prescription.id, target.id);
		expect(await trainingSession.activateSetTarget(athlete.id, prescription.id, target.id)).toEqual(
			{
				ok: true,
				transition: 'activated'
			}
		);
		expect(await trainingSession.skipSetTarget(athlete.id, prescription.id, target.id)).toEqual({
			ok: true,
			transition: 'skipped'
		});
		expect(await trainingSession.skipSetTarget(athlete.id, prescription.id, target.id)).toEqual(
			invalid
		);
		expect(await trainingSession.recordSetResult(athlete.id, prescription.id, result)).toEqual(
			invalid
		);

		await trainingSession.activateSetTarget(athlete.id, prescription.id, target.id);
		await trainingSession.recordSetResult(athlete.id, prescription.id, result);
		expect(await trainingSession.activateSetTarget(athlete.id, prescription.id, target.id)).toEqual(
			invalid
		);
		expect(await trainingSession.recordSetResult(athlete.id, prescription.id, result)).toEqual(
			invalid
		);
		expect(await trainingSession.skipSetTarget(athlete.id, prescription.id, target.id)).toEqual(
			invalid
		);
	});

	databaseTest(
		'serializes concurrent finishes into one finish and one rejection',
		async ({ harness }) => {
			const athlete = await harness.athlete();
			const prescription = await createPrescription(athlete.id, {
				name: 'Concurrent finish',
				date: '2026-07-13'
			});
			await trainingSession.start(athlete.id, prescription.id);

			const outcomes = await Promise.all([
				trainingSession.finish(athlete.id, prescription.id),
				trainingSession.finish(athlete.id, prescription.id)
			]);
			expect(outcomes).toEqual(
				expect.arrayContaining([
					{ ok: true, transition: 'finished' },
					{ ok: false, code: 'invalid_transition' }
				])
			);

			const finished = await trainingSession.get(athlete.id, prescription.id);
			expect(finished?.trainingSegments).toHaveLength(1);
			expect(finished?.trainingSegments[0].finishedAt).toBeInstanceOf(Date);
		}
	);

	databaseTest(
		'serializes concurrent reopens into one reopen and one rejection',
		async ({ harness }) => {
			const athlete = await harness.athlete();
			const prescription = await createPrescription(athlete.id, {
				name: 'Concurrent reopen',
				date: '2026-07-13'
			});
			await trainingSession.start(athlete.id, prescription.id);
			await trainingSession.finish(athlete.id, prescription.id);

			const outcomes = await Promise.all([
				trainingSession.reopen(athlete.id, prescription.id),
				trainingSession.reopen(athlete.id, prescription.id)
			]);
			expect(outcomes).toEqual(
				expect.arrayContaining([
					{ ok: true, transition: 'reopened' },
					{ ok: false, code: 'invalid_transition' }
				])
			);
			expect(
				(await trainingSession.get(athlete.id, prescription.id))?.trainingSegments
			).toHaveLength(2);
		}
	);

	databaseTest('serializes competing Set Target activations', async ({ harness }) => {
		const athlete = await harness.athlete();
		const exercise = await harness.catalogExercise();
		const prescription = await createPrescription(athlete.id, {
			name: 'Concurrent Set Targets',
			date: '2026-07-13'
		});
		const entry = await addPrescriptionExercise(athlete.id, {
			prescriptionId: prescription.id,
			exerciseId: exercise.id
		});
		const first = await addSetTarget(athlete.id, {
			prescriptionExerciseId: entry.id,
			setNumber: 1,
			reps: 8
		});
		const second = await addSetTarget(athlete.id, {
			prescriptionExerciseId: entry.id,
			setNumber: 2,
			reps: 8
		});
		await trainingSession.start(athlete.id, prescription.id);

		expect(
			await Promise.all([
				trainingSession.activateSetTarget(athlete.id, prescription.id, first.id),
				trainingSession.activateSetTarget(athlete.id, prescription.id, second.id)
			])
		).toEqual([
			{ ok: true, transition: 'activated' },
			{ ok: true, transition: 'activated' }
		]);
		const session = await trainingSession.get(athlete.id, prescription.id);
		expect(
			session?.workoutExercises[0].sets.filter((target) => target.status === 'active')
		).toHaveLength(1);
	});

	databaseTest('serializes Set Result recording against session finish', async ({ harness }) => {
		const athlete = await harness.athlete();
		const exercise = await harness.catalogExercise();
		const prescription = await createPrescription(athlete.id, {
			name: 'Concurrent result and finish',
			date: '2026-07-13'
		});
		const entry = await addPrescriptionExercise(athlete.id, {
			prescriptionId: prescription.id,
			exerciseId: exercise.id
		});
		const target = await addSetTarget(athlete.id, {
			prescriptionExerciseId: entry.id,
			setNumber: 1,
			reps: 8
		});
		await trainingSession.start(athlete.id, prescription.id);
		await trainingSession.activateSetTarget(athlete.id, prescription.id, target.id);

		const [finish, result] = await Promise.all([
			trainingSession.finish(athlete.id, prescription.id),
			trainingSession.recordSetResult(athlete.id, prescription.id, {
				setTargetId: target.id,
				reps: 9,
				weight: null,
				weightUnit: 'kg'
			})
		]);
		expect(finish).toEqual({ ok: true, transition: 'finished' });
		expect([
			{ ok: true, transition: 'completed' },
			{ ok: false, code: 'invalid_transition' }
		]).toContainEqual(result);
		const finished = await trainingSession.get(athlete.id, prescription.id);
		expect(finished?.sessionStatus).toBe('finished');
		expect(finished?.workoutExercises[0].sets[0].status).not.toBe('active');
	});
});
