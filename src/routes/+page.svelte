<script lang="ts">
	import { resolve } from '$app/paths';
	import { formatWorkoutDate } from '$lib/workout-date';

	let { data } = $props();
</script>

<div class="space-y-10">
	<section class="sport-stripe surface relative px-6 py-8 sm:px-10 sm:py-11">
		<div class="relative z-10 flex flex-col justify-between gap-8 lg:flex-row lg:items-end">
			<div class="max-w-2xl">
				<p class="eyebrow">Performance log</p>
				<h1 class="display-title mt-5">
					Built by<br /><span class="text-[#c8ff3d]">the work.</span>
				</h1>
				<p class="mt-5 max-w-lg text-base leading-7 text-[#9bada4]">
					Every rep counts. Track your sessions, build momentum, and make your progress impossible
					to ignore.
				</p>
			</div>
			<div class="flex flex-wrap items-end gap-7">
				<div class="metric"><strong>{data.workouts.length}</strong><span>Total sessions</span></div>
				<a href={resolve('/workouts/new')} class="button-primary">
					<svg
						viewBox="0 0 24 24"
						class="size-4"
						fill="none"
						stroke="currentColor"
						stroke-width="2.5"
						aria-hidden="true"><path d="M12 5v14M5 12h14" /></svg
					>
					Log workout
				</a>
			</div>
		</div>
	</section>

	<section>
		<div class="mb-5 flex items-end justify-between gap-4">
			<div>
				<p class="eyebrow">Your history</p>
				<h2 class="mt-2 text-2xl font-black tracking-tight text-white sm:text-3xl">
					Recent sessions
				</h2>
			</div>
			<p class="hidden text-xs font-bold uppercase tracking-[0.16em] text-[#60736a] sm:block">
				Consistency over everything
			</p>
		</div>

		{#if data.workouts.length > 0}
			<ul class="grid list-none gap-4 p-0 sm:grid-cols-2 lg:grid-cols-3">
				{#each data.workouts as workout, index (workout.id)}
					<li>
						<a
							href={resolve('/workouts/[workoutId]', { workoutId: String(workout.id) })}
							class="group surface block h-full overflow-hidden p-5 text-white no-underline transition hover:-translate-y-1 hover:border-[#c8ff3d]/35 hover:shadow-[0_22px_60px_rgba(0,0,0,0.3)]"
						>
							<div class="mb-8 flex items-start justify-between">
								<span
									class="grid size-10 place-items-center rounded-xl bg-[#c8ff3d]/8 text-[#c8ff3d] transition group-hover:bg-[#c8ff3d] group-hover:text-[#07100c]"
								>
									<svg
										viewBox="0 0 24 24"
										class="size-5"
										fill="none"
										stroke="currentColor"
										stroke-width="2"
										aria-hidden="true"><path d="M6 7v10M3.5 9v6M18 7v10M20.5 9v6M6 12h12" /></svg
									>
								</span><span class="text-4xl font-black leading-none text-white/5"
									>{String(index + 1).padStart(2, '0')}</span
								>
							</div>
							<p
								class="m-0 text-[0.68rem] font-extrabold uppercase tracking-[0.14em] text-[#3ee8cf]"
							>
								{formatWorkoutDate(workout.date)}
							</p>
							<h3 class="mt-2 text-xl font-black tracking-tight">
								{workout.name || 'Untitled workout'}
							</h3>
							{#if workout.notes}<p class="mt-3 line-clamp-2 text-sm leading-6 text-[#82958c]">
									{workout.notes}
								</p>{:else}<p class="mt-3 text-sm text-[#52665c]">No session notes</p>{/if}
							<div
								class="mt-6 flex items-center justify-between border-t border-white/6 pt-4 text-xs font-bold text-[#70847a]"
							>
								<span>View session</span><span
									class="text-[#c8ff3d] transition-transform group-hover:translate-x-1">→</span
								>
							</div>
						</a>
					</li>
				{/each}
			</ul>
		{:else}
			<div class="surface flex flex-col items-center px-6 py-14 text-center">
				<span class="grid size-16 place-items-center rounded-2xl bg-[#c8ff3d]/8 text-[#c8ff3d]"
					><svg
						viewBox="0 0 24 24"
						class="size-8"
						fill="none"
						stroke="currentColor"
						stroke-width="1.7"
						aria-hidden="true"><path d="M6 7v10M3.5 9v6M18 7v10M20.5 9v6M6 12h12" /></svg
					></span
				>
				<h2 class="mt-5 text-2xl font-black">Your first session starts here.</h2>
				<p class="mt-2 max-w-md text-sm leading-6 text-[#82958c]">
					Show up, log the work, and start building a training history you can be proud of.
				</p>
				<a href={resolve('/workouts/new')} class="button-primary mt-6">Start training</a>
			</div>
		{/if}
	</section>
</div>
