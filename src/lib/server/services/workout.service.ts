import { db } from '$lib/server/db';
import { exercise, set, trainingSegment, workout, workoutExercise } from '$lib/server/db/schema';
import type {
	CreateWorkoutSchemaType,
	RepeatWorkoutSchemaType
} from '$lib/types/workout.validation';
import { and, asc, desc, eq, isNull, ne } from 'drizzle-orm';

interface AddExerciseToWorkoutInput {
	workoutId: number;
	exerciseId: number;
	order?: number | null;
	notes?: string | null;
}

interface CreateExerciseForWorkoutInput {
	workoutId: number;
	name: string;
	muscleGroup?: string | null;
	description?: string | null;
	order?: number | null;
}

interface AddSetToWorkoutExerciseInput {
	workoutExerciseId: number;
	setNumber: number;
	reps: number;
	weight?: number | null;
	weightUnit?: string | null;
	restTimeSeconds?: number | null;
	completed?: boolean;
}

interface UpdateSetInput extends AddSetToWorkoutExerciseInput {
	setId: number;
}

interface CompleteLiveSetInput {
	setId: number;
	reps: number;
	weight?: number | null;
	weightUnit: 'kg' | 'lb';
}

function setCompletionFields(data: AddSetToWorkoutExerciseInput) {
	const completed = data.completed ?? true;
	return {
		completed,
		status: completed ? ('completed' as const) : ('planned' as const),
		completedAt: completed ? new Date() : null,
		actualReps: completed ? data.reps : null,
		actualWeight: completed ? data.weight : null,
		actualWeightUnit: completed ? data.weightUnit || 'kg' : null
	};
}

export class WorkoutService {
	async createWorkout(userId: string, workoutData: CreateWorkoutSchemaType) {
		const [createdWorkout] = await db
			.insert(workout)
			.values({
				userId,
				name: workoutData.name || null,
				date: new Date(`${workoutData.date}T12:00:00`),
				notes: workoutData.notes || null
			})
			.returning({ id: workout.id });

		if (!createdWorkout) {
			throw new Error('Failed to create workout.');
		}

		return createdWorkout;
	}

	async getWorkoutsByUserId(userId: string) {
		return db
			.select()
			.from(workout)
			.where(eq(workout.userId, userId))
			.orderBy(desc(workout.date), desc(workout.id));
	}

	async getExercises() {
		return db.select().from(exercise).orderBy(asc(exercise.name));
	}

	async getWorkoutById(userId: string, workoutId: number) {
		return (
			(await db.query.workout.findFirst({
				where: and(eq(workout.id, workoutId), eq(workout.userId, userId)),
				with: {
					trainingSegments: {
						orderBy: (segments, { asc }) => [asc(segments.startedAt), asc(segments.id)]
					},
					workoutExercises: {
						with: {
							exercise: true,
							sets: {
								orderBy: (sets, { asc }) => [asc(sets.setNumber)]
							}
						},
						orderBy: (workoutExercises, { asc }) => [asc(workoutExercises.order)]
					}
				}
			})) ?? null
		);
	}

	async startWorkout(userId: string, workoutId: number) {
		return db.transaction(async (tx) => {
			const now = new Date();
			const [startedWorkout] = await tx
				.update(workout)
				.set({
					sessionStatus: 'active',
					startedAt: now,
					activeStartedAt: now,
					finishedAt: null,
					durationSeconds: 0,
					restEndsAt: null
				})
				.where(
					and(
						eq(workout.id, workoutId),
						eq(workout.userId, userId),
						eq(workout.sessionStatus, 'planned')
					)
				)
				.returning();

			if (startedWorkout) {
				await tx.insert(trainingSegment).values({ workoutId, startedAt: now });
				return startedWorkout;
			}
			const [existing] = await tx
				.select()
				.from(workout)
				.where(and(eq(workout.id, workoutId), eq(workout.userId, userId)))
				.limit(1);
			if (existing?.sessionStatus === 'active') return existing;
			if (existing?.sessionStatus === 'finished') throw new Error('Reopen this workout first.');
			throw new Error('Workout not found.');
		});
	}

