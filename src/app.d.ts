import type { auth } from '$lib/auth';

declare global {
	namespace App {
		interface Locals {
			session: typeof auth.$Infer.Session.session | null;
			user: typeof auth.$Infer.Session.user | null;
		}
	}
}

export {};
