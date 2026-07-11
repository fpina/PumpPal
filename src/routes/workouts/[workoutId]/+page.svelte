<script lang="ts">
	import { enhance } from '$app/forms';

	let { data, form } = $props();

	const dateFormatter = new Intl.DateTimeFormat(undefined, {
		year: 'numeric',
		month: 'long',
		day: 'numeric'
	});
</script>

<div class="space-y-8">
	<a href="/" class="back-link">← Back to workouts</a>

	<section class="sport-stripe surface px-6 py-8 sm:px-9 sm:py-10">
		<div class="relative z-10 flex flex-col justify-between gap-8 lg:flex-row lg:items-end">
			<div class="max-w-3xl">
				<p class="eyebrow">{dateFormatter.format(new Date(data.workout.date))}</p>
				<h1 class="page-title mt-5">{data.workout.name || 'Untitled workout'}</h1>
				{#if data.workout.notes}<p
						class="mt-5 max-w-2xl whitespace-pre-wrap text-sm leading-6 text-[#92a49b]"
					>
						{data.workout.notes}
					</p>{/if}
			</div>
			<div class="flex flex-wrap gap-7">
				<div class="metric">
					<strong>{data.workout.workoutExercises.length}</strong><span
						>{data.workout.workoutExercises.length === 1 ? 'Exercise' : 'Exercises'}</span
					>
				</div>
				<div class="metric !border-[#3ee8cf]">
					<strong
						>{data.workout.workoutExercises.reduce(
							(count, entry) => count + entry.sets.length,
							0
						)}</strong
					><span>Total sets</span>
				</div>
			</div>
		</div>
	</section>

	{#if form?.message}
		<p
			class={`status-message ${form.success ? '!border-[#3ee8cf]/25 !bg-[#3ee8cf]/8 !text-[#6ff5df]' : ''}`}
		>
			{form.message}
		</p>
	{/if}

	<section class="space-y-5">
		<div class="flex items-end justify-between gap-4">
			<div>
				<p class="eyebrow">Session build</p>
				<h2 class="mt-2 text-2xl font-black tracking-tight text-white sm:text-3xl">
					Exercises & sets
				</h2>
			</div>
			<span class="hidden text-xs font-bold uppercase tracking-[0.15em] text-[#5f7369] sm:block"
				>Put in the numbers</span
			>
		</div>

		{#if data.workout.workoutExercises.length === 0}
			<div class="surface flex flex-col items-center px-6 py-12 text-center">
				<span class="grid size-14 place-items-center rounded-2xl bg-[#c8ff3d]/8 text-[#c8ff3d]"
					><svg
						viewBox="0 0 24 24"
						class="size-7"
						fill="none"
						stroke="currentColor"
						stroke-width="1.8"
						aria-hidden="true"><path d="M6 7v10M3.5 9v6M18 7v10M20.5 9v6M6 12h12" /></svg
					></span
				>
				<h3 class="mt-4 text-xl font-black">Build your first movement</h3>
				<p class="mt-2 text-sm text-[#82958c]">Add an exercise below, then start stacking sets.</p>
			</div>
		{/if}

		{#each data.workout.workoutExercises as workoutExercise, exerciseIndex (workoutExercise.id)}
			<article class="surface overflow-hidden">
				<header
					class="flex flex-wrap items-center justify-between gap-4 border-b border-white/6 bg-white/[0.018] px-5 py-5 sm:px-7"
				>
					<div class="flex items-center gap-4">
						<span
							class="grid size-11 place-items-center rounded-xl bg-[#c8ff3d]/9 font-black text-[#c8ff3d]"
							>{String(exerciseIndex + 1).padStart(2, '0')}</span
						>
						<div>
							<h3 class="m-0 text-xl font-black tracking-tight text-white">
								{workoutExercise.exercise.name}
							</h3>
							{#if workoutExercise.notes}<p class="mt-1 text-xs text-[#74877e]">
									{workoutExercise.notes}
								</p>{/if}
						</div>
					</div>
					{#if workoutExercise.exercise.muscleGroup}<span
							class="rounded-full border border-[#3ee8cf]/20 bg-[#3ee8cf]/8 px-3 py-1.5 text-[0.65rem] font-extrabold uppercase tracking-[0.12em] text-[#3ee8cf]"
							>{workoutExercise.exercise.muscleGroup}</span
						>{/if}
				</header>

				<div class="p-5 sm:p-7">
					{#if workoutExercise.sets.length > 0}
						<div class="overflow-x-auto rounded-xl border border-white/6">
							<table class="w-full min-w-[560px] border-collapse text-left text-sm">
								<thead
									class="bg-white/[0.025] text-[0.64rem] font-extrabold uppercase tracking-[0.13em] text-[#6d8177]"
									><tr
										><th class="px-4 py-3">Set</th><th class="px-4 py-3">Reps</th><th
											class="px-4 py-3">Load</th
										><th class="px-4 py-3">Rest</th><th class="px-4 py-3">Status</th></tr
									></thead
								>
								<tbody class="divide-y divide-white/5">
									{#each workoutExercise.sets as exerciseSet (exerciseSet.id)}
										<tr class="transition hover:bg-white/[0.018]"
											><td class="px-4 py-3.5 font-black text-[#c8ff3d]"
												>#{exerciseSet.setNumber}</td
											><td class="px-4 py-3.5 font-bold text-white">{exerciseSet.reps}</td><td
												class="px-4 py-3.5 text-[#b1c0b8]"
												>{exerciseSet.weight ?? '—'}
												{exerciseSet.weight !== null ? exerciseSet.weightUnit : ''}</td
											><td class="px-4 py-3.5 text-[#82958c]"
												>{exerciseSet.restTimeSeconds ? `${exerciseSet.restTimeSeconds}s` : '—'}</td
											><td class="px-4 py-3.5"
												><span
													class={`rounded-full px-2.5 py-1 text-[0.65rem] font-extrabold uppercase tracking-wider ${exerciseSet.completed ? 'bg-[#c8ff3d]/8 text-[#c8ff3d]' : 'bg-white/5 text-[#71847a]'}`}
													>{exerciseSet.completed ? 'Complete' : 'Planned'}</span
												></td
											></tr
										>
									{/each}
								</tbody>
							</table>
						</div>
					{:else}<p class="surface-soft m-0 p-4 text-center text-sm text-[#71847a]">
							No sets logged. Make the first one count.
						</p>{/if}

					<form
						method="POST"
						action="?/addSet"
						use:enhance
						class="mt-5 grid gap-3 rounded-xl border border-[#c8ff3d]/10 bg-[#c8ff3d]/[0.025] p-4 sm:grid-cols-2 lg:grid-cols-6 lg:items-end"
					>
						<input type="hidden" name="workoutExerciseId" value={workoutExercise.id} />
						<div>
							<label for={`set-number-${workoutExercise.id}`} class="field-label">Set</label><input
								id={`set-number-${workoutExercise.id}`}
								type="number"
								name="setNumber"
								min="1"
								value={form?.intent === 'addSet' &&
								form.targetId === workoutExercise.id &&
								!form.success
									? (form.values?.setNumber ?? workoutExercise.sets.length + 1)
									: workoutExercise.sets.length + 1}
								required
								class="field-control !min-h-11 !px-3 !py-2"
							/>
						</div>
						<div>
							<label for={`reps-${workoutExercise.id}`} class="field-label">Reps</label><input
								id={`reps-${workoutExercise.id}`}
								type="number"
								name="reps"
								min="0"
								value={form?.intent === 'addSet' &&
								form.targetId === workoutExercise.id &&
								!form.success
									? (form.values?.reps ?? '')
									: ''}
								required
								class="field-control !min-h-11 !px-3 !py-2"
								placeholder="8"
							/>
						</div>
						<div>
							<label for={`weight-${workoutExercise.id}`} class="field-label">Weight</label><input
								id={`weight-${workoutExercise.id}`}
								type="number"
								name="weight"
								min="0"
								step="0.01"
								value={form?.intent === 'addSet' &&
								form.targetId === workoutExercise.id &&
								!form.success
									? (form.values?.weight ?? '')
									: ''}
								class="field-control !min-h-11 !px-3 !py-2"
								placeholder="60"
							/>
						</div>
						<div>
							<label for={`unit-${workoutExercise.id}`} class="field-label">Unit</label><select
								id={`unit-${workoutExercise.id}`}
								name="weightUnit"
								class="field-control !min-h-11 !px-3 !py-2"
								><option value="kg">kg</option><option value="lb">lb</option></select
							>
						</div>
						<div>
							<label for={`rest-${workoutExercise.id}`} class="field-label">Rest</label><input
								id={`rest-${workoutExercise.id}`}
								type="number"
								name="restTimeSeconds"
								min="0"
								value={form?.intent === 'addSet' &&
								form.targetId === workoutExercise.id &&
								!form.success
									? (form.values?.restTimeSeconds ?? '')
									: ''}
								class="field-control !min-h-11 !px-3 !py-2"
								placeholder="sec"
							/>
						</div>
						<div>
							<label
								class="mb-2 flex items-center gap-2 text-[0.67rem] font-bold uppercase tracking-wider text-[#80938a]"
								><input type="checkbox" name="completed" checked class="size-4 accent-[#c8ff3d]" /> Completed</label
							><button type="submit" class="button-primary !min-h-11 w-full !py-2">Add set</button>
						</div>
					</form>
					{#if form?.intent === 'addSet' && form.targetId === workoutExercise.id && !form.success && Object.keys(form.errors).length > 0}<p
							class="field-error"
						>
							{Object.values(form.errors).flat()[0]}
						</p>{/if}
				</div>
			</article>
		{/each}
	</section>

	<section>
		<div class="mb-5">
			<p class="eyebrow">Add movement</p>
			<h2 class="mt-2 text-2xl font-black tracking-tight text-white">Grow the session</h2>
		</div>
		<div class="grid gap-5 lg:grid-cols-2">
			<form method="POST" action="?/addExercise" use:enhance class="surface p-5 sm:p-7">
				<div class="flex items-center gap-3">
					<span class="grid size-10 place-items-center rounded-xl bg-[#3ee8cf]/8 text-[#3ee8cf]"
						><svg
							viewBox="0 0 24 24"
							class="size-5"
							fill="none"
							stroke="currentColor"
							stroke-width="2"
							aria-hidden="true"><path d="M4 6h16M4 12h16M4 18h10" /></svg
						></span
					>
					<div>
						<h3 class="m-0 text-lg font-black">Exercise library</h3>
						<p class="mt-0.5 text-xs text-[#74877e]">Reuse a movement you already know.</p>
					</div>
				</div>
				<input type="hidden" name="order" value={data.workout.workoutExercises.length + 1} />
				<div class="mt-5">
					<label for="exerciseId" class="field-label">Choose exercise</label><select
						id="exerciseId"
						name="exerciseId"
						required
						disabled={data.availableExercises.length === 0}
						class="field-control"
						><option value="">Select an exercise</option
						>{#each data.availableExercises as availableExercise (availableExercise.id)}<option
								value={availableExercise.id}
								>{availableExercise.name}{availableExercise.muscleGroup
									? ` · ${availableExercise.muscleGroup}`
									: ''}</option
							>{/each}</select
					>
				</div>
				<div class="mt-4">
					<label for="exerciseNotes" class="field-label"
						>Notes <span class="normal-case tracking-normal text-[#61756b]">— optional</span></label
					><input
						id="exerciseNotes"
						name="notes"
						maxlength="1000"
						class="field-control"
						placeholder="Tempo, setup, target…"
					/>
				</div>
				<button
					type="submit"
					disabled={data.availableExercises.length === 0}
					class="button-primary mt-5 w-full">Add from library</button
				>
				{#if form?.intent === 'addExercise' && !form.success && Object.keys(form.errors).length > 0}<p
						class="field-error"
					>
						{Object.values(form.errors).flat()[0]}
					</p>{/if}
			</form>

			<form method="POST" action="?/createExercise" use:enhance class="surface p-5 sm:p-7">
				<div class="flex items-center gap-3">
					<span class="grid size-10 place-items-center rounded-xl bg-[#c8ff3d]/8 text-[#c8ff3d]"
						><svg
							viewBox="0 0 24 24"
							class="size-5"
							fill="none"
							stroke="currentColor"
							stroke-width="2.2"
							aria-hidden="true"><path d="M12 5v14M5 12h14" /></svg
						></span
					>
					<div>
						<h3 class="m-0 text-lg font-black">New exercise</h3>
						<p class="mt-0.5 text-xs text-[#74877e]">Create it once. Reuse it forever.</p>
					</div>
				</div>
				<input type="hidden" name="order" value={data.workout.workoutExercises.length + 1} />
				<div class="mt-5">
					<label for="newExerciseName" class="field-label">Exercise name</label><input
						id="newExerciseName"
						name="name"
						maxlength="255"
						value={form?.intent === 'createExercise' ? (form.values?.name ?? '') : ''}
						required
						class="field-control"
						placeholder="e.g. Bulgarian split squat"
					/>
				</div>
				<div class="mt-4">
					<label for="muscleGroup" class="field-label"
						>Muscle group <span class="normal-case tracking-normal text-[#61756b]">— optional</span
						></label
					><input
						id="muscleGroup"
						name="muscleGroup"
						maxlength="100"
						value={form?.intent === 'createExercise' ? (form.values?.muscleGroup ?? '') : ''}
						placeholder="Chest, back, legs…"
						class="field-control"
					/>
				</div>
				<button type="submit" class="button-secondary mt-5 w-full">Create & add</button>
				{#if form?.intent === 'createExercise' && !form.success && Object.keys(form.errors).length > 0}<p
						class="field-error"
					>
						{Object.values(form.errors).flat()[0]}
					</p>{/if}
			</form>
		</div>
	</section>
</div>
