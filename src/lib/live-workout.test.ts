import { describe, expect, it } from 'vitest';
import { elapsedSeconds, formatDuration, remainingRestSeconds } from './live-workout';

describe('live workout timers', () => {
	it('derives elapsed time from the persisted start timestamp', () => {
		expect(elapsedSeconds('2026-07-13T10:00:00.000Z', Date.parse('2026-07-13T10:01:30.900Z'))).toBe(
			90
		);
	});

	it('keeps rest accurate after a delayed tick or backgrounded tab', () => {
		const deadline = '2026-07-13T10:02:00.000Z';
		expect(remainingRestSeconds(deadline, Date.parse('2026-07-13T10:00:29.500Z'))).toBe(91);
		expect(remainingRestSeconds(deadline, Date.parse('2026-07-13T10:02:05.000Z'))).toBe(0);
	});

	it('formats short and long durations', () => {
		expect(formatDuration(75)).toBe('01:15');
		expect(formatDuration(3675)).toBe('1:01:15');
	});
});
