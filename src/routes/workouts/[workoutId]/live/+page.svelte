<script lang="ts">
	import { enhance } from '$app/forms';
	import { elapsedSeconds, formatDuration, remainingRestSeconds } from '$lib/live-workout';
	import { onMount } from 'svelte';

	let { data, form } = $props();
	let now = $state(Date.now());
	let restAnnouncement = $state('');
	let previousRest = $state(0);

	const elapsed = $derived(
		data.workout.sessionStatus === 'finished'
			? (data.workout.durationSeconds ?? 0)
			: elapsedSeconds(data.workout.startedAt, now)
	);
	const restRemaining = $derived(remainingRestSeconds(data.workout.restEndsAt, now));
	const completedCount = $derived(
		data.workout.workoutExercises.reduce(
			(total, entry) =>
				total + entry.sets.filter((entrySet) => entrySet.status === 'completed').length,
			0
		)
	);
	const totalSets = $derived(
		data.workout.workoutExercises.reduce((total, entry) => total + entry.sets.length, 0)
	);

	$effect(() => {
		if (previousRest > 0 && restRemaining === 0)
			restAnnouncement = 'Rest complete. Ready for your next set.';
		previousRest = restRemaining;
	});

	onMount(() => {
		const refresh = () => (now = Date.now());
		const interval = window.setInterval(refresh, 1000);
		document.addEventListener('visibilitychange', refresh);
		return () => {
			window.clearInterval(interval);
			document.removeEventListener('visibilitychange', refresh);
		};
	});

	function confirmFinish(event: SubmitEvent) {
		if (!window.confirm('Finish this workout? Editing will be locked until you reopen it.'))
			event.preventDefault();
	}
</script>

<svelte:head><title>Live training · {data.workout.name || 'Workout'}</title></svelte:head>

