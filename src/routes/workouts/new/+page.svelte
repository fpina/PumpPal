<script lang="ts">
	import { enhance } from '$app/forms';
	import { resolve } from '$app/paths';
	import { currentWorkoutDate } from '$lib/workout-date';
	import { onMount } from 'svelte';

	let { form } = $props();
	let localToday = $state('');

	onMount(() => {
		localToday = currentWorkoutDate();
	});
</script>

<section class="mx-auto max-w-5xl">
	<a href={resolve('/')} class="back-link">← Back to workouts</a>
	<div class="mt-5 grid gap-5 lg:grid-cols-[1fr_0.48fr]">
		<div class="surface p-6 sm:p-9">
			<p class="eyebrow">New session</p>
			<h1 class="page-title mt-5">Log the work.</h1>
			<p class="mt-4 max-w-xl text-sm leading-6 text-[#8da097]">
				Name the session, set the date, and capture the context. You’ll add exercises and sets on
				the next screen.
			</p>

			{#if form?.message}<p class="status-message mt-5">{form.message}</p>{/if}

			<form method="POST" action="?/create" use:enhance class="mt-7 space-y-5">
				<div>
					<label for="date" class="field-label">Workout Date</label><input
						type="date"
						id="date"
						name="date"
						value={form?.values?.date ?? localToday}
						required
						class="field-control"
					/>{#if form?.errors?.date}<p class="field-error">{form.errors.date[0]}</p>{/if}
				</div>
				<div>
					<label for="name" class="field-label"
						>Workout name <span class="normal-case tracking-normal text-[#61756b]">— optional</span
						></label
					><input
						type="text"
						id="name"
						name="name"
						value={form?.values?.name ?? ''}
						maxlength="255"
						placeholder="Push day, heavy legs, morning run…"
						class="field-control"
					/>{#if form?.errors?.name}<p class="field-error">{form.errors.name[0]}</p>{/if}
				</div>
				<div>
					<label for="notes" class="field-label"
						>Session notes <span class="normal-case tracking-normal text-[#61756b]">— optional</span
						></label
					><textarea
						id="notes"
						name="notes"
						rows="5"
						maxlength="2000"
						placeholder="Goals, energy level, focus for today…"
						class="field-control resize-y">{form?.values?.notes ?? ''}</textarea
					>{#if form?.errors?.notes}<p class="field-error">{form.errors.notes[0]}</p>{/if}
				</div>
				<button type="submit" class="button-primary w-full sm:w-auto"
					>Save & build workout <span aria-hidden="true">→</span></button
				>
			</form>
		</div>

		<aside class="space-y-5">
			<div class="sport-stripe surface p-6">
				<span class="grid size-11 place-items-center rounded-xl bg-[#c8ff3d]/10 text-[#c8ff3d]"
					><svg
						viewBox="0 0 24 24"
						class="size-6"
						fill="none"
						stroke="currentColor"
						stroke-width="2"
						aria-hidden="true"><path d="M13 2L4.5 13h6L9 22l8.5-12h-6L13 2z" /></svg
					></span
				>
				<h2 class="mt-5 text-xl font-black">Make it specific.</h2>
				<p class="mt-2 text-sm leading-6 text-[#82958c]">
					Clear session names make your history easier to scan and your routines easier to repeat.
				</p>
			</div>
			<div class="surface-soft p-5">
				<p class="text-[0.65rem] font-extrabold uppercase tracking-[0.16em] text-[#3ee8cf]">
					Today’s cue
				</p>
				<p class="mt-2 text-sm font-semibold leading-6 text-[#b5c3bc]">
					Quality reps. Full range. Leave the ego outside.
				</p>
			</div>
		</aside>
	</div>
</section>
