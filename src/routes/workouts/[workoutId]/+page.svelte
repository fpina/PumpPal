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
	<section>
		<a href="/" class="text-sm font-semibold text-indigo-700 hover:underline">← Back to workouts</a>
		<div class="mt-4 flex flex-col justify-between gap-3 sm:flex-row sm:items-end">
			<div>
				<p class="text-sm font-semibold text-indigo-600">
					{dateFormatter.format(new Date(data.workout.date))}
				</p>
				<h1 class="mt-1 text-3xl font-bold tracking-tight text-slate-900">
					{data.workout.name || 'Untitled workout'}
				</h1>
			</div>
			<p class="text-sm text-slate-500">
				{data.workout.workoutExercises.length}
				{data.workout.workoutExercises.length === 1 ? 'exercise' : 'exercises'}
			</p>
		</div>
		{#if data.workout.notes}<p class="mt-4 max-w-3xl whitespace-pre-wrap text-slate-600">
				{data.workout.notes}
			</p>{/if}
	</section>

	{#if form?.message}
		<p
			class="rounded-lg p-3 text-sm"
			class:bg-green-50={form.success}
			class:text-green-700={form.success}
			class:bg-red-50={!form.success}
			class:text-red-700={!form.success}
		>
			{form.message}
		</p>
	{/if}

	<section class="space-y-5">
		<h2 class="text-2xl font-bold text-slate-900">Exercises</h2>

		{#if data.workout.workoutExercises.length === 0}
			<p
				class="rounded-xl border border-dashed border-slate-300 bg-white p-8 text-center text-slate-600"
			>
				No exercises yet. Add one below to start logging sets.
			</p>
		{/if}

		{#each data.workout.workoutExercises as workoutExercise (workoutExercise.id)}
			<article class="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
				<div class="border-b border-slate-100 px-5 py-4">
					<div class="flex flex-wrap items-baseline justify-between gap-2">
						<h3 class="text-xl font-bold text-slate-900">{workoutExercise.exercise.name}</h3>
						{#if workoutExercise.exercise.muscleGroup}<span
								class="rounded-full bg-indigo-50 px-2.5 py-1 text-xs font-semibold text-indigo-700"
								>{workoutExercise.exercise.muscleGroup}</span
							>{/if}
					</div>
					{#if workoutExercise.notes}<p class="mt-2 text-sm text-slate-600">
							{workoutExercise.notes}
						</p>{/if}
				</div>

				<div class="px-5 py-4">
					{#if workoutExercise.sets.length > 0}
						<div class="overflow-x-auto">
							<table class="w-full text-left text-sm">
								<thead class="text-xs uppercase tracking-wide text-slate-500">
									<tr
										><th class="pb-2">Set</th><th class="pb-2">Reps</th><th class="pb-2">Weight</th
										><th class="pb-2">Rest</th><th class="pb-2">Status</th></tr
									>
								</thead>
								<tbody class="divide-y divide-slate-100">
									{#each workoutExercise.sets as exerciseSet (exerciseSet.id)}
										<tr>
											<td class="py-2 font-semibold text-slate-900">{exerciseSet.setNumber}</td>
											<td class="py-2">{exerciseSet.reps}</td>
											<td class="py-2"
												>{exerciseSet.weight ?? '—'}
												{exerciseSet.weight !== null ? exerciseSet.weightUnit : ''}</td
											>
											<td class="py-2"
												>{exerciseSet.restTimeSeconds ? `${exerciseSet.restTimeSeconds}s` : '—'}</td
											>
											<td class="py-2"
												><span
													class:!bg-slate-100={!exerciseSet.completed}
													class:!text-slate-600={!exerciseSet.completed}
													class="rounded-full bg-green-50 px-2 py-1 text-xs font-semibold text-green-700"
													>{exerciseSet.completed ? 'Done' : 'Planned'}</span
												></td
											>
										</tr>
									{/each}
								</tbody>
							</table>
						</div>
					{:else}
						<p class="text-sm text-slate-500">No sets logged yet.</p>
					{/if}

					<form
						method="POST"
						action="?/addSet"
						use:enhance
						class="mt-5 grid gap-3 rounded-xl bg-slate-50 p-4 sm:grid-cols-6 sm:items-end"
					>
						<input type="hidden" name="workoutExerciseId" value={workoutExercise.id} />
						<div>
							<label
								for={`set-number-${workoutExercise.id}`}
								class="block text-xs font-semibold text-slate-600">Set</label
							>
							<input
								id={`set-number-${workoutExercise.id}`}
								type="number"
								name="setNumber"
								min="1"
								value={form?.intent === 'addSet' && form.targetId === workoutExercise.id
									? (form.values?.setNumber ?? workoutExercise.sets.length + 1)
									: workoutExercise.sets.length + 1}
								required
								class="mt-1 w-full rounded-lg border border-slate-300 px-2 py-2"
							/>
						</div>
						<div>
							<label
								for={`reps-${workoutExercise.id}`}
								class="block text-xs font-semibold text-slate-600">Reps</label
							>
							<input
								id={`reps-${workoutExercise.id}`}
								type="number"
								name="reps"
								min="0"
								value={form?.intent === 'addSet' && form.targetId === workoutExercise.id
									? (form.values?.reps ?? '')
									: ''}
								required
								class="mt-1 w-full rounded-lg border border-slate-300 px-2 py-2"
							/>
						</div>
						<div>
							<label
								for={`weight-${workoutExercise.id}`}
								class="block text-xs font-semibold text-slate-600">Weight</label
							>
							<input
								id={`weight-${workoutExercise.id}`}
								type="number"
								name="weight"
								min="0"
								step="0.01"
								value={form?.intent === 'addSet' && form.targetId === workoutExercise.id
									? (form.values?.weight ?? '')
									: ''}
								class="mt-1 w-full rounded-lg border border-slate-300 px-2 py-2"
							/>
						</div>
						<div>
							<label
								for={`unit-${workoutExercise.id}`}
								class="block text-xs font-semibold text-slate-600">Unit</label
							>
							<select
								id={`unit-${workoutExercise.id}`}
								name="weightUnit"
								class="mt-1 w-full rounded-lg border border-slate-300 px-2 py-2"
							>
								<option value="kg">kg</option><option value="lb">lb</option>
							</select>
						</div>
						<div>
							<label
								for={`rest-${workoutExercise.id}`}
								class="block text-xs font-semibold text-slate-600">Rest (sec)</label
							>
							<input
								id={`rest-${workoutExercise.id}`}
								type="number"
								name="restTimeSeconds"
								min="0"
								value={form?.intent === 'addSet' && form.targetId === workoutExercise.id
									? (form.values?.restTimeSeconds ?? '')
									: ''}
								class="mt-1 w-full rounded-lg border border-slate-300 px-2 py-2"
							/>
						</div>
						<div>
							<label class="mb-2 flex items-center gap-2 text-xs font-semibold text-slate-600"
								><input type="checkbox" name="completed" checked /> Done</label
							>
							<button
								type="submit"
								class="w-full rounded-lg bg-slate-900 px-3 py-2 font-semibold text-white hover:bg-slate-700"
								>Add set</button
							>
						</div>
					</form>
					{#if form?.intent === 'addSet' && form.targetId === workoutExercise.id && !form.success && Object.keys(form.errors).length > 0}
						<p class="mt-2 text-sm text-red-600">{Object.values(form.errors).flat()[0]}</p>
					{/if}
				</div>
			</article>
		{/each}
	</section>

	<section class="grid gap-5 lg:grid-cols-2">
		<form
			method="POST"
			action="?/addExercise"
			use:enhance
			class="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm"
		>
			<h2 class="text-lg font-bold text-slate-900">Add from your library</h2>
			<p class="mt-1 text-sm text-slate-500">Reuse an exercise you have already created.</p>
			<input type="hidden" name="order" value={data.workout.workoutExercises.length + 1} />
			<label for="exerciseId" class="mt-4 block text-sm font-medium text-slate-700">Exercise</label>
			<select
				id="exerciseId"
				name="exerciseId"
				required
				disabled={data.availableExercises.length === 0}
				class="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2"
			>
				<option value="">Select an exercise</option>
				{#each data.availableExercises as availableExercise (availableExercise.id)}
					<option value={availableExercise.id}
						>{availableExercise.name}{availableExercise.muscleGroup
							? ` · ${availableExercise.muscleGroup}`
							: ''}</option
					>
				{/each}
			</select>
			<label for="exerciseNotes" class="mt-4 block text-sm font-medium text-slate-700"
				>Notes <span class="font-normal text-slate-400">optional</span></label
			>
			<input
				id="exerciseNotes"
				name="notes"
				maxlength="1000"
				class="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2"
			/>
			<button
				type="submit"
				disabled={data.availableExercises.length === 0}
				class="mt-4 w-full rounded-lg bg-indigo-600 px-4 py-2.5 font-semibold text-white hover:bg-indigo-700 disabled:cursor-not-allowed disabled:bg-slate-300"
				>Add exercise</button
			>
			{#if form?.intent === 'addExercise' && !form.success && Object.keys(form.errors).length > 0}<p
					class="mt-2 text-sm text-red-600"
				>
					{Object.values(form.errors).flat()[0]}
				</p>{/if}
		</form>

		<form
			method="POST"
			action="?/createExercise"
			use:enhance
			class="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm"
		>
			<h2 class="text-lg font-bold text-slate-900">Create a new exercise</h2>
			<p class="mt-1 text-sm text-slate-500">
				It will be saved to your exercise library and added here.
			</p>
			<input type="hidden" name="order" value={data.workout.workoutExercises.length + 1} />
			<label for="newExerciseName" class="mt-4 block text-sm font-medium text-slate-700">Name</label
			>
			<input
				id="newExerciseName"
				name="name"
				maxlength="255"
				value={form?.intent === 'createExercise' ? (form.values?.name ?? '') : ''}
				required
				class="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2"
			/>
			<label for="muscleGroup" class="mt-4 block text-sm font-medium text-slate-700"
				>Muscle group <span class="font-normal text-slate-400">optional</span></label
			>
			<input
				id="muscleGroup"
				name="muscleGroup"
				maxlength="100"
				value={form?.intent === 'createExercise' ? (form.values?.muscleGroup ?? '') : ''}
				placeholder="Chest, back, legs…"
				class="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2"
			/>
			<button
				type="submit"
				class="mt-4 w-full rounded-lg border border-indigo-600 px-4 py-2.5 font-semibold text-indigo-700 hover:bg-indigo-50"
				>Create and add</button
			>
			{#if form?.intent === 'createExercise' && !form.success && Object.keys(form.errors).length > 0}<p
					class="mt-2 text-sm text-red-600"
				>
					{Object.values(form.errors).flat()[0]}
				</p>{/if}
		</form>
	</section>
</div>
