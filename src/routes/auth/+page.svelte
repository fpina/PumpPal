<script lang="ts">
	let { form } = $props();
</script>

<section class="mx-auto max-w-md rounded-2xl border border-slate-200 bg-white p-6 shadow-sm sm:p-8">
	<p class="mb-2 text-sm font-semibold uppercase tracking-wider text-indigo-600">Welcome back</p>
	<h1 class="text-3xl font-bold tracking-tight text-slate-900">Sign in to PumpPal</h1>
	<p class="mt-2 text-slate-600">Keep your training history in one place.</p>

	{#if form?.message}
		<p class="mt-5 rounded-lg bg-red-50 p-3 text-sm text-red-700">{form.message}</p>
	{/if}

	<form method="POST" action="?/login" class="mt-6 space-y-5">
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
				autocomplete="current-password"
				required
				class="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-200"
			/>
			{#if form?.errors?.password}<p class="mt-1 text-sm text-red-600">
					{form.errors.password[0]}
				</p>{/if}
		</div>

		<button
			type="submit"
			class="w-full rounded-lg bg-indigo-600 px-4 py-2.5 font-semibold text-white hover:bg-indigo-700"
		>
			Sign in
		</button>
	</form>

	<p class="mt-6 text-center text-sm text-slate-600">
		New here? <a href="/auth/register" class="font-semibold text-indigo-700 hover:underline"
			>Create an account</a
		>
	</p>
</section>
