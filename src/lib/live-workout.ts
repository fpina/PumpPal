export function elapsedSeconds(startedAt: Date | string | null, now = Date.now()) {
	if (!startedAt) return 0;
	return Math.max(0, Math.floor((now - new Date(startedAt).getTime()) / 1000));
}

export function activeDurationSeconds(
	accumulatedSeconds: number | null,
	activeStartedAt: Date | string | null,
	now = Date.now()
) {
	return Math.max(0, accumulatedSeconds ?? 0) + elapsedSeconds(activeStartedAt, now);
}

export function remainingRestSeconds(restEndsAt: Date | string | null, now = Date.now()) {
	if (!restEndsAt) return 0;
	return Math.max(0, Math.ceil((new Date(restEndsAt).getTime() - now) / 1000));
}

export function formatDuration(totalSeconds: number) {
	const safeSeconds = Math.max(0, Math.floor(totalSeconds));
	const hours = Math.floor(safeSeconds / 3600);
	const minutes = Math.floor((safeSeconds % 3600) / 60);
	const seconds = safeSeconds % 60;
	return hours > 0
		? `${hours}:${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`
		: `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
}
