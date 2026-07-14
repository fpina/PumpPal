import { randomUUID } from 'node:crypto';
import { databaseTest } from '../../../../tests/harness/integration';
import { describe, expect } from 'vitest';
import { trainingSession } from './training-session';
import { workoutBuilder } from './workout-builder';

describe('Workout Builder', () => {
	databaseTest(
		'creates a Workout Prescription through its command interface',
		async ({ harness }) => {
			const athlete = await harness.athlete();

			const outcome = await workoutBuilder.execute(athlete.id, {
				type: 'create_prescription',
				name: 'Strength day',
				date: '2026-07-14',
				notes: 'Controlled tempo'
			});

			expect(outcome).toEqual({
				ok: true,
				command: 'create_prescription',
				prescriptionId: expect.any(Number)
			});
			expect(await workoutBuilder.listPrescriptions(athlete.id)).toMatchObject([
				{ name: 'Strength day', date: '2026-07-14', notes: 'Controlled tempo' }
			]);
		}
	);

	databaseTest(
		'distinguishes missing and locked Workout Prescriptions when updating',
		async ({ harness }) => {
			const athlete = await harness.athlete();
			const otherAthlete = await harness.athlete();
			const created = await workoutBuilder.execute(athlete.id, {
				type: 'create_prescription',
				name: 'Original',
				date: '2026-07-14'
			});
			if (!created.ok || created.command !== 'create_prescription') {
				throw new Error('Unexpected command outcome.');
			}

			expect(
				await workoutBuilder.execute(athlete.id, {
					type: 'update_prescription',
					prescriptionId: created.prescriptionId,
					name: 'Updated',
					date: '2026-07-15',
					notes: 'New notes'
				})
			).toEqual({ ok: true, command: 'update_prescription' });
			expect(await workoutBuilder.listPrescriptions(athlete.id)).toMatchObject([
				{ name: 'Updated', date: '2026-07-15', notes: 'New notes' }
			]);

			expect(
				await workoutBuilder.execute(otherAthlete.id, {
					type: 'update_prescription',
					prescriptionId: created.prescriptionId,
					name: 'Unowned',
					date: '2026-07-15'
				})
			).toEqual({ ok: false, code: 'not_found' });

			await trainingSession.start(athlete.id, created.prescriptionId);
			await trainingSession.finish(athlete.id, created.prescriptionId);
			expect(
				await workoutBuilder.execute(athlete.id, {
					type: 'update_prescription',
					prescriptionId: created.prescriptionId,
					name: 'Too late',
					date: '2026-07-16'
				})
			).toEqual({ ok: false, code: 'invalid_transition' });
		}
	);

	databaseTest(
		'adds visible Catalog Exercises and isolates Custom Exercise conflicts by Athlete',
		async ({ harness }) => {
			const athlete = await harness.athlete();
			const otherAthlete = await harness.athlete();
			const catalogExercise = await harness.catalogExercise('Builder squat');
			const created = await workoutBuilder.execute(athlete.id, {
				type: 'create_prescription',
				name: 'Catalog day',
				date: '2026-07-14'
			});
			const otherCreated = await workoutBuilder.execute(otherAthlete.id, {
				type: 'create_prescription',
				name: 'Other catalog day',
				date: '2026-07-14'
			});
			if (!created.ok || created.command !== 'create_prescription') {
				throw new Error('Unexpected command outcome.');
			}
			if (!otherCreated.ok || otherCreated.command !== 'create_prescription') {
				throw new Error('Unexpected command outcome.');
			}

			expect(
				await workoutBuilder.execute(athlete.id, {
					type: 'add_prescription_exercise',
					prescriptionId: created.prescriptionId,
					exerciseId: catalogExercise.id,
					order: 1,
					notes: 'Pause at depth'
				})
			).toEqual({
				ok: true,
				command: 'add_prescription_exercise',
				prescriptionExerciseId: expect.any(Number)
			});

			const custom = await workoutBuilder.execute(athlete.id, {
				type: 'create_custom_exercise',
				prescriptionId: created.prescriptionId,
				name: '  Private   Press  ',
				muscleGroup: 'Chest',
				order: 2
			});
			expect(custom).toEqual({
				ok: true,
				command: 'create_custom_exercise',
				exerciseId: expect.any(Number),
				prescriptionExerciseId: expect.any(Number)
			});
			const athleteCatalog = await workoutBuilder.listAvailableExercises(athlete.id);
			const otherCatalog = await workoutBuilder.listAvailableExercises(otherAthlete.id);
			expect(athleteCatalog.map(({ name }) => name)).toContain('Private Press');
			expect(otherCatalog.map(({ name }) => name)).not.toContain('Private Press');

			expect(
				await workoutBuilder.execute(athlete.id, {
					type: 'create_custom_exercise',
					prescriptionId: created.prescriptionId,
					name: 'private press'
				})
			).toEqual({ ok: false, code: 'conflict', reason: 'custom_exercise_name' });
			if (!custom.ok || custom.command !== 'create_custom_exercise') {
				throw new Error('Unexpected command outcome.');
			}
			expect(
				await workoutBuilder.execute(otherAthlete.id, {
					type: 'add_prescription_exercise',
					prescriptionId: otherCreated.prescriptionId,
					exerciseId: custom.exerciseId
				})
			).toEqual({ ok: false, code: 'not_found' });
		}
	);

	databaseTest('owns Set Target creation, editing, and deletion', async ({ harness }) => {
		const athlete = await harness.athlete();
		const catalogExercise = await harness.catalogExercise('Builder row');
		const created = await workoutBuilder.execute(athlete.id, {
			type: 'create_prescription',
			name: 'Set Target day',
			date: '2026-07-14'
		});
		if (!created.ok || created.command !== 'create_prescription') {
			throw new Error('Unexpected command outcome.');
		}
		const addedExercise = await workoutBuilder.execute(athlete.id, {
			type: 'add_prescription_exercise',
			prescriptionId: created.prescriptionId,
			exerciseId: catalogExercise.id,
			order: 1
		});
		if (!addedExercise.ok || addedExercise.command !== 'add_prescription_exercise') {
			throw new Error('Unexpected command outcome.');
		}

		const addedTarget = await workoutBuilder.execute(athlete.id, {
			type: 'add_set_target',
			prescriptionExerciseId: addedExercise.prescriptionExerciseId,
			setNumber: 1,
			reps: 8,
			weight: 80,
			weightUnit: 'kg',
			restTimeSeconds: 90
		});
		expect(addedTarget).toEqual({
			ok: true,
			command: 'add_set_target',
			setTargetId: expect.any(Number)
		});
		if (!addedTarget.ok || addedTarget.command !== 'add_set_target') {
			throw new Error('Unexpected command outcome.');
		}

		expect(
			await workoutBuilder.execute(athlete.id, {
				type: 'update_set_target',
				prescriptionExerciseId: addedExercise.prescriptionExerciseId,
				setTargetId: addedTarget.setTargetId,
				setNumber: 1,
				reps: 10,
				weight: 82.5,
				weightUnit: 'kg',
				restTimeSeconds: 120
			})
		).toEqual({ ok: true, command: 'update_set_target' });
		const updated = await trainingSession.get(athlete.id, created.prescriptionId);
		expect(updated?.workoutExercises[0].sets[0]).toMatchObject({
			reps: 10,
			weight: 82.5,
			restTimeSeconds: 120,
			status: 'planned'
		});

		expect(
			await workoutBuilder.execute(athlete.id, {
				type: 'delete_set_target',
				setTargetId: addedTarget.setTargetId
			})
		).toEqual({ ok: true, command: 'delete_set_target' });
		expect(
			(await trainingSession.get(athlete.id, created.prescriptionId))?.workoutExercises[0].sets
		).toHaveLength(0);
	});

	databaseTest(
		'owns Workout Prescription and Prescription Exercise removal rules',
		async ({ harness }) => {
			const athlete = await harness.athlete();
			const otherAthlete = await harness.athlete();
			const catalogExercise = await harness.catalogExercise('Builder deadlift');
			const created = await workoutBuilder.execute(athlete.id, {
				type: 'create_prescription',
				name: 'Disposable',
				date: '2026-07-14'
			});
			if (!created.ok || created.command !== 'create_prescription') {
				throw new Error('Unexpected command outcome.');
			}
			const addedExercise = await workoutBuilder.execute(athlete.id, {
				type: 'add_prescription_exercise',
				prescriptionId: created.prescriptionId,
				exerciseId: catalogExercise.id
			});
			if (!addedExercise.ok || addedExercise.command !== 'add_prescription_exercise') {
				throw new Error('Unexpected command outcome.');
			}

			expect(
				await workoutBuilder.execute(otherAthlete.id, {
					type: 'remove_prescription_exercise',
					prescriptionExerciseId: addedExercise.prescriptionExerciseId
				})
			).toEqual({ ok: false, code: 'not_found' });
			expect(
				await workoutBuilder.execute(athlete.id, {
					type: 'remove_prescription_exercise',
					prescriptionExerciseId: addedExercise.prescriptionExerciseId
				})
			).toEqual({ ok: true, command: 'remove_prescription_exercise' });
			expect(
				await workoutBuilder.execute(athlete.id, {
					type: 'delete_prescription',
					prescriptionId: created.prescriptionId
				})
			).toEqual({ ok: true, command: 'delete_prescription' });

			const locked = await workoutBuilder.execute(athlete.id, {
				type: 'create_prescription',
				name: 'Historical',
				date: '2026-07-14'
			});
			if (!locked.ok || locked.command !== 'create_prescription') {
				throw new Error('Unexpected command outcome.');
			}
			await trainingSession.start(athlete.id, locked.prescriptionId);
			await trainingSession.finish(athlete.id, locked.prescriptionId);
			expect(
				await workoutBuilder.execute(athlete.id, {
					type: 'delete_prescription',
					prescriptionId: locked.prescriptionId
				})
			).toEqual({ ok: false, code: 'invalid_transition' });
		}
	);

	databaseTest(
		'repeats Set Targets idempotently without copying Set Results',
		async ({ harness }) => {
			const athlete = await harness.athlete();
			const catalogExercise = await harness.catalogExercise('Builder bench press');
			const created = await workoutBuilder.execute(athlete.id, {
				type: 'create_prescription',
				name: 'Repeat source',
				date: '2026-07-14'
			});
			if (!created.ok || created.command !== 'create_prescription') {
				throw new Error('Unexpected command outcome.');
			}
			const addedExercise = await workoutBuilder.execute(athlete.id, {
				type: 'add_prescription_exercise',
				prescriptionId: created.prescriptionId,
				exerciseId: catalogExercise.id,
				order: 1
			});
			if (!addedExercise.ok || addedExercise.command !== 'add_prescription_exercise') {
				throw new Error('Unexpected command outcome.');
			}
			const addedTarget = await workoutBuilder.execute(athlete.id, {
				type: 'add_set_target',
				prescriptionExerciseId: addedExercise.prescriptionExerciseId,
				setNumber: 1,
				reps: 8,
				weight: 100,
				weightUnit: 'kg'
			});
			if (!addedTarget.ok || addedTarget.command !== 'add_set_target') {
				throw new Error('Unexpected command outcome.');
			}
			await trainingSession.start(athlete.id, created.prescriptionId);
			await trainingSession.activateSetTarget(
				athlete.id,
				created.prescriptionId,
				addedTarget.setTargetId
			);
			await trainingSession.recordSetResult(athlete.id, created.prescriptionId, {
				setTargetId: addedTarget.setTargetId,
				reps: 10,
				weight: 105,
				weightUnit: 'kg'
			});

			const repeatToken = randomUUID();
			const repeat = () =>
				workoutBuilder.execute(athlete.id, {
					type: 'repeat_prescription' as const,
					prescriptionId: created.prescriptionId,
					repeatToken,
					date: '2026-07-15'
				});
			const [first, duplicate] = await Promise.all([repeat(), repeat()]);
			expect(first).toEqual({
				ok: true,
				command: 'repeat_prescription',
				prescriptionId: expect.any(Number)
			});
			expect(duplicate).toEqual(first);
			if (!first.ok || first.command !== 'repeat_prescription') {
				throw new Error('Unexpected command outcome.');
			}
			const otherSource = await workoutBuilder.execute(athlete.id, {
				type: 'create_prescription',
				name: 'Different repeat source',
				date: '2026-07-14'
			});
			if (!otherSource.ok || otherSource.command !== 'create_prescription') {
				throw new Error('Unexpected command outcome.');
			}
			expect(
				await workoutBuilder.execute(athlete.id, {
					type: 'repeat_prescription',
					prescriptionId: otherSource.prescriptionId,
					repeatToken,
					date: '2026-07-15'
				})
			).toEqual({ ok: false, code: 'conflict', reason: 'repeat_token' });
			const repeated = await trainingSession.get(athlete.id, first.prescriptionId);
			expect(repeated?.workoutExercises[0].sets[0]).toMatchObject({
				reps: 8,
				weight: 100,
				actualReps: null,
				actualWeight: null,
				status: 'planned'
			});
		}
	);

	databaseTest(
		'preserves completed Set Results while a Training Session remains active',
		async ({ harness }) => {
			const athlete = await harness.athlete();
			const catalogExercise = await harness.catalogExercise('Completed press');
			const created = await workoutBuilder.execute(athlete.id, {
				type: 'create_prescription',
				name: 'Active results',
				date: '2026-07-14'
			});
			if (!created.ok || created.command !== 'create_prescription') {
				throw new Error('Unexpected command outcome.');
			}
			const addedExercise = await workoutBuilder.execute(athlete.id, {
				type: 'add_prescription_exercise',
				prescriptionId: created.prescriptionId,
				exerciseId: catalogExercise.id
			});
			if (!addedExercise.ok || addedExercise.command !== 'add_prescription_exercise') {
				throw new Error('Unexpected command outcome.');
			}
			const addedTarget = await workoutBuilder.execute(athlete.id, {
				type: 'add_set_target',
				prescriptionExerciseId: addedExercise.prescriptionExerciseId,
				setNumber: 1,
				reps: 8,
				weight: 100,
				weightUnit: 'kg'
			});
			if (!addedTarget.ok || addedTarget.command !== 'add_set_target') {
				throw new Error('Unexpected command outcome.');
			}
			await trainingSession.start(athlete.id, created.prescriptionId);
			await trainingSession.activateSetTarget(
				athlete.id,
				created.prescriptionId,
				addedTarget.setTargetId
			);
			await trainingSession.recordSetResult(athlete.id, created.prescriptionId, {
				setTargetId: addedTarget.setTargetId,
				reps: 9,
				weight: 102.5,
				weightUnit: 'kg'
			});

			expect(
				await workoutBuilder.execute(athlete.id, {
					type: 'update_set_target',
					prescriptionExerciseId: addedExercise.prescriptionExerciseId,
					setTargetId: addedTarget.setTargetId,
					setNumber: 1,
					reps: 12,
					weightUnit: 'kg'
				})
			).toEqual({ ok: false, code: 'invalid_transition' });
			expect(
				await workoutBuilder.execute(athlete.id, {
					type: 'delete_set_target',
					setTargetId: addedTarget.setTargetId
				})
			).toEqual({ ok: false, code: 'invalid_transition' });
			expect(
				await workoutBuilder.execute(athlete.id, {
					type: 'remove_prescription_exercise',
					prescriptionExerciseId: addedExercise.prescriptionExerciseId
				})
			).toEqual({ ok: false, code: 'invalid_transition' });
			expect(
				await workoutBuilder.execute(athlete.id, {
					type: 'delete_prescription',
					prescriptionId: created.prescriptionId
				})
			).toEqual({ ok: false, code: 'invalid_transition' });
			const session = await trainingSession.get(athlete.id, created.prescriptionId);
			expect(session?.workoutExercises[0].sets[0]).toMatchObject({
				reps: 8,
				actualReps: 9,
				status: 'completed'
			});
		}
	);

	databaseTest(
		'rejects Set Target edits after a Training Session becomes historical',
		async ({ harness }) => {
			const athlete = await harness.athlete();
			const catalogExercise = await harness.catalogExercise('Historical curl');
			const created = await workoutBuilder.execute(athlete.id, {
				type: 'create_prescription',
				name: 'Historical targets',
				date: '2026-07-14'
			});
			if (!created.ok || created.command !== 'create_prescription') {
				throw new Error('Unexpected command outcome.');
			}
			const addedExercise = await workoutBuilder.execute(athlete.id, {
				type: 'add_prescription_exercise',
				prescriptionId: created.prescriptionId,
				exerciseId: catalogExercise.id
			});
			if (!addedExercise.ok || addedExercise.command !== 'add_prescription_exercise') {
				throw new Error('Unexpected command outcome.');
			}
			const addedTarget = await workoutBuilder.execute(athlete.id, {
				type: 'add_set_target',
				prescriptionExerciseId: addedExercise.prescriptionExerciseId,
				setNumber: 1,
				reps: 8,
				weightUnit: 'kg'
			});
			if (!addedTarget.ok || addedTarget.command !== 'add_set_target') {
				throw new Error('Unexpected command outcome.');
			}
			await trainingSession.start(athlete.id, created.prescriptionId);
			await trainingSession.finish(athlete.id, created.prescriptionId);
			await trainingSession.reopen(athlete.id, created.prescriptionId);

			expect(
				await workoutBuilder.execute(athlete.id, {
					type: 'update_set_target',
					prescriptionExerciseId: addedExercise.prescriptionExerciseId,
					setTargetId: addedTarget.setTargetId,
					setNumber: 1,
					reps: 12,
					weightUnit: 'kg'
				})
			).toEqual({ ok: false, code: 'invalid_transition' });
			expect(
				await workoutBuilder.execute(athlete.id, {
					type: 'delete_set_target',
					setTargetId: addedTarget.setTargetId
				})
			).toEqual({ ok: false, code: 'invalid_transition' });
		}
	);
});
