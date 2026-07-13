import { describe, expect, it } from 'vitest';
import { formatWorkoutDate, workoutDateFromInstant } from './workout-date';

describe('Workout Date', () => {
	it('derives the Athlete calendar day at extreme UTC offsets', () => {
		const instant = new Date('2026-01-01T10:30:00.000Z');
		expect(workoutDateFromInstant(instant, 'Pacific/Kiritimati')).toBe('2026-01-02');
		expect(workoutDateFromInstant(instant, 'Pacific/Honolulu')).toBe('2026-01-01');
	});

	it('keeps the calendar day stable across a daylight-saving transition', () => {
		expect(
			workoutDateFromInstant(new Date('2026-03-08T09:30:00.000Z'), 'America/Los_Angeles')
		).toBe('2026-03-08');
		expect(
			workoutDateFromInstant(new Date('2026-03-08T10:30:00.000Z'), 'America/Los_Angeles')
		).toBe('2026-03-08');
	});

	it('formats the stored day without applying the viewer timezone', () => {
		expect(formatWorkoutDate('2026-03-08', 'en-US')).toBe('Mar 8, 2026');
	});
});
