<script lang="ts">
	import { enhance } from '$app/forms';

	let { form } = $props();

	const now = new Date();
	const localToday = new Date(now.getTime() - now.getTimezoneOffset() * 60_000)
		.toISOString()
		.slice(0, 10);
</script>

<section class="mx-auto max-w-2xl">
	<a href="/" class="text-sm font-semibold text-indigo-700 hover:underline">← Back to workouts</a>
	<div class="mt-4 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm sm:p-8">
		<p class="text-sm font-semibold uppercase tracking-wider text-indigo-600">New entry</p>
		<h1 class="mt-1 text-3xl font-bold tracking-tight text-slate-900">Log a workout</h1>
		<p class="mt-2 text-slate-600">Create the session first, then record its exercises and sets.</p>

		{#if form?.message}<p class="mt-5 rounded-lg bg-red-50 p-3 text-sm text-red-700">
				{form.message}
			</p>{/if}

		<form method="POST" action="?/create" use:enhance class="mt-6 space-y-5">
			<div>
				<label for="date" class="block text-sm font-medium text-slate-700">Date</label>
				<input
					type="date"
					id="date"
					name="date"
					value={form?.values?.date ?? localToday}
					required
					class="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-200"
				/>
				{#if form?.errors?.date}<p class="mt-1 text-sm text-red-600">{form.errors.date[0]}</p>{/if}
			</div>

			<div>
				<label for="name" class="block text-sm font-medium text-slate-700"
					>Workout name <span class="font-normal text-slate-400">optional</span></label
				>
				<input
					type="text"
					id="name"
					name="name"
					value={form?.values?.name ?? ''}
					maxlength="255"
					placeholder="Push day, morning run…"
					class="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-200"
				/>
				{#if form?.errors?.name}<p class="mt-1 text-sm text-red-600">{form.errors.name[0]}</p>{/if}
			</div>

			<div>
				<label for="notes" class="block text-sm font-medium text-slate-700"
					>Notes <span class="font-normal text-slate-400">optional</span></label
				>
				<textarea
					id="notes"
					name="notes"
					rows="4"
					maxlength="2000"
					placeholder="How did the session feel?"
					class="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-200"
					>{form?.values?.notes ?? ''}</textarea
				>
				{#if form?.errors?.notes}<p class="mt-1 text-sm text-red-600">
						{form.errors.notes[0]}
					</p>{/if}
			</div>

			<button
				type="submit"
				class="w-full rounded-lg bg-indigo-600 px-4 py-2.5 font-semibold text-white hover:bg-indigo-700"
			>
				Save and add exercises
			</button>
		</form>
	</div>
</section>