	async finishWorkout(userId: string, workoutId: number) {
		return db.transaction(async (tx) => {
			const [activeWorkout] = await tx
				.select()
				.from(workout)
				.where(
					and(
						eq(workout.id, workoutId),
						eq(workout.userId, userId),
						eq(workout.sessionStatus, 'active')
					)
				)
				.limit(1)
				.for('update');
			if (!activeWorkout?.activeStartedAt) throw new Error('Active workout not found.');

			const finishedAt = new Date();
			const segmentDurationSeconds = Math.max(
				0,
				Math.floor((finishedAt.getTime() - activeWorkout.activeStartedAt.getTime()) / 1000)
			);
			const durationSeconds = (activeWorkout.durationSeconds ?? 0) + segmentDurationSeconds;
			const [openSegment] = await tx
				.select({ id: trainingSegment.id })
				.from(trainingSegment)
				.where(and(eq(trainingSegment.workoutId, workoutId), isNull(trainingSegment.finishedAt)))
				.orderBy(desc(trainingSegment.startedAt), desc(trainingSegment.id))
				.limit(1)
				.for('update');
			if (!openSegment) throw new Error('Active Training Segment not found.');
			await tx
				.update(trainingSegment)
				.set({ finishedAt, durationSeconds: segmentDurationSeconds })
				.where(eq(trainingSegment.id, openSegment.id));
			const activeSets = await tx
				.select({ id: set.id })
				.from(set)
				.innerJoin(workoutExercise, eq(set.workoutExerciseId, workoutExercise.id))
				.where(and(eq(workoutExercise.workoutId, workoutId), eq(set.status, 'active')));
			for (const activeSet of activeSets) {
				await tx.update(set).set({ status: 'planned' }).where(eq(set.id, activeSet.id));
			}

			const [finishedWorkout] = await tx
				.update(workout)
				.set({
					sessionStatus: 'finished',
					finishedAt: activeWorkout.finishedAt ?? finishedAt,
					activeStartedAt: null,
					durationSeconds,
					restEndsAt: null
				})
				.where(eq(workout.id, workoutId))
				.returning();
			return finishedWorkout;
		});
	}

	async reopenWorkout(userId: string, workoutId: number) {
		return db.transaction(async (tx) => {
			const [existing] = await tx
				.select({ id: workout.id })
				.from(workout)
				.where(
					and(
						eq(workout.id, workoutId),
						eq(workout.userId, userId),
						eq(workout.sessionStatus, 'finished')
					)
				)
				.limit(1)
				.for('update');
			if (!existing) throw new Error('Finished workout not found.');

			const activeStartedAt = new Date();
			await tx.insert(trainingSegment).values({ workoutId, startedAt: activeStartedAt });
			const [reopenedWorkout] = await tx
				.update(workout)
				.set({ sessionStatus: 'active', activeStartedAt, restEndsAt: null })
				.where(eq(workout.id, workoutId))
				.returning();
			return reopenedWorkout;
		});
	}

	async activateSet(userId: string, workoutId: number, setId: number) {
		return db.transaction(async (tx) => {
			const [activeWorkout] = await tx
				.select({ id: workout.id })
				.from(workout)
				.where(
					and(
						eq(workout.id, workoutId),
						eq(workout.userId, userId),
						eq(workout.sessionStatus, 'active')
					)
				)
				.limit(1)
				.for('update');
			if (!activeWorkout) throw new Error('Active workout not found.');

			const [targetSet] = await tx
				.select({ id: set.id, status: set.status })
				.from(set)
				.innerJoin(workoutExercise, eq(set.workoutExerciseId, workoutExercise.id))
				.innerJoin(workout, eq(workoutExercise.workoutId, workout.id))
				.where(
					and(
						eq(set.id, setId),
						eq(workout.id, workoutId),
						eq(workout.userId, userId),
						eq(workout.sessionStatus, 'active')
					)
				)
				.limit(1);
			if (!targetSet || !['planned', 'skipped', 'active'].includes(targetSet.status))
				throw new Error('Set is not available.');

			const activeSets = await tx
				.select({ id: set.id })
				.from(set)
				.innerJoin(workoutExercise, eq(set.workoutExerciseId, workoutExercise.id))
				.where(and(eq(workoutExercise.workoutId, workoutId), eq(set.status, 'active')));
			for (const activeSet of activeSets) {
				if (activeSet.id !== setId)
					await tx.update(set).set({ status: 'planned' }).where(eq(set.id, activeSet.id));
			}
			const [activatedSet] = await tx
				.update(set)
				.set({ status: 'active', completed: false, completedAt: null })
				.where(eq(set.id, setId))
				.returning();
			return activatedSet;
		});
	}

