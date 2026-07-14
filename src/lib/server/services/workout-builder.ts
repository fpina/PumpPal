import { db } from '$lib/server/db';
import { exercise, set, workout, workoutExercise } from '$lib/server/db/schema';
import { and, asc, desc, eq, isNull, or } from 'drizzle-orm';

interface SetTargetValues {
	setNumber: number;
	reps: number;
	weight?: number | null;
	weightUnit?: 'kg' | 'lb' | null;
	restTimeSeconds?: number | null;
}

export type WorkoutBuilderCommand =
	| {
			type: 'create_prescription';
			name?: string;
			date: string;
			notes?: string;
	  }
	| {
			type: 'update_prescription';
			prescriptionId: number;
			name?: string;
			date: string;
			notes?: string;
	  }
	| {
			type: 'delete_prescription';
			prescriptionId: number;
	  }
	| {
			type: 'repeat_prescription';
			prescriptionId: number;
			repeatToken: string;
			date: string;
	  }
	| {
			type: 'add_prescription_exercise';
			prescriptionId: number;
			exerciseId: number;
			order?: number | null;
			notes?: string | null;
	  }
	| {
			type: 'create_custom_exercise';
			prescriptionId: number;
			name: string;
			muscleGroup?: string | null;
			description?: string | null;
			order?: number | null;
	  }
	| ({
			type: 'add_set_target';
			prescriptionExerciseId: number;
	  } & SetTargetValues)
	| ({
			type: 'update_set_target';
			prescriptionExerciseId: number;
			setTargetId: number;
	  } & SetTargetValues)
	| {
			type: 'delete_set_target';
			setTargetId: number;
	  }
	| {
			type: 'remove_prescription_exercise';
			prescriptionExerciseId: number;
	  };

export type WorkoutBuilderOutcome =
	| { ok: true; command: 'create_prescription'; prescriptionId: number }
	| { ok: true; command: 'update_prescription' }
	| { ok: true; command: 'delete_prescription' }
	| { ok: true; command: 'repeat_prescription'; prescriptionId: number }
	| { ok: true; command: 'add_prescription_exercise'; prescriptionExerciseId: number }
	| {
			ok: true;
			command: 'create_custom_exercise';
			exerciseId: number;
			prescriptionExerciseId: number;
	  }
	| { ok: true; command: 'add_set_target'; setTargetId: number }
	| { ok: true; command: 'update_set_target' }
	| { ok: true; command: 'delete_set_target' }
	| { ok: true; command: 'remove_prescription_exercise' }
	| { ok: false; code: 'not_found' | 'invalid_transition' }
	| { ok: false; code: 'conflict'; reason: 'custom_exercise_name' | 'repeat_token' };

type Transaction = Parameters<Parameters<typeof db.transaction>[0]>[0];

function exerciseNames(name: string) {
	const displayName = name.trim().replace(/\s+/gu, ' ');
	return { displayName, normalizedName: displayName.toLowerCase() };
}

function exerciseVisibleToAthlete(athleteId: string) {
	return or(isNull(exercise.ownerId), eq(exercise.ownerId, athleteId));
}

async function lockOwnedPrescription(tx: Transaction, athleteId: string, prescriptionId: number) {
	const [prescription] = await tx
		.select({ id: workout.id, finishedAt: workout.finishedAt })
		.from(workout)
		.where(and(eq(workout.id, prescriptionId), eq(workout.userId, athleteId)))
		.limit(1)
		.for('update');
	return prescription ?? null;
}

async function lockEditablePrescription(
	tx: Transaction,
	athleteId: string,
	prescriptionId: number
) {
	const prescription = await lockOwnedPrescription(tx, athleteId, prescriptionId);
	if (!prescription) return { ok: false, code: 'not_found' } as const;
	if (prescription.finishedAt !== null) {
		return { ok: false, code: 'invalid_transition' } as const;
	}
	return { ok: true, prescription } as const;
}

async function ownedPrescriptionIdForExercise(
	tx: Transaction,
	athleteId: string,
	workoutExerciseId: number
) {
	const [entry] = await tx
		.select({ prescriptionId: workoutExercise.workoutId })
		.from(workoutExercise)
		.innerJoin(workout, eq(workoutExercise.workoutId, workout.id))
		.where(and(eq(workoutExercise.id, workoutExerciseId), eq(workout.userId, athleteId)))
		.limit(1);
	return entry?.prescriptionId ?? null;
}

