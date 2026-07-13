function dateParts(date: Date, timeZone: string) {
	const parts = new Intl.DateTimeFormat('en-US', {
		timeZone,
		year: 'numeric',
		month: '2-digit',
		day: '2-digit'
	}).formatToParts(date);
	const part = (type: Intl.DateTimeFormatPartTypes) =>
		parts.find((entry) => entry.type === type)?.value;
	return { year: part('year'), month: part('month'), day: part('day') };
}

export function workoutDateFromInstant(instant: Date, timeZone: string) {
	const { year, month, day } = dateParts(instant, timeZone);
	if (!year || !month || !day) throw new Error('Could not derive Workout Date.');
	return `${year}-${month}-${day}`;
}

export function currentWorkoutDate() {
	return workoutDateFromInstant(new Date(), Intl.DateTimeFormat().resolvedOptions().timeZone);
}

export function formatWorkoutDate(
	workoutDate: string,
	locale?: string | string[],
	monthStyle: 'short' | 'long' = 'short'
) {
	const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(workoutDate);
	if (!match) throw new Error('Invalid Workout Date.');
	const [, year, month, day] = match;
	const date = new Date(Date.UTC(Number(year), Number(month) - 1, Number(day)));
	return new Intl.DateTimeFormat(locale, {
		timeZone: 'UTC',
		year: 'numeric',
		month: monthStyle,
		day: 'numeric'
	}).format(date);
}