	async completeLiveSet(userId: string, workoutId: number, data: CompleteLiveSetInput) {
		return db.transaction(async (tx) => {
			const [activeWorkout] = await tx
				.select({ id: workout.id })
				.from(workout)
				.where(
					and(
						eq(workout.id, workoutId),
						eq(workout.userId, userId),
						eq(workout.sessionStatus, 'active')
					)
				)
				.limit(1)
				.for('update');
			if (!activeWorkout) throw new Error('Active workout not found.');

			const [targetSet] = await tx
				.select({ id: set.id, restTimeSeconds: set.restTimeSeconds })
				.from(set)
				.innerJoin(workoutExercise, eq(set.workoutExerciseId, workoutExercise.id))
				.innerJoin(workout, eq(workoutExercise.workoutId, workout.id))
				.where(
					and(
						eq(set.id, data.setId),
						eq(set.status, 'active'),
						eq(workout.id, workoutId),
						eq(workout.userId, userId),
						eq(workout.sessionStatus, 'active')
					)
				)
				.limit(1);
			if (!targetSet) throw new Error('Active set not found.');

			const completedAt = new Date();
			const [completedSet] = await tx
				.update(set)
				.set({
					actualReps: data.reps,
					actualWeight: data.weight,
					actualWeightUnit: data.weightUnit,
					status: 'completed',
					completed: true,
					completedAt
				})
				.where(eq(set.id, data.setId))
				.returning();
			const restEndsAt = targetSet.restTimeSeconds
				? new Date(completedAt.getTime() + targetSet.restTimeSeconds * 1000)
				: null;
			await tx
				.update(workout)
				.set({ restEndsAt })
				.where(and(eq(workout.id, workoutId), eq(workout.userId, userId)));
			return completedSet;
		});
	}

	async skipSet(userId: string, workoutId: number, setId: number) {
		return db.transaction(async (tx) => {
			const [activeWorkout] = await tx
				.select({ id: workout.id })
				.from(workout)
				.where(
					and(
						eq(workout.id, workoutId),
						eq(workout.userId, userId),
						eq(workout.sessionStatus, 'active')
					)
				)
				.limit(1)
				.for('update');
			if (!activeWorkout) throw new Error('Active workout not found.');

			const [ownedSet] = await tx
				.select({ id: set.id })
				.from(set)
				.innerJoin(workoutExercise, eq(set.workoutExerciseId, workoutExercise.id))
				.where(
					and(
						eq(set.id, setId),
						ne(set.status, 'completed'),
						eq(workoutExercise.workoutId, workoutId)
					)
				)
				.limit(1);
			if (!ownedSet) throw new Error('Set not found.');

			const [skippedSet] = await tx
				.update(set)
				.set({ status: 'skipped', completed: false, completedAt: null })
				.where(eq(set.id, ownedSet.id))
				.returning();
			return skippedSet;
		});
	}

	async dismissRest(userId: string, workoutId: number) {
		const [updatedWorkout] = await db
			.update(workout)
			.set({ restEndsAt: null })
			.where(
				and(
					eq(workout.id, workoutId),
					eq(workout.userId, userId),
					eq(workout.sessionStatus, 'active')
				)
			)
			.returning({ id: workout.id });
		if (!updatedWorkout) throw new Error('Active workout not found.');
	}

	async updateWorkout(
		userId: string,
		data: { workoutId: number; name?: string; date: string; notes?: string }
	) {
		const [updatedWorkout] = await db
			.update(workout)
			.set({
				name: data.name || null,
				date: new Date(`${data.date}T12:00:00`),
				notes: data.notes || null
			})
			.where(
				and(eq(workout.id, data.workoutId), eq(workout.userId, userId), isNull(workout.finishedAt))
			)
			.returning({ id: workout.id });

		if (!updatedWorkout) throw new Error('Workout not found.');
		return updatedWorkout;
	}

	async deleteWorkout(userId: string, workoutId: number) {
		const [deletedWorkout] = await db
			.delete(workout)
			.where(and(eq(workout.id, workoutId), eq(workout.userId, userId), isNull(workout.finishedAt)))
			.returning({ id: workout.id });

		if (!deletedWorkout) throw new Error('Workout not found.');
	}

