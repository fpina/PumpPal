import { z } from 'zod';

function isValidCalendarDate(value: string) {
	const [year, month, day] = value.split('-').map(Number);
	const date = new Date(Date.UTC(year, month - 1, day));
	return (
		date.getUTCFullYear() === year && date.getUTCMonth() === month - 1 && date.getUTCDate() === day
	);
}

export const createWorkoutSchema = z.object({
	name: z.string().trim().max(255, 'Name must be 255 characters or fewer.').optional(),
	date: z
		.string()
		.regex(/^\d{4}-\d{2}-\d{2}$/, 'Enter a valid date.')
		.refine(isValidCalendarDate, 'Enter a valid date.'),
	notes: z.string().trim().max(2000, 'Notes must be 2,000 characters or fewer.').optional()
});

export const updateWorkoutSchema = createWorkoutSchema.extend({
	workoutId: z.coerce.number().int().positive('Workout is required.')
});

const optionalInteger = (minimum = 0) =>
	z.preprocess(
		(value) => (value === '' || value === null ? undefined : value),
		z.coerce.number().int().min(minimum).optional()
	);

const optionalNumber = (minimum = 0) =>
	z.preprocess(
		(value) => (value === '' || value === null ? undefined : value),
		z.coerce.number().min(minimum).optional()
	);

export const addExerciseSchema = z.object({
	exerciseId: z.coerce.number().int().positive('Choose an exercise.'),
	order: optionalInteger(),
	notes: z.string().trim().max(1000, 'Notes must be 1,000 characters or fewer.').optional()
});

export const createExerciseSchema = z.object({
	name: z.string().trim().min(2, 'Exercise name must be at least 2 characters.').max(255),
	muscleGroup: z.string().trim().max(100).optional(),
	order: optionalInteger()
});

export const addSetSchema = z.object({
	workoutExerciseId: z.coerce.number().int().positive('Exercise entry is required.'),
	setNumber: z.coerce.number().int().positive('Set number must be positive.'),
	reps: z.coerce.number().int().min(0, 'Reps cannot be negative.').max(10_000),
	weight: optionalNumber(),
	weightUnit: z.enum(['kg', 'lb']),
	restTimeSeconds: optionalInteger(),
	completed: z.preprocess((value) => value === 'on' || value === true, z.boolean())
});

export const updateSetSchema = addSetSchema.extend({
	setId: z.coerce.number().int().positive('Set is required.')
});

export const workoutExerciseMutationSchema = z.object({
	workoutExerciseId: z.coerce.number().int().positive('Exercise entry is required.')
});

export const setMutationSchema = z.object({
	setId: z.coerce.number().int().positive('Set is required.')
});

export const workoutMutationSchema = z.object({
	workoutId: z.coerce.number().int().positive('Workout is required.')
});

export type CreateWorkoutSchema = typeof createWorkoutSchema;
export type CreateWorkoutSchemaType = z.infer<CreateWorkoutSchema>;
