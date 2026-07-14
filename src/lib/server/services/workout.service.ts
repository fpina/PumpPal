import { db } from '$lib/server/db';
import { exercise, set, workout, workoutExercise } from '$lib/server/db/schema';
import type {
	CreateWorkoutSchemaType,
	RepeatWorkoutSchemaType
} from '$lib/types/workout.validation';
import { and, asc, desc, eq, isNull, or } from 'drizzle-orm';
import { editablePrescriptionCondition, prescriptionIsEditable } from './training-session';

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

export class WorkoutDomainError extends Error {
	constructor(message: string) {
		super(message);
		this.name = 'WorkoutDomainError';
	}
}

export class ExerciseNameConflictError extends WorkoutDomainError {
	constructor() {
		super('A Custom Exercise with that name already exists.');
		this.name = 'ExerciseNameConflictError';
	}
}

function exerciseNames(name: string) {
	const displayName = name.trim().replace(/\s+/gu, ' ');
	return { displayName, normalizedName: displayName.toLowerCase() };
}

function exerciseVisibleToAthlete(athleteId: string) {
	return or(isNull(exercise.ownerId), eq(exercise.ownerId, athleteId));
}

function setCompletionFields(data: AddSetToWorkoutExerciseInput) {
	const completed = data.completed ?? false;
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
				date: workoutData.date,
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

	async getExercises(userId: string) {
		return db
			.select()
			.from(exercise)
			.where(exerciseVisibleToAthlete(userId))
			.orderBy(asc(exercise.name));
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

	async updateWorkout(
		userId: string,
		data: { workoutId: number; name?: string; date: string; notes?: string }
	) {
		const [updatedWorkout] = await db
			.update(workout)
			.set({
				name: data.name || null,
				date: data.date,
				notes: data.notes || null
			})
			.where(
				and(
					eq(workout.id, data.workoutId),
					eq(workout.userId, userId),
					editablePrescriptionCondition()
				)
			)
			.returning({ id: workout.id });

		if (!updatedWorkout) throw new WorkoutDomainError('Workout not found.');
		return updatedWorkout;
	}

	async deleteWorkout(userId: string, workoutId: number) {
		const [deletedWorkout] = await db
			.delete(workout)
			.where(
				and(eq(workout.id, workoutId), eq(workout.userId, userId), editablePrescriptionCondition())
			)
			.returning({ id: workout.id });

		if (!deletedWorkout) throw new WorkoutDomainError('Workout not found.');
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

			if (!sourceWorkout) throw new WorkoutDomainError('Workout not found.');
			const [createdWorkout] = await tx
				.insert(workout)
				.values({
					userId,
					name: sourceWorkout.name,
					date: data.date,
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
				if (!existingWorkout) throw new WorkoutDomainError('Repeat request already used.');
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
			if (!ownedWorkout || !prescriptionIsEditable(ownedWorkout.finishedAt))
				throw new WorkoutDomainError('Workout not found.');

			const [existingExercise] = await tx
				.select({ id: exercise.id })
				.from(exercise)
				.where(and(eq(exercise.id, data.exerciseId), exerciseVisibleToAthlete(userId)))
				.limit(1);
			if (!existingExercise) throw new WorkoutDomainError('Exercise not found.');

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
			const names = exerciseNames(data.name);
			const [ownedWorkout] = await tx
				.select({ id: workout.id, finishedAt: workout.finishedAt })
				.from(workout)
				.where(and(eq(workout.id, data.workoutId), eq(workout.userId, userId)))
				.limit(1)
				.for('update');

			if (!ownedWorkout || !prescriptionIsEditable(ownedWorkout.finishedAt)) {
				throw new WorkoutDomainError('Workout not found.');
			}

			const [createdExercise] = await tx
				.insert(exercise)
				.values({
					ownerId: userId,
					name: names.displayName,
					normalizedName: names.normalizedName,
					muscleGroup: data.muscleGroup || null,
					description: data.description || null
				})
				.onConflictDoNothing()
				.returning({ id: exercise.id });

			if (!createdExercise) {
				throw new ExerciseNameConflictError();
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
			if (!ownedWorkoutExercise || !prescriptionIsEditable(ownedWorkoutExercise.finishedAt))
				throw new WorkoutDomainError('Exercise entry not found.');

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

			if (!ownedSet || !prescriptionIsEditable(ownedSet.finishedAt))
				throw new WorkoutDomainError('Set not found.');

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

			if (!ownedSet || !prescriptionIsEditable(ownedSet.finishedAt))
				throw new WorkoutDomainError('Set not found.');
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

			if (!ownedEntry || !prescriptionIsEditable(ownedEntry.finishedAt))
				throw new WorkoutDomainError('Exercise entry not found.');
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