	async repeatWorkout(userId: string, data: RepeatWorkoutSchemaType) {
		return db.transaction(async (tx) => {
			const sourceWorkout = await tx.query.workout.findFirst({
				where: and(eq(workout.id, data.workoutId), eq(workout.userId, userId)),
				with: {
					workoutExercises: {
						with: {
							sets: {
								orderBy: (sets, { asc }) => [asc(sets.setNumber)]
							}
						},
						orderBy: (workoutExercises, { asc }) => [asc(workoutExercises.order)]
					}
				}
			});

			if (!sourceWorkout) throw new Error('Workout not found.');
			const now = new Date();
			const todayAtNoonUtc = new Date(
				Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate(), 12)
			);

			const [createdWorkout] = await tx
				.insert(workout)
				.values({
					userId,
					name: sourceWorkout.name,
					date: todayAtNoonUtc,
					notes: sourceWorkout.notes,
					repeatToken: data.repeatToken
				})
				.onConflictDoNothing({ target: workout.repeatToken })
				.returning({ id: workout.id });

			if (!createdWorkout) {
				const [existingWorkout] = await tx
					.select({ id: workout.id })
					.from(workout)
					.where(and(eq(workout.repeatToken, data.repeatToken), eq(workout.userId, userId)))
					.limit(1);
				if (!existingWorkout) throw new Error('Repeat request already used.');
				return existingWorkout;
			}

			for (const sourceExercise of sourceWorkout.workoutExercises) {
				const [createdExercise] = await tx
					.insert(workoutExercise)
					.values({
						workoutId: createdWorkout.id,
						exerciseId: sourceExercise.exerciseId,
						order: sourceExercise.order,
						notes: sourceExercise.notes
					})
					.returning({ id: workoutExercise.id });

				if (!createdExercise) throw new Error('Failed to copy exercise.');
				if (sourceExercise.sets.length > 0) {
					await tx.insert(set).values(
						sourceExercise.sets.map((sourceSet) => ({
							workoutExerciseId: createdExercise.id,
							setNumber: sourceSet.setNumber,
							reps: sourceSet.reps,
							weight: sourceSet.weight,
							weightUnit: sourceSet.weightUnit,
							restTimeSeconds: sourceSet.restTimeSeconds,
							completed: false
						}))
					);
				}
			}

			return createdWorkout;
		});
	}

	async addExerciseToWorkout(userId: string, data: AddExerciseToWorkoutInput) {
		return db.transaction(async (tx) => {
			const [ownedWorkout] = await tx
				.select({ id: workout.id, finishedAt: workout.finishedAt })
				.from(workout)
				.where(and(eq(workout.id, data.workoutId), eq(workout.userId, userId)))
				.limit(1)
				.for('update');
			if (!ownedWorkout || ownedWorkout.finishedAt) throw new Error('Workout not found.');

			const [existingExercise] = await tx
				.select({ id: exercise.id })
				.from(exercise)
				.where(eq(exercise.id, data.exerciseId))
				.limit(1);
			if (!existingExercise) throw new Error('Exercise not found.');

			const [createdWorkoutExercise] = await tx
				.insert(workoutExercise)
				.values({
					workoutId: data.workoutId,
					exerciseId: data.exerciseId,
					order: data.order,
					notes: data.notes
				})
				.returning();
			if (!createdWorkoutExercise) throw new Error('Failed to add exercise.');
			return createdWorkoutExercise;
		});
	}

	async createExerciseForWorkout(userId: string, data: CreateExerciseForWorkoutInput) {
		return db.transaction(async (tx) => {
			const [ownedWorkout] = await tx
				.select({ id: workout.id, finishedAt: workout.finishedAt })
				.from(workout)
				.where(and(eq(workout.id, data.workoutId), eq(workout.userId, userId)))
				.limit(1)
				.for('update');

			if (!ownedWorkout || ownedWorkout.finishedAt) {
				throw new Error('Workout not found.');
			}

			const [createdExercise] = await tx
				.insert(exercise)
				.values({
					name: data.name,
					muscleGroup: data.muscleGroup || null,
					description: data.description || null
				})
				.returning({ id: exercise.id });

			if (!createdExercise) {
				throw new Error('Failed to create exercise.');
			}

			const [createdWorkoutExercise] = await tx
				.insert(workoutExercise)
				.values({
					workoutId: data.workoutId,
					exerciseId: createdExercise.id,
					order: data.order
				})
				.returning();

			if (!createdWorkoutExercise) {
				throw new Error('Failed to add the new exercise.');
			}

			return createdWorkoutExercise;
		});
	}

	async addSetToWorkoutExercise(userId: string, data: AddSetToWorkoutExerciseInput) {
		return db.transaction(async (tx) => {
			const [ownedWorkoutExercise] = await tx
				.select({ id: workoutExercise.id, finishedAt: workout.finishedAt })
				.from(workoutExercise)
				.innerJoin(workout, eq(workoutExercise.workoutId, workout.id))
				.where(and(eq(workoutExercise.id, data.workoutExerciseId), eq(workout.userId, userId)))
				.limit(1)
				.for('update');
			if (!ownedWorkoutExercise || ownedWorkoutExercise.finishedAt)
				throw new Error('Exercise entry not found.');

			const [createdSet] = await tx
				.insert(set)
				.values({
					workoutExerciseId: data.workoutExerciseId,
					setNumber: data.setNumber,
					reps: data.reps,
					weight: data.weight,
					weightUnit: data.weightUnit || 'kg',
					restTimeSeconds: data.restTimeSeconds,
					...setCompletionFields(data)
				})
				.returning();
			if (!createdSet) throw new Error('Failed to add set.');
			return createdSet;
		});
	}

	async updateSet(userId: string, data: UpdateSetInput) {
		return db.transaction(async (tx) => {
			const [ownedSet] = await tx
				.select({ id: set.id, finishedAt: workout.finishedAt })
				.from(set)
				.innerJoin(workoutExercise, eq(set.workoutExerciseId, workoutExercise.id))
				.innerJoin(workout, eq(workoutExercise.workoutId, workout.id))
				.where(
					and(
						eq(set.id, data.setId),
						eq(set.workoutExerciseId, data.workoutExerciseId),
						eq(workout.userId, userId)
					)
				)
				.limit(1)
				.for('update');

			if (!ownedSet || ownedSet.finishedAt) throw new Error('Set not found.');

			const existingSets = await tx
				.select({ id: set.id })
				.from(set)
				.where(eq(set.workoutExerciseId, data.workoutExerciseId))
				.orderBy(asc(set.setNumber), asc(set.id));
			const reorderedSets = existingSets.filter((entry) => entry.id !== data.setId);
			reorderedSets.splice(Math.min(data.setNumber - 1, reorderedSets.length), 0, {
				id: data.setId
			});

			const [updatedSet] = await tx
				.update(set)
				.set({
					reps: data.reps,
					weight: data.weight,
					weightUnit: data.weightUnit || 'kg',
					restTimeSeconds: data.restTimeSeconds,
					...setCompletionFields(data)
				})
				.where(eq(set.id, data.setId))
				.returning();

			if (!updatedSet) throw new Error('Failed to update set.');
			for (const [index, entry] of reorderedSets.entries()) {
				await tx
					.update(set)
					.set({ setNumber: index + 1 })
					.where(eq(set.id, entry.id));
			}
			return updatedSet;
		});
	}

	async deleteSet(userId: string, setId: number) {
		return db.transaction(async (tx) => {
			const [ownedSet] = await tx
				.select({
					id: set.id,
					workoutExerciseId: set.workoutExerciseId,
					finishedAt: workout.finishedAt
				})
				.from(set)
				.innerJoin(workoutExercise, eq(set.workoutExerciseId, workoutExercise.id))
				.innerJoin(workout, eq(workoutExercise.workoutId, workout.id))
				.where(and(eq(set.id, setId), eq(workout.userId, userId)))
				.limit(1)
				.for('update');

			if (!ownedSet || ownedSet.finishedAt) throw new Error('Set not found.');
			await tx.delete(set).where(eq(set.id, setId));

			const remainingSets = await tx
				.select({ id: set.id })
				.from(set)
				.where(eq(set.workoutExerciseId, ownedSet.workoutExerciseId))
				.orderBy(asc(set.setNumber), asc(set.id));

			for (const [index, remainingSet] of remainingSets.entries()) {
				await tx
					.update(set)
					.set({ setNumber: index + 1 })
					.where(eq(set.id, remainingSet.id));
			}
		});
	}

	async removeExerciseFromWorkout(userId: string, workoutExerciseId: number) {
		return db.transaction(async (tx) => {
			const [ownedEntry] = await tx
				.select({
					id: workoutExercise.id,
					workoutId: workoutExercise.workoutId,
					finishedAt: workout.finishedAt
				})
				.from(workoutExercise)
				.innerJoin(workout, eq(workoutExercise.workoutId, workout.id))
				.where(and(eq(workoutExercise.id, workoutExerciseId), eq(workout.userId, userId)))
				.limit(1)
				.for('update');

			if (!ownedEntry || ownedEntry.finishedAt) throw new Error('Exercise entry not found.');
			await tx.delete(workoutExercise).where(eq(workoutExercise.id, workoutExerciseId));

			const remainingExercises = await tx
				.select({ id: workoutExercise.id })
				.from(workoutExercise)
				.where(eq(workoutExercise.workoutId, ownedEntry.workoutId))
				.orderBy(asc(workoutExercise.order), asc(workoutExercise.id));

			for (const [index, entry] of remainingExercises.entries()) {
				await tx
					.update(workoutExercise)
					.set({ order: index + 1 })
					.where(eq(workoutExercise.id, entry.id));
			}
		});
	}
}

export const workoutService = new WorkoutService();
