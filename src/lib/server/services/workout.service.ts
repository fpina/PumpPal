import { db } from '$lib/server/db';
import { exercise, set, workout, workoutExercise } from '$lib/server/db/schema';
import type { CreateWorkoutSchemaType } from '$lib/types/workout.validation';
import { and, asc, desc, eq } from 'drizzle-orm';

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

	async addExerciseToWorkout(userId: string, data: AddExerciseToWorkoutInput) {
		const [ownedWorkout, existingExercise] = await Promise.all([
			db
				.select({ id: workout.id })
				.from(workout)
				.where(and(eq(workout.id, data.workoutId), eq(workout.userId, userId)))
				.limit(1),
			db.select({ id: exercise.id }).from(exercise).where(eq(exercise.id, data.exerciseId)).limit(1)
		]);

		if (!ownedWorkout[0]) {
			throw new Error('Workout not found.');
		}

		if (!existingExercise[0]) {
			throw new Error('Exercise not found.');
		}

		const [createdWorkoutExercise] = await db
			.insert(workoutExercise)
			.values({
				workoutId: data.workoutId,
				exerciseId: data.exerciseId,
				order: data.order,
				notes: data.notes
			})
			.returning();

		if (!createdWorkoutExercise) {
			throw new Error('Failed to add exercise.');
		}

		return createdWorkoutExercise;
	}

	async createExerciseForWorkout(userId: string, data: CreateExerciseForWorkoutInput) {
		return db.transaction(async (tx) => {
			const [ownedWorkout] = await tx
				.select({ id: workout.id })
				.from(workout)
				.where(and(eq(workout.id, data.workoutId), eq(workout.userId, userId)))
				.limit(1);

			if (!ownedWorkout) {
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
		const [ownedWorkoutExercise] = await db
			.select({ id: workoutExercise.id })
			.from(workoutExercise)
			.innerJoin(workout, eq(workoutExercise.workoutId, workout.id))
			.where(and(eq(workoutExercise.id, data.workoutExerciseId), eq(workout.userId, userId)))
			.limit(1);

		if (!ownedWorkoutExercise) {
			throw new Error('Exercise entry not found.');
		}

		const [createdSet] = await db
			.insert(set)
			.values({
				workoutExerciseId: data.workoutExerciseId,
				setNumber: data.setNumber,
				reps: data.reps,
				weight: data.weight,
				weightUnit: data.weightUnit || 'kg',
				restTimeSeconds: data.restTimeSeconds,
				completed: data.completed ?? true
			})
			.returning();

		if (!createdSet) {
			throw new Error('Failed to add set.');
		}

		return createdSet;
	}
}

export const workoutService = new WorkoutService();
