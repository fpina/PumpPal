import {
	pgTable,
	serial,
	text,
	integer,
	numeric,
	timestamp,
	boolean,
	varchar,
	uniqueIndex
} from 'drizzle-orm/pg-core';
import { relations } from 'drizzle-orm';

// --- Users ---
export const user = pgTable('user', {
	id: text('id').primaryKey(),
	name: text('name').notNull(),
	email: text('email').notNull().unique(),
	emailVerified: boolean('email_verified').notNull(),
	image: text('image'),
	createdAt: timestamp('created_at').notNull(),
	updatedAt: timestamp('updated_at').notNull()
});

export const usersRelations = relations(user, ({ many }) => ({
	workouts: many(workout)
}));

export type User = typeof user.$inferSelect;

// --- Sessions ---
export const session = pgTable('session', {
	id: text('id').primaryKey(),
	expiresAt: timestamp('expires_at').notNull(),
	token: text('token').notNull().unique(),
	createdAt: timestamp('created_at').notNull(),
	updatedAt: timestamp('updated_at').notNull(),
	ipAddress: text('ip_address'),
	userAgent: text('user_agent'),
	userId: text('user_id')
		.notNull()
		.references(() => user.id, { onDelete: 'cascade' })
});

// --- Accounts ---
export const account = pgTable('account', {
	id: text('id').primaryKey(),
	accountId: text('account_id').notNull(),
	providerId: text('provider_id').notNull(),
	userId: text('user_id')
		.notNull()
		.references(() => user.id, { onDelete: 'cascade' }),
	accessToken: text('access_token'),
	refreshToken: text('refresh_token'),
	idToken: text('id_token'),
	accessTokenExpiresAt: timestamp('access_token_expires_at'),
	refreshTokenExpiresAt: timestamp('refresh_token_expires_at'),
	scope: text('scope'),
	password: text('password'),
	createdAt: timestamp('created_at').notNull(),
	updatedAt: timestamp('updated_at').notNull()
});

// --- Verifications ---
export const verification = pgTable('verification', {
	id: text('id').primaryKey(),
	identifier: text('identifier').notNull(),
	value: text('value').notNull(),
	expiresAt: timestamp('expires_at').notNull(),
	createdAt: timestamp('created_at'),
	updatedAt: timestamp('updated_at')
});

// --- Exercises ---
// Master list of all possible exercises
export const exercise = pgTable('exercise', {
	id: serial('id').primaryKey(),
	name: varchar('name', { length: 255 }).notNull().unique(),
	description: text('description'),
	muscleGroup: varchar('muscle_group', { length: 100 }), // e.g., 'Chest', 'Legs', 'Back'
	createdAt: timestamp('created_at').defaultNow().notNull()
});

export const exercisesRelations = relations(exercise, ({ many }) => ({
	workoutExercises: many(workoutExercise)
}));

export type Exercise = typeof exercise.$inferSelect;
// --- Workouts ---
// Represents a single workout session for a user
export const workout = pgTable(
	'workout',
	{
		id: serial('id').primaryKey(),
		userId: text('user_id')
			.notNull()
			.references(() => user.id, { onDelete: 'cascade' }), // Link to the user
		name: varchar('name', { length: 255 }), // Optional name like "Monday Chest Day"
		date: timestamp('date').notNull(), // When the workout occurred
		notes: text('notes'), // General notes for the workout session
		repeatToken: text('repeat_token'),
		createdAt: timestamp('created_at').defaultNow().notNull()
	},
	(table) => [uniqueIndex('workout_repeat_token_unique').on(table.repeatToken)]
);

export const workoutsRelations = relations(workout, ({ one, many }) => ({
	user: one(user, {
		fields: [workout.userId],
		references: [user.id]
	}),
	workoutExercises: many(workoutExercise)
}));

export type Workout = typeof workout.$inferSelect;

// --- Workout Exercises ---
// Junction table: Links specific exercises performed within a workout session
export const workoutExercise = pgTable('workout_exercise', {
	id: serial('id').primaryKey(),
	workoutId: integer('workout_id')
		.notNull()
		.references(() => workout.id, { onDelete: 'cascade' }),
	exerciseId: integer('exercise_id')
		.notNull()
		.references(() => exercise.id, { onDelete: 'restrict' }), // Prevent deleting an exercise if it's used in logs
	order: integer('order'), // Optional: sequence of the exercise in the workout
	notes: text('notes') // Specific notes for this exercise in this workout
});

export const workoutExercisesRelations = relations(workoutExercise, ({ one, many }) => ({
	workout: one(workout, {
		fields: [workoutExercise.workoutId],
		references: [workout.id]
	}),
	exercise: one(exercise, {
		fields: [workoutExercise.exerciseId],
		references: [exercise.id]
	}),
	sets: many(set)
}));

export type WorkoutExercise = typeof workoutExercise.$inferSelect;
// --- Sets ---
// Represents a single set performed for a specific exercise within a workout
export const set = pgTable('set', {
	id: serial('id').primaryKey(),
	workoutExerciseId: integer('workout_exercise_id')
		.notNull()
		.references(() => workoutExercise.id, { onDelete: 'cascade' }),
	setNumber: integer('set_number').notNull(), // e.g., 1, 2, 3
	reps: integer('reps').notNull(),
	weight: numeric('weight', { precision: 8, scale: 2, mode: 'number' }),
	weightUnit: varchar('weight_unit', { length: 10 }).default('kg'), // e.g., 'kg', 'lbs'
	restTimeSeconds: integer('rest_time_seconds'), // Optional rest time after the set
	completed: boolean('completed').default(true).notNull(), // Mark if the set was actually done
	createdAt: timestamp('created_at').defaultNow().notNull()
});

export const setsRelations = relations(set, ({ one }) => ({
	workoutExercise: one(workoutExercise, {
		fields: [set.workoutExerciseId],
		references: [workoutExercise.id]
	})
}));

export type Set = typeof set.$inferSelect;
