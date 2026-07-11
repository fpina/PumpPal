import { assert, describe, it } from 'vitest';
import { loginSchema, registerSchema } from './register.validation';
import { addSetSchema, createWorkoutSchema } from './workout.validation';

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
});