async function ownedSetTarget(tx: Transaction, athleteId: string, setTargetId: number) {
	const [target] = await tx
		.select({
			id: set.id,
			workoutExerciseId: set.workoutExerciseId,
			prescriptionId: workoutExercise.workoutId,
			status: set.status
		})
		.from(set)
		.innerJoin(workoutExercise, eq(set.workoutExerciseId, workoutExercise.id))
		.innerJoin(workout, eq(workoutExercise.workoutId, workout.id))
		.where(and(eq(set.id, setTargetId), eq(workout.userId, athleteId)))
		.limit(1);
	return target ?? null;
}

async function prescriptionHasSetResults(tx: Transaction, prescriptionId: number) {
	const [result] = await tx
		.select({ id: set.id })
		.from(set)
		.innerJoin(workoutExercise, eq(set.workoutExerciseId, workoutExercise.id))
		.where(and(eq(workoutExercise.workoutId, prescriptionId), eq(set.status, 'completed')))
		.limit(1);
	return result !== undefined;
}

async function prescriptionExerciseHasSetResults(tx: Transaction, prescriptionExerciseId: number) {
	const [result] = await tx
		.select({ id: set.id })
		.from(set)
		.where(and(eq(set.workoutExerciseId, prescriptionExerciseId), eq(set.status, 'completed')))
		.limit(1);
	return result !== undefined;
}

