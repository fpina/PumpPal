import { z } from 'zod';

export const loginSchema = z.object({
	email: z.string().trim().email({ message: 'Enter a valid email address.' }),
	password: z.string().min(1, { message: 'Password is required.' })
});

export const registerSchema = z
	.object({
		name: z.string().trim().min(2, { message: 'Name must be at least 2 characters.' }),
		email: z.string().trim().email({ message: 'Enter a valid email address.' }),
		password: z
			.string()
			.min(8, { message: 'Password must be at least 8 characters.' })
			.max(128, { message: 'Password must be 128 characters or fewer.' }),
		confirmPassword: z.string()
	})
	.refine((data) => data.password === data.confirmPassword, {
		message: "Passwords don't match.",
		path: ['confirmPassword']
	});

export type RegisterSchema = typeof registerSchema;
