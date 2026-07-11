<script lang="ts">
	let { data } = $props();

	const dateFormatter = new Intl.DateTimeFormat(undefined, {
		year: 'numeric',
		month: 'short',
		day: 'numeric'
	});
</script>

<div class="flex flex-col gap-6">
	<section class="flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
		<div>
			<p class="text-sm font-semibold uppercase tracking-wider text-indigo-600">Training log</p>
			<h1 class="mt-1 text-3xl font-bold tracking-tight text-slate-900">My workouts</h1>
			<p class="mt-2 text-slate-600">A clear record of the work you put in.</p>
		</div>
		<a
			href="/workouts/new"
			class="inline-flex justify-center rounded-lg bg-indigo-600 px-4 py-2.5 font-semibold text-white hover:bg-indigo-700"
		>
			Log new workout
		</a>
	</section>

	{#if data.workouts.length > 0}
		<ul class="grid gap-4 sm:grid-cols-2">
			{#each data.workouts as workout (workout.id)}
				<li>
					<a
						href={`/workouts/${workout.id}`}
						class="block h-full rounded-xl border border-slate-200 bg-white p-5 shadow-sm transition hover:-translate-y-0.5 hover:border-indigo-300 hover:shadow-md"
					>
						<p class="text-sm font-medium text-indigo-600">
							{dateFormatter.format(new Date(workout.date))}
						</p>
						<h2 class="mt-1 text-lg font-bold text-slate-900">
							{workout.name || 'Untitled workout'}
						</h2>
						{#if workout.notes}<p class="mt-2 line-clamp-2 text-sm text-slate-600">
								{workout.notes}
							</p>{/if}
					</a>
				</li>
			{/each}
		</ul>
	{:else}
		<section
			class="rounded-2xl border border-dashed border-slate-300 bg-white px-6 py-12 text-center"
		>
			<h2 class="text-xl font-bold text-slate-900">Your log is ready</h2>
			<p class="mx-auto mt-2 max-w-md text-slate-600">
				Create your first workout, then add exercises and completed sets.
			</p>
			<a
				href="/workouts/new"
				class="mt-5 inline-flex rounded-lg bg-indigo-600 px-4 py-2.5 font-semibold text-white hover:bg-indigo-700"
				>Start a workout</a
			>
		</section>
	{/if}
</div>
