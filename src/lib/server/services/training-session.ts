import { db } from '$lib/server/db';
import {
	set,
	trainingSegment,
	workout,
	workoutExercise,
	type WorkoutSessionStatus,
	type WorkoutSetStatus
} from '$lib/server/db/schema';
import { and, desc, eq, inArray, isNull } from 'drizzle-orm';

export interface TrainingSessionCapabilities {
	canStart: boolean;
	canResume: boolean;
	canFinish: boolean;
	canReopen: boolean;
	canEditPrescription: boolean;
}

export interface SetTargetCapabilities {
	canActivate: boolean;
	canComplete: boolean;
	canSkip: boolean;
}

export interface RecordSetResultCommand {
	setTargetId: number;
	reps: number;
	weight?: number | null;
	weightUnit: 'kg' | 'lb';
}

export type TrainingSessionOutcome<T extends string> =
	| { ok: true; transition: T }
	| { ok: false; code: 'not_found' | 'invalid_transition' };

export function prescriptionIsEditable(finishedAt: Date | null) {
	return finishedAt === null;
}

export function editablePrescriptionCondition() {
	return isNull(workout.finishedAt);
}

export function capabilitiesFor(
	status: WorkoutSessionStatus,
	canEditPrescription: boolean
): TrainingSessionCapabilities {
	return {
		canStart: status === 'planned',
		canResume: status === 'active',
		canFinish: status === 'active',
		canReopen: status === 'finished',
		canEditPrescription
	};
}

export function setTargetCapabilitiesFor(
	sessionStatus: WorkoutSessionStatus,
	status: WorkoutSetStatus
): SetTargetCapabilities {
	const activeSession = sessionStatus === 'active';
	return {
		canActivate: activeSession && (status === 'planned' || status === 'skipped'),
		canComplete: activeSession && status === 'active',
		canSkip: activeSession && status !== 'completed' && status !== 'skipped'
	};
}

type Transaction = Parameters<Parameters<typeof db.transaction>[0]>[0];

async function lockTrainingSession(tx: Transaction, athleteId: string, workoutId: number) {
	const [session] = await tx
		.select()
		.from(workout)
		.where(and(eq(workout.id, workoutId), eq(workout.userId, athleteId)))
		.limit(1)
		.for('update');
	return session ?? null;
}

