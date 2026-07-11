<script lang="ts">
	import '../app.css';

	let { children, data } = $props();
</script>

<header class="border-b border-slate-200 bg-white">
	<nav class="mx-auto flex max-w-5xl items-center justify-between px-4 py-4">
		<a href="/" class="text-xl font-black tracking-tight text-indigo-700">PumpPal</a>
		<div class="flex items-center gap-4 text-sm font-medium">
			{#if data.user}
				<span class="hidden text-slate-500 sm:inline">{data.user.name}</span>
				<a href="/workouts/new" class="text-slate-700 hover:text-indigo-700">New workout</a>
				<form method="POST" action="/auth/logout">
					<button type="submit" class="text-slate-700 hover:text-indigo-700">Sign out</button>
				</form>
			{:else}
				<a href="/auth" class="text-slate-700 hover:text-indigo-700">Sign in</a>
				<a
					href="/auth/register"
					class="rounded-lg bg-indigo-600 px-3 py-2 text-white hover:bg-indigo-700"
					>Create account</a
				>
			{/if}
		</div>
	</nav>
</header>

<main class="mx-auto max-w-5xl px-4 py-8">
	{@render children()}
</main>