export const workoutBuilder = {
	async listPrescriptions(athleteId: string) {
		return db
			.select()
			.from(workout)
			.where(eq(workout.userId, athleteId))
			.orderBy(desc(workout.date), desc(workout.id));
	},

	async listAvailableExercises(athleteId: string) {
		return db
			.select()
			.from(exercise)
			.where(exerciseVisibleToAthlete(athleteId))
			.orderBy(asc(exercise.name));
	},

	async execute(athleteId: string, command: WorkoutBuilderCommand): Promise<WorkoutBuilderOutcome> {
		switch (command.type) {
			case 'create_prescription': {
				const [created] = await db
					.insert(workout)
					.values({
						userId: athleteId,
						name: command.name || null,
						date: command.date,
						notes: command.notes || null
					})
					.returning({ id: workout.id });

				if (!created) throw new Error('Failed to create Workout Prescription.');
				return {
					ok: true,
					command: 'create_prescription',
					prescriptionId: created.id
				};
			}
			case 'update_prescription':
				return db.transaction(async (tx) => {
					const editable = await lockEditablePrescription(tx, athleteId, command.prescriptionId);
					if (!editable.ok) return editable;
					const { prescription } = editable;

					const [updated] = await tx
						.update(workout)
						.set({
							name: command.name || null,
							date: command.date,
							notes: command.notes || null
						})
						.where(eq(workout.id, prescription.id))
						.returning({ id: workout.id });
					if (!updated) throw new Error('Failed to update Workout Prescription.');
					return { ok: true, command: 'update_prescription' };
				});
			case 'delete_prescription':
				return db.transaction(async (tx) => {
					const editable = await lockEditablePrescription(tx, athleteId, command.prescriptionId);
					if (!editable.ok) return editable;
					const { prescription } = editable;
					if (await prescriptionHasSetResults(tx, prescription.id)) {
						return { ok: false, code: 'invalid_transition' };
					}

					const [deleted] = await tx
						.delete(workout)
						.where(eq(workout.id, prescription.id))
						.returning({ id: workout.id });
					if (!deleted) throw new Error('Failed to delete Workout Prescription.');
					return { ok: true, command: 'delete_prescription' };
				});
			case 'repeat_prescription':
				return db.transaction(async (tx) => {
					const lockedSource = await lockOwnedPrescription(tx, athleteId, command.prescriptionId);
					if (!lockedSource) return { ok: false, code: 'not_found' };
					const source = await tx.query.workout.findFirst({
						where: and(eq(workout.id, command.prescriptionId), eq(workout.userId, athleteId)),
						with: {
							workoutExercises: {
								with: {
									sets: { orderBy: (targets, { asc }) => [asc(targets.setNumber)] }
								},
								orderBy: (entries, { asc }) => [asc(entries.order)]
							}
						}
					});
					if (!source) throw new Error('Locked Workout Prescription disappeared.');

					const [created] = await tx
						.insert(workout)
						.values({
							userId: athleteId,
							name: source.name,
							date: command.date,
							notes: source.notes,
							repeatToken: command.repeatToken,
							repeatedFromWorkoutId: source.id
						})
						.onConflictDoNothing({ target: workout.repeatToken })
						.returning({ id: workout.id });

					if (!created) {
						const [existing] = await tx
							.select({
								id: workout.id,
								date: workout.date,
								repeatedFromWorkoutId: workout.repeatedFromWorkoutId
							})
							.from(workout)
							.where(
								and(eq(workout.repeatToken, command.repeatToken), eq(workout.userId, athleteId))
							)
							.limit(1);
						return existing &&
							existing.repeatedFromWorkoutId === command.prescriptionId &&
							existing.date === command.date
							? {
									ok: true,
									command: 'repeat_prescription',
									prescriptionId: existing.id
								}
							: { ok: false, code: 'conflict', reason: 'repeat_token' };
					}

					for (const sourceExercise of source.workoutExercises) {
						const [createdExercise] = await tx
							.insert(workoutExercise)
							.values({
								workoutId: created.id,
								exerciseId: sourceExercise.exerciseId,
								order: sourceExercise.order,
								notes: sourceExercise.notes
							})
							.returning({ id: workoutExercise.id });
						if (!createdExercise) {
							throw new Error('Failed to copy Exercise into repeated Workout Prescription.');
						}
						if (sourceExercise.sets.length > 0) {
							await tx.insert(set).values(
								sourceExercise.sets.map((sourceTarget) => ({
									workoutExerciseId: createdExercise.id,
									setNumber: sourceTarget.setNumber,
									reps: sourceTarget.reps,
									weight: sourceTarget.weight,
									weightUnit: sourceTarget.weightUnit,
									restTimeSeconds: sourceTarget.restTimeSeconds
								}))
							);
						}
					}

					return {
						ok: true,
						command: 'repeat_prescription',
						prescriptionId: created.id
					};
				});
			case 'add_prescription_exercise':
				return db.transaction(async (tx) => {
					const editable = await lockEditablePrescription(tx, athleteId, command.prescriptionId);
					if (!editable.ok) return editable;
					const { prescription } = editable;

					const [visibleExercise] = await tx
						.select({ id: exercise.id })
						.from(exercise)
						.where(and(eq(exercise.id, command.exerciseId), exerciseVisibleToAthlete(athleteId)))
						.limit(1);
					if (!visibleExercise) return { ok: false, code: 'not_found' };

					const [created] = await tx
						.insert(workoutExercise)
						.values({
							workoutId: prescription.id,
							exerciseId: visibleExercise.id,
							order: command.order,
							notes: command.notes
						})
						.returning({ id: workoutExercise.id });
					if (!created) throw new Error('Failed to add Exercise to Workout Prescription.');
					return {
						ok: true,
						command: 'add_prescription_exercise',
						prescriptionExerciseId: created.id
					};
				});
			case 'create_custom_exercise':
				return db.transaction(async (tx) => {
					const editable = await lockEditablePrescription(tx, athleteId, command.prescriptionId);
					if (!editable.ok) return editable;
					const { prescription } = editable;

					const names = exerciseNames(command.name);
					const [createdExercise] = await tx
						.insert(exercise)
						.values({
							ownerId: athleteId,
							name: names.displayName,
							normalizedName: names.normalizedName,
							muscleGroup: command.muscleGroup || null,
							description: command.description || null
						})
						.onConflictDoNothing()
						.returning({ id: exercise.id });
					if (!createdExercise) {
						return { ok: false, code: 'conflict', reason: 'custom_exercise_name' };
					}

					const [createdEntry] = await tx
						.insert(workoutExercise)
						.values({
							workoutId: prescription.id,
							exerciseId: createdExercise.id,
							order: command.order
						})
						.returning({ id: workoutExercise.id });
					if (!createdEntry) {
						throw new Error('Failed to add Custom Exercise to Workout Prescription.');
					}
					return {
						ok: true,
						command: 'create_custom_exercise',
						exerciseId: createdExercise.id,
						prescriptionExerciseId: createdEntry.id
					};
				});
			case 'add_set_target':
				return db.transaction(async (tx) => {
					const prescriptionId = await ownedPrescriptionIdForExercise(
						tx,
						athleteId,
						command.prescriptionExerciseId
					);
					if (!prescriptionId) return { ok: false, code: 'not_found' };
					const editable = await lockEditablePrescription(tx, athleteId, prescriptionId);
					if (!editable.ok) return editable;
					const { prescription } = editable;
					const currentPrescriptionId = await ownedPrescriptionIdForExercise(
						tx,
						athleteId,
						command.prescriptionExerciseId
					);
					if (currentPrescriptionId !== prescription.id) return { ok: false, code: 'not_found' };

					const [created] = await tx
						.insert(set)
						.values({
							workoutExerciseId: command.prescriptionExerciseId,
							setNumber: command.setNumber,
							reps: command.reps,
							weight: command.weight,
							weightUnit: command.weightUnit || 'kg',
							restTimeSeconds: command.restTimeSeconds
						})
						.returning({ id: set.id });
					if (!created) throw new Error('Failed to add Set Target.');
					return { ok: true, command: 'add_set_target', setTargetId: created.id };
				});
			case 'update_set_target':
				return db.transaction(async (tx) => {
					const target = await ownedSetTarget(tx, athleteId, command.setTargetId);
					if (!target || target.workoutExerciseId !== command.prescriptionExerciseId) {
						return { ok: false, code: 'not_found' };
					}
					const editable = await lockEditablePrescription(tx, athleteId, target.prescriptionId);
					if (!editable.ok) return editable;
					const currentTarget = await ownedSetTarget(tx, athleteId, command.setTargetId);
					if (
						!currentTarget ||
						currentTarget.workoutExerciseId !== command.prescriptionExerciseId
					) {
						return { ok: false, code: 'not_found' };
					}
					if (currentTarget.status === 'completed') {
						return { ok: false, code: 'invalid_transition' };
					}

					const existingTargets = await tx
						.select({ id: set.id })
						.from(set)
						.where(eq(set.workoutExerciseId, command.prescriptionExerciseId))
						.orderBy(asc(set.setNumber), asc(set.id));
					const reorderedTargets = existingTargets.filter(({ id }) => id !== command.setTargetId);
					reorderedTargets.splice(Math.min(command.setNumber - 1, reorderedTargets.length), 0, {
						id: command.setTargetId
					});

					const [updated] = await tx
						.update(set)
						.set({
							reps: command.reps,
							weight: command.weight,
							weightUnit: command.weightUnit || 'kg',
							restTimeSeconds: command.restTimeSeconds
						})
						.where(eq(set.id, command.setTargetId))
						.returning({ id: set.id });
					if (!updated) throw new Error('Failed to update Set Target.');
					for (const [index, entry] of reorderedTargets.entries()) {
						await tx
							.update(set)
							.set({ setNumber: index + 1 })
							.where(eq(set.id, entry.id));
					}
					return { ok: true, command: 'update_set_target' };
				});
			case 'delete_set_target':
				return db.transaction(async (tx) => {
					const target = await ownedSetTarget(tx, athleteId, command.setTargetId);
					if (!target) return { ok: false, code: 'not_found' };
					const editable = await lockEditablePrescription(tx, athleteId, target.prescriptionId);
					if (!editable.ok) return editable;
					const currentTarget = await ownedSetTarget(tx, athleteId, command.setTargetId);
					if (!currentTarget) return { ok: false, code: 'not_found' };
					if (currentTarget.status === 'completed') {
						return { ok: false, code: 'invalid_transition' };
					}

					await tx.delete(set).where(eq(set.id, currentTarget.id));
					const remainingTargets = await tx
						.select({ id: set.id })
						.from(set)
						.where(eq(set.workoutExerciseId, currentTarget.workoutExerciseId))
						.orderBy(asc(set.setNumber), asc(set.id));
					for (const [index, entry] of remainingTargets.entries()) {
						await tx
							.update(set)
							.set({ setNumber: index + 1 })
							.where(eq(set.id, entry.id));
					}
					return { ok: true, command: 'delete_set_target' };
				});
			case 'remove_prescription_exercise':
				return db.transaction(async (tx) => {
					const prescriptionId = await ownedPrescriptionIdForExercise(
						tx,
						athleteId,
						command.prescriptionExerciseId
					);
					if (!prescriptionId) return { ok: false, code: 'not_found' };
					const editable = await lockEditablePrescription(tx, athleteId, prescriptionId);
					if (!editable.ok) return editable;
					const { prescription } = editable;
					const currentPrescriptionId = await ownedPrescriptionIdForExercise(
						tx,
						athleteId,
						command.prescriptionExerciseId
					);
					if (currentPrescriptionId !== prescription.id) {
						return { ok: false, code: 'not_found' };
					}
					if (await prescriptionExerciseHasSetResults(tx, command.prescriptionExerciseId)) {
						return { ok: false, code: 'invalid_transition' };
					}

					await tx
						.delete(workoutExercise)
						.where(eq(workoutExercise.id, command.prescriptionExerciseId));
					const remainingEntries = await tx
						.select({ id: workoutExercise.id })
						.from(workoutExercise)
						.where(eq(workoutExercise.workoutId, prescription.id))
						.orderBy(asc(workoutExercise.order), asc(workoutExercise.id));
					for (const [index, entry] of remainingEntries.entries()) {
						await tx
							.update(workoutExercise)
							.set({ order: index + 1 })
							.where(eq(workoutExercise.id, entry.id));
					}
					return { ok: true, command: 'remove_prescription_exercise' };
				});
		}
	}
};