export const trainingSession = {
	async get(athleteId: string, workoutId: number) {
		const session =
			(await db.query.workout.findFirst({
				where: and(eq(workout.id, workoutId), eq(workout.userId, athleteId)),
				with: {
					trainingSegments: {
						orderBy: (segments, { asc }) => [asc(segments.startedAt), asc(segments.id)]
					},
					workoutExercises: {
						with: {
							exercise: true,
							sets: { orderBy: (targets, { asc }) => [asc(targets.setNumber)] }
						},
						orderBy: (entries, { asc }) => [asc(entries.order)]
					}
				}
			})) ?? null;
		return session
			? {
					...session,
					capabilities: capabilitiesFor(
						session.sessionStatus,
						prescriptionIsEditable(session.finishedAt)
					),
					workoutExercises: session.workoutExercises.map((entry) => ({
						...entry,
						sets: entry.sets.map((target) => ({
							...target,
							capabilities: setTargetCapabilitiesFor(session.sessionStatus, target.status)
						}))
					}))
				}
			: null;
	},

	async start(
		athleteId: string,
		workoutId: number
	): Promise<TrainingSessionOutcome<'started' | 'resumed'>> {
		return db.transaction(async (tx) => {
			const session = await lockTrainingSession(tx, athleteId, workoutId);
			if (!session) return { ok: false, code: 'not_found' };
			if (session.sessionStatus === 'active') return { ok: true, transition: 'resumed' };
			if (session.sessionStatus !== 'planned') {
				return { ok: false, code: 'invalid_transition' };
			}

			const startedAt = new Date();
			await tx
				.update(workout)
				.set({
					sessionStatus: 'active',
					startedAt,
					activeStartedAt: startedAt,
					finishedAt: null,
					durationSeconds: 0,
					restEndsAt: null
				})
				.where(eq(workout.id, workoutId));
			await tx.insert(trainingSegment).values({ workoutId, startedAt });
			return { ok: true, transition: 'started' };
		});
	},

	async finish(athleteId: string, workoutId: number): Promise<TrainingSessionOutcome<'finished'>> {
		return db.transaction(async (tx) => {
			const session = await lockTrainingSession(tx, athleteId, workoutId);
			if (!session) return { ok: false, code: 'not_found' };
			if (session.sessionStatus !== 'active' || !session.activeStartedAt) {
				return { ok: false, code: 'invalid_transition' };
			}

			const finishedAt = new Date();
			const segmentDurationSeconds = Math.max(
				0,
				Math.floor((finishedAt.getTime() - session.activeStartedAt.getTime()) / 1000)
			);
			const [openSegment] = await tx
				.select({ id: trainingSegment.id })
				.from(trainingSegment)
				.where(and(eq(trainingSegment.workoutId, workoutId), isNull(trainingSegment.finishedAt)))
				.orderBy(desc(trainingSegment.startedAt), desc(trainingSegment.id))
				.limit(1)
				.for('update');
			if (!openSegment) throw new Error('Active Training Session has no open Training Segment.');

			await tx
				.update(trainingSegment)
				.set({ finishedAt, durationSeconds: segmentDurationSeconds })
				.where(eq(trainingSegment.id, openSegment.id));
			const activeTargets = await tx
				.select({ id: set.id })
				.from(set)
				.innerJoin(workoutExercise, eq(set.workoutExerciseId, workoutExercise.id))
				.where(and(eq(workoutExercise.workoutId, workoutId), eq(set.status, 'active')));
			if (activeTargets.length > 0) {
				await tx
					.update(set)
					.set({ status: 'planned' })
					.where(
						inArray(
							set.id,
							activeTargets.map(({ id }) => id)
						)
					);
			}
			await tx
				.update(workout)
				.set({
					sessionStatus: 'finished',
					finishedAt: session.finishedAt ?? finishedAt,
					activeStartedAt: null,
					durationSeconds: (session.durationSeconds ?? 0) + segmentDurationSeconds,
					restEndsAt: null
				})
				.where(eq(workout.id, workoutId));
			return { ok: true, transition: 'finished' };
		});
	},

	async reopen(athleteId: string, workoutId: number): Promise<TrainingSessionOutcome<'reopened'>> {
		return db.transaction(async (tx) => {
			const session = await lockTrainingSession(tx, athleteId, workoutId);
			if (!session) return { ok: false, code: 'not_found' };
			if (session.sessionStatus !== 'finished') {
				return { ok: false, code: 'invalid_transition' };
			}

			const activeStartedAt = new Date();
			await tx.insert(trainingSegment).values({ workoutId, startedAt: activeStartedAt });
			await tx
				.update(workout)
				.set({ sessionStatus: 'active', activeStartedAt, restEndsAt: null })
				.where(eq(workout.id, workoutId));
			return { ok: true, transition: 'reopened' };
		});
	},

	async activateSetTarget(
		athleteId: string,
		workoutId: number,
		setTargetId: number
	): Promise<TrainingSessionOutcome<'activated'>> {
		return db.transaction(async (tx) => {
			const session = await lockTrainingSession(tx, athleteId, workoutId);
			if (!session) return { ok: false, code: 'not_found' };
			if (session.sessionStatus !== 'active') return { ok: false, code: 'invalid_transition' };

			const [target] = await tx
				.select({ id: set.id, status: set.status })
				.from(set)
				.innerJoin(workoutExercise, eq(set.workoutExerciseId, workoutExercise.id))
				.where(and(eq(set.id, setTargetId), eq(workoutExercise.workoutId, workoutId)))
				.limit(1);
			if (!target) return { ok: false, code: 'not_found' };
			if (target.status === 'completed') return { ok: false, code: 'invalid_transition' };
			if (target.status === 'active') return { ok: true, transition: 'activated' };

			const activeTargets = await tx
				.select({ id: set.id })
				.from(set)
				.innerJoin(workoutExercise, eq(set.workoutExerciseId, workoutExercise.id))
				.where(and(eq(workoutExercise.workoutId, workoutId), eq(set.status, 'active')));
			if (activeTargets.length > 0) {
				await tx
					.update(set)
					.set({ status: 'planned' })
					.where(
						inArray(
							set.id,
							activeTargets.map(({ id }) => id)
						)
					);
			}
			await tx
				.update(set)
				.set({ status: 'active', completed: false, completedAt: null })
				.where(eq(set.id, setTargetId));
			return { ok: true, transition: 'activated' };
		});
	},

	async recordSetResult(
		athleteId: string,
		workoutId: number,
		command: RecordSetResultCommand
	): Promise<TrainingSessionOutcome<'completed'>> {
		return db.transaction(async (tx) => {
			const session = await lockTrainingSession(tx, athleteId, workoutId);
			if (!session) return { ok: false, code: 'not_found' };
			if (session.sessionStatus !== 'active') return { ok: false, code: 'invalid_transition' };

			const [target] = await tx
				.select({ id: set.id, status: set.status, restTimeSeconds: set.restTimeSeconds })
				.from(set)
				.innerJoin(workoutExercise, eq(set.workoutExerciseId, workoutExercise.id))
				.where(and(eq(set.id, command.setTargetId), eq(workoutExercise.workoutId, workoutId)))
				.limit(1);
			if (!target) return { ok: false, code: 'not_found' };
			if (target.status !== 'active') return { ok: false, code: 'invalid_transition' };

			const completedAt = new Date();
			await tx
				.update(set)
				.set({
					actualReps: command.reps,
					actualWeight: command.weight,
					actualWeightUnit: command.weightUnit,
					status: 'completed',
					completed: true,
					completedAt
				})
				.where(eq(set.id, command.setTargetId));
			await tx
				.update(workout)
				.set({
					restEndsAt: target.restTimeSeconds
						? new Date(completedAt.getTime() + target.restTimeSeconds * 1000)
						: null
				})
				.where(eq(workout.id, workoutId));
			return { ok: true, transition: 'completed' };
		});
	},

	async skipSetTarget(
		athleteId: string,
		workoutId: number,
		setTargetId: number
	): Promise<TrainingSessionOutcome<'skipped'>> {
		return db.transaction(async (tx) => {
			const session = await lockTrainingSession(tx, athleteId, workoutId);
			if (!session) return { ok: false, code: 'not_found' };
			if (session.sessionStatus !== 'active') return { ok: false, code: 'invalid_transition' };

			const [target] = await tx
				.select({ id: set.id, status: set.status })
				.from(set)
				.innerJoin(workoutExercise, eq(set.workoutExerciseId, workoutExercise.id))
				.where(and(eq(set.id, setTargetId), eq(workoutExercise.workoutId, workoutId)))
				.limit(1);
			if (!target) return { ok: false, code: 'not_found' };
			if (target.status === 'completed' || target.status === 'skipped') {
				return { ok: false, code: 'invalid_transition' };
			}

			await tx
				.update(set)
				.set({ status: 'skipped', completed: false, completedAt: null })
				.where(eq(set.id, target.id));
			return { ok: true, transition: 'skipped' };
		});
	},

	async dismissRest(
		athleteId: string,
		workoutId: number
	): Promise<TrainingSessionOutcome<'rest_dismissed'>> {
		return db.transaction(async (tx) => {
			const session = await lockTrainingSession(tx, athleteId, workoutId);
			if (!session) return { ok: false, code: 'not_found' };
			if (session.sessionStatus !== 'active') return { ok: false, code: 'invalid_transition' };

			await tx.update(workout).set({ restEndsAt: null }).where(eq(workout.id, workoutId));
			return { ok: true, transition: 'rest_dismissed' };
		});
	}
};