<div class="live-shell">
	<header class="live-header">
		<a href={`/workouts/${data.workout.id}`} class="back-link">← Workout details</a>
		<div class="live-heading">
			<div>
				<p class="eyebrow">Live training</p>
				<h1>{data.workout.name || 'Untitled workout'}</h1>
			</div>
			<div class="session-clock" aria-label={`Workout duration ${formatDuration(elapsed)}`}>
				<span>Session</span><strong>{formatDuration(elapsed)}</strong>
			</div>
		</div>
		<div class="progress-track" aria-label={`${completedCount} of ${totalSets} sets completed`}>
			<span style={`width: ${totalSets ? (completedCount / totalSets) * 100 : 0}%`}></span>
		</div>
		<p class="progress-label">{completedCount} / {totalSets} sets complete</p>
	</header>

	<p class="sr-only" aria-live="assertive">{restAnnouncement}</p>
	{#if data.workout.restEndsAt}
		<aside class:rest-done={restRemaining === 0} class="rest-card" aria-live="polite">
			<div>
				<span>{restRemaining > 0 ? 'Rest timer' : 'Rest complete'}</span><strong
					>{formatDuration(restRemaining)}</strong
				>
			</div>
			<form method="POST" action="?/dismissRest" use:enhance>
				<button type="submit" class="button-ghost">Dismiss</button>
			</form>
		</aside>
	{/if}

	{#if form?.message}<p class="status-message">{form.message}</p>{/if}

	{#if data.workout.sessionStatus === 'planned'}
		<section class="start-card surface sport-stripe">
			<p class="eyebrow">Ready when you are</p>
			<h2>Start strong.</h2>
			<p>Your targets are set. Starting records the session time and unlocks set tracking.</p>
			<form method="POST" action="?/start" use:enhance>
				<input type="hidden" name="workoutId" value={data.workout.id} />
				<button type="submit" class="button-primary">Start workout</button>
			</form>
		</section>
	{:else if data.workout.sessionStatus === 'finished'}
		<section class="start-card surface">
			<p class="eyebrow">Workout finished</p>
			<h2>Session locked.</h2>
			<p>
				Finished in {formatDuration(data.workout.durationSeconds ?? 0)} with {completedCount} completed
				sets.
			</p>
			<form method="POST" action="?/reopen" use:enhance>
				<input type="hidden" name="workoutId" value={data.workout.id} />
				<button type="submit" class="button-secondary">Reopen workout</button>
			</form>
		</section>
	{:else}
		<main class="exercise-stack">
			{#each data.workout.workoutExercises as workoutExercise, exerciseIndex (workoutExercise.id)}
				<section class="live-exercise surface">
					<header>
						<span>{String(exerciseIndex + 1).padStart(2, '0')}</span>
						<div>
							<p>{workoutExercise.exercise.muscleGroup || 'Exercise'}</p>
							<h2>{workoutExercise.exercise.name}</h2>
						</div>
					</header>
					<div class="set-stack">
						{#each workoutExercise.sets as exerciseSet (exerciseSet.id)}
							<article class={`live-set status-${exerciseSet.status}`}>
								<div class="set-summary">
									<span class="set-number">{exerciseSet.setNumber}</span>
									<div>
										<strong>{exerciseSet.reps} reps</strong><small
											>{exerciseSet.weight !== null
												? `${exerciseSet.weight} ${exerciseSet.weightUnit}`
												: 'Bodyweight'} · {exerciseSet.restTimeSeconds ?? 0}s rest</small
										>
									</div>
									<span class="status-pill">{exerciseSet.status}</span>
								</div>
								{#if exerciseSet.status === 'active'}
									<form method="POST" action="?/completeSet" use:enhance class="actual-form">
										<input type="hidden" name="setId" value={exerciseSet.id} />
										<label
											>Actual reps<input
												name="reps"
												type="number"
												min="0"
												value={exerciseSet.reps}
												required
											/></label
										>
										<label
											>Actual load<input
												name="weight"
												type="number"
												min="0"
												step="0.01"
												value={exerciseSet.weight ?? ''}
											/></label
										>
										<label
											>Unit<select name="weightUnit"
												><option value="kg" selected={exerciseSet.weightUnit === 'kg'}>kg</option
												><option value="lb" selected={exerciseSet.weightUnit === 'lb'}>lb</option
												></select
											></label
										>
										<button type="submit" class="button-primary">Complete set</button>
									</form>
								{:else if exerciseSet.status !== 'completed'}
									<div class="set-actions">
										<form method="POST" action="?/activateSet" use:enhance>
											<input type="hidden" name="setId" value={exerciseSet.id} /><button
												type="submit"
												class="button-primary"
												>{exerciseSet.status === 'skipped'
													? 'Restore & start'
													: 'Start set'}</button
											>
										</form>
										<form method="POST" action="?/skipSet" use:enhance>
											<input type="hidden" name="setId" value={exerciseSet.id} /><button
												type="submit"
												class="button-ghost">Skip</button
											>
										</form>
									</div>
								{/if}
							</article>
						{/each}
					</div>
				</section>
			{/each}
		</main>
		<form method="POST" action="?/finish" use:enhance onsubmit={confirmFinish} class="finish-bar">
			<input type="hidden" name="workoutId" value={data.workout.id} />
			<button type="submit">Finish workout</button>
		</form>
	{/if}
</div>

<style>
	.live-shell {
		max-width: 760px;
		margin: 0 auto;
		padding-bottom: 7rem;
	}
	.live-header {
		position: relative;
		margin-bottom: 1.25rem;
	}
	.live-heading {
		display: flex;
		align-items: end;
		justify-content: space-between;
		gap: 1rem;
		margin-top: 1.4rem;
	}
	.live-heading h1 {
		margin: 0.35rem 0 0;
		font-size: clamp(2rem, 8vw, 3.7rem);
		font-weight: 950;
		line-height: 0.95;
		letter-spacing: -0.045em;
		text-transform: uppercase;
	}
	.session-clock {
		text-align: right;
	}
	.session-clock span,
	.progress-label {
		color: #788c82;
		font-size: 0.65rem;
		font-weight: 850;
		letter-spacing: 0.12em;
		text-transform: uppercase;
	}
	.session-clock strong {
		display: block;
		color: #3ee8cf;
		font-size: 1.45rem;
		font-variant-numeric: tabular-nums;
	}
	.progress-track {
		height: 6px;
		margin-top: 1.25rem;
		overflow: hidden;
		border-radius: 99px;
		background: rgba(255, 255, 255, 0.07);
	}
	.progress-track span {
		display: block;
		height: 100%;
		border-radius: inherit;
		background: linear-gradient(90deg, #c8ff3d, #3ee8cf);
		transition: width 0.3s;
	}
	.progress-label {
		margin: 0.5rem 0 0;
	}
	.rest-card {
		position: sticky;
		top: 0.75rem;
		z-index: 20;
		display: flex;
		align-items: center;
		justify-content: space-between;
		margin-bottom: 1rem;
		border: 1px solid rgba(62, 232, 207, 0.3);
		border-radius: 1rem;
		background: rgba(9, 31, 25, 0.95);
		padding: 0.8rem 1rem;
		box-shadow: 0 16px 50px rgba(0, 0, 0, 0.4);
		backdrop-filter: blur(16px);
	}
	.rest-card div {
		display: flex;
		align-items: baseline;
		gap: 0.8rem;
	}
	.rest-card span {
		color: #3ee8cf;
		font-size: 0.7rem;
		font-weight: 900;
		letter-spacing: 0.12em;
		text-transform: uppercase;
	}
	.rest-card strong {
		font-size: 1.5rem;
		font-variant-numeric: tabular-nums;
	}
	.rest-card.rest-done {
		border-color: #c8ff3d;
		background: rgba(41, 58, 18, 0.96);
		animation: pulse 1.2s ease-in-out 2;
	}
	.start-card {
		padding: 2rem;
	}
	.start-card h2 {
		margin: 0.6rem 0;
		font-size: 2.5rem;
		font-weight: 950;
		text-transform: uppercase;
	}
	.start-card p:not(.eyebrow) {
		max-width: 32rem;
		color: #91a39a;
	}
	.start-card form {
		margin-top: 1.5rem;
	}
	.exercise-stack {
		display: grid;
		gap: 1rem;
	}
	.live-exercise {
		overflow: hidden;
	}
	.live-exercise > header {
		display: flex;
		align-items: center;
		gap: 0.9rem;
		border-bottom: 1px solid rgba(255, 255, 255, 0.06);
		padding: 1rem;
	}
	.live-exercise > header > span {
		display: grid;
		width: 2.7rem;
		height: 2.7rem;
		place-items: center;
		border-radius: 0.75rem;
		background: rgba(200, 255, 61, 0.09);
		color: #c8ff3d;
		font-weight: 950;
	}
	.live-exercise header p {
		margin: 0;
		color: #3ee8cf;
		font-size: 0.62rem;
		font-weight: 850;
		letter-spacing: 0.12em;
		text-transform: uppercase;
	}
	.live-exercise h2 {
		margin: 0.15rem 0 0;
		font-size: 1.2rem;
	}
	.set-stack {
		display: grid;
		gap: 0.65rem;
		padding: 0.75rem;
	}
	.live-set {
		border: 1px solid rgba(255, 255, 255, 0.07);
		border-radius: 1rem;
		background: rgba(255, 255, 255, 0.025);
		padding: 0.8rem;
	}
	.set-summary {
		display: grid;
		grid-template-columns: auto 1fr auto;
		align-items: center;
		gap: 0.75rem;
	}
	.set-number {
		display: grid;
		width: 2.2rem;
		height: 2.2rem;
		place-items: center;
		border-radius: 50%;
		background: #18251f;
		font-weight: 950;
	}
	.set-summary strong,
	.set-summary small {
		display: block;
	}
	.set-summary small {
		margin-top: 0.15rem;
		color: #7f9288;
		font-size: 0.72rem;
	}
	.status-pill {
		border-radius: 99px;
		background: rgba(255, 255, 255, 0.06);
		padding: 0.35rem 0.55rem;
		color: #82948b;
		font-size: 0.58rem;
		font-weight: 900;
		letter-spacing: 0.1em;
		text-transform: uppercase;
	}
	.status-active {
		border-color: rgba(200, 255, 61, 0.45);
		background: rgba(200, 255, 61, 0.045);
	}
	.status-active .set-number {
		background: #c8ff3d;
		color: #07100c;
	}
	.status-completed {
		border-color: rgba(62, 232, 207, 0.17);
		opacity: 0.78;
	}
	.status-completed .status-pill {
		color: #3ee8cf;
	}
	.status-skipped {
		opacity: 0.55;
	}
	.actual-form {
		display: grid;
		grid-template-columns: 1fr 1fr 0.7fr;
		gap: 0.55rem;
		margin-top: 0.9rem;
	}
	.actual-form label {
		color: #9aaca3;
		font-size: 0.62rem;
		font-weight: 850;
		letter-spacing: 0.07em;
		text-transform: uppercase;
	}
	.actual-form input,
	.actual-form select {
		width: 100%;
		min-height: 2.8rem;
		margin-top: 0.35rem;
		border: 1px solid rgba(255, 255, 255, 0.1);
		border-radius: 0.7rem;
		background: #07100c;
		color: white;
		padding: 0.65rem;
	}
	.actual-form button {
		grid-column: 1/-1;
		min-height: 3.4rem;
	}
	.set-actions {
		display: grid;
		grid-template-columns: 1fr auto;
		gap: 0.5rem;
		margin-top: 0.8rem;
	}
	.set-actions form:first-child button {
		width: 100%;
	}
	.finish-bar {
		position: fixed;
		right: 0;
		bottom: 0;
		left: 0;
		z-index: 30;
		padding: 0.8rem max(1rem, calc((100vw - 760px) / 2));
		background: linear-gradient(0deg, #07100c 70%, transparent);
	}
	.finish-bar button {
		width: 100%;
		min-height: 3.4rem;
		border: 1px solid rgba(255, 122, 69, 0.35);
		border-radius: 0.9rem;
		background: #27150f;
		color: #ff9a70;
		font-weight: 900;
	}
	.sr-only {
		position: absolute;
		width: 1px;
		height: 1px;
		overflow: hidden;
		clip: rect(0, 0, 0, 0);
	}
	@keyframes pulse {
		50% {
			box-shadow: 0 0 0 8px rgba(200, 255, 61, 0.12);
		}
	}
	@media (max-width: 540px) {
		.live-heading {
			align-items: start;
		}
		.actual-form {
			grid-template-columns: 1fr 1fr;
		}
		.actual-form label:last-of-type {
			grid-column: 1/-1;
		}
		.set-actions button {
			min-height: 3.25rem;
		}
		.start-card {
			padding: 1.4rem;
		}
	}
</style>
