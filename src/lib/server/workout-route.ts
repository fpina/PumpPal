import { redirect } from '@sveltejs/kit';

export function requireAthleteId(locals: App.Locals) {
	if (!locals.user) throw redirect(302, '/auth');
	return locals.user.id;
}

export function positiveRouteId(value: string) {
	const id = Number(value);
	return Number.isInteger(id) && id > 0 ? id : null;
}
