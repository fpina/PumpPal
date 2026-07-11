<script lang="ts">
	let { form } = $props();
</script>

<section class="mx-auto max-w-md rounded-2xl border border-slate-200 bg-white p-6 shadow-sm sm:p-8">
	<p class="mb-2 text-sm font-semibold uppercase tracking-wider text-indigo-600">Start training</p>
	<h1 class="text-3xl font-bold tracking-tight text-slate-900">Create your account</h1>
	<p class="mt-2 text-slate-600">Log workouts, exercises, and every completed set.</p>

	{#if form?.message}
		<p class="mt-5 rounded-lg bg-red-50 p-3 text-sm text-red-700">{form.message}</p>
	{/if}

	<form method="POST" action="?/register" class="mt-6 space-y-4">
		<div>
			<label for="name" class="block text-sm font-medium text-slate-700">Name</label>
			<input
				type="text"
				id="name"
				name="name"
				value={form?.values?.name ?? ''}
				autocomplete="name"
				required
				class="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-200"
			/>
			{#if form?.errors?.name}<p class="mt-1 text-sm text-red-600">{form.errors.name[0]}</p>{/if}
		</div>

		<div>
			<label for="email" class="block text-sm font-medium text-slate-700">Email</label>
			<input
				type="email"
				id="email"
				name="email"
				value={form?.values?.email ?? ''}
				autocomplete="email"
				required
				class="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-200"
			/>
			{#if form?.errors?.email}<p class="mt-1 text-sm text-red-600">{form.errors.email[0]}</p>{/if}
		</div>

		<div>
			<label for="password" class="block text-sm font-medium text-slate-700">Password</label>
			<input
				type="password"
				id="password"
				name="password"
				autocomplete="new-password"
				minlength="8"
				required
				class="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-200"
			/>
			{#if form?.errors?.password}<p class="mt-1 text-sm text-red-600">
					{form.errors.password[0]}
				</p>{/if}
		</div>

		<div>
			<label for="confirmPassword" class="block text-sm font-medium text-slate-700"
				>Confirm password</label
			>
			<input
				type="password"
				id="confirmPassword"
				name="confirmPassword"
				autocomplete="new-password"
				minlength="8"
				required
				class="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-200"
			/>
			{#if form?.errors?.confirmPassword}<p class="mt-1 text-sm text-red-600">
					{form.errors.confirmPassword[0]}
				</p>{/if}
		</div>

		<button
			type="submit"
			class="mt-2 w-full rounded-lg bg-indigo-600 px-4 py-2.5 font-semibold text-white hover:bg-indigo-700"
		>
			Create account
		</button>
	</form>

	<p class="mt-6 text-center text-sm text-slate-600">
		Already registered? <a href="/auth" class="font-semibold text-indigo-700 hover:underline"
			>Sign in</a
		>
	</p>
</section>
