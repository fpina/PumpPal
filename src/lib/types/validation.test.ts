import { assert, describe, it } from 'vitest';
import { loginSchema, registerSchema } from './register.validation';
import {
	addSetSchema,
	createWorkoutSchema,
	setMutationSchema,
	updateSetSchema,
	updateWorkoutSchema,
	workoutExerciseMutationSchema
} from './workout.validation';

describe('authentication validation', () => {
	it('accepts a valid registration', () => {
		const result = registerSchema.safeParse({
			name: 'Ada',
			email: 'ada@example.com',
			password: 'correct horse battery staple',
			confirmPassword: 'correct horse battery staple'
		});

		assert.isTrue(result.success);
	});

	it('rejects mismatched passwords and invalid login email', () => {
		const registration = registerSchema.safeParse({
			name: 'Ada',
			email: 'ada@example.com',
			password: 'password one',
			confirmPassword: 'password two'
		});
		const login = loginSchema.safeParse({ email: 'not-an-email', password: 'secret' });

		assert.isFalse(registration.success);
		assert.isFalse(login.success);
	});
});

describe('workout validation', () => {
	it('accepts form-shaped workout and set values', () => {
		const workout = createWorkoutSchema.safeParse({
			name: 'Push day',
			date: '2026-07-11',
			notes: ''
		});
		const workoutSet = addSetSchema.safeParse({
			workoutExerciseId: '2',
			setNumber: '1',
			reps: '8',
			weight: '72.5',
			weightUnit: 'kg',
			restTimeSeconds: '',
			completed: 'on'
		});

		assert.isTrue(workout.success);
		assert.isTrue(workoutSet.success);
		if (workoutSet.success) {
			assert.strictEqual(workoutSet.data.weight, 72.5);
			assert.isUndefined(workoutSet.data.restTimeSeconds);
			assert.isTrue(workoutSet.data.completed);
		}
	});

	it('validates edit and delete mutation identifiers', () => {
		const workout = updateWorkoutSchema.safeParse({
			workoutId: '12',
			name: 'Updated pull day',
			date: '2026-07-12',
			notes: 'Felt strong'
		});
		const workoutSet = updateSetSchema.safeParse({
			setId: '8',
			workoutExerciseId: '5',
			setNumber: '2',
			reps: '10',
			weight: '',
			weightUnit: 'lb',
			restTimeSeconds: '90',
			completed: ''
		});

		assert.isTrue(workout.success);
		assert.isTrue(workoutSet.success);
		assert.isTrue(setMutationSchema.safeParse({ setId: '3' }).success);
		assert.isTrue(workoutExerciseMutationSchema.safeParse({ workoutExerciseId: '4' }).success);
		assert.isFalse(setMutationSchema.safeParse({ setId: '0' }).success);
		assert.isFalse(workoutExerciseMutationSchema.safeParse({ workoutExerciseId: '-1' }).success);
	});

	it('rejects invalid workout edits and set values', () => {
		assert.isFalse(
			updateWorkoutSchema.safeParse({
				workoutId: '1',
				name: 'Impossible date',
				date: '2026-02-31',
				notes: ''
			}).success
		);
		assert.isFalse(
			updateSetSchema.safeParse({
				setId: '1',
				workoutExerciseId: '2',
				setNumber: '0',
				reps: '-1',
				weight: '-20',
				weightUnit: 'stone',
				restTimeSeconds: '-5',
				completed: 'on'
			}).success
		);
	});
});
