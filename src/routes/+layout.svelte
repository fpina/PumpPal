<script lang="ts">
	import '../app.css';

	let { children, data } = $props();
</script>

<header class="sticky top-0 z-50 border-b border-white/6 bg-[#07100c]/86 backdrop-blur-xl">
	<nav class="app-container flex h-[4.5rem] items-center justify-between">
		<a href="/" class="group flex items-center gap-2.5 text-white no-underline">
			<span
				class="grid size-9 rotate-3 place-items-center rounded-xl bg-[#c8ff3d] text-[#07100c] shadow-[0_0_28px_rgba(200,255,61,0.18)] transition-transform group-hover:-rotate-3"
			>
				<svg
					viewBox="0 0 24 24"
					class="size-5"
					fill="none"
					stroke="currentColor"
					stroke-width="2.5"
					aria-hidden="true"><path d="M6 7v10M3.5 9v6M18 7v10M20.5 9v6M6 12h12" /></svg
				>
			</span>
			<span class="text-lg font-black tracking-[-0.04em]"
				>PUMP<span class="text-[#c8ff3d]">PAL</span></span
			>
		</a>

		<div class="flex items-center gap-2 sm:gap-3">
			{#if data.user}
				<div class="mr-1 hidden items-center gap-2 border-r border-white/8 pr-4 md:flex">
					<span
						class="grid size-8 place-items-center rounded-full bg-[#3ee8cf]/12 text-xs font-black text-[#3ee8cf]"
						>{data.user.name.slice(0, 1).toUpperCase()}</span
					>
					<div class="leading-tight">
						<p class="m-0 text-xs font-bold text-white">{data.user.name}</p>
						<p class="m-0 text-[0.62rem] font-semibold uppercase tracking-wider text-[#70847a]">
							Athlete
						</p>
					</div>
				</div>
				<a href="/workouts/new" class="button-primary !min-h-10 !px-3 sm:!px-4">
					<svg
						viewBox="0 0 24 24"
						class="size-4"
						fill="none"
						stroke="currentColor"
						stroke-width="2.5"
						aria-hidden="true"><path d="M12 5v14M5 12h14" /></svg
					>
					<span class="hidden sm:inline">New workout</span><span class="sm:hidden">New</span>
				</a>
				<form method="POST" action="/auth/logout">
					<button type="submit" class="button-ghost !min-h-10 !px-3" aria-label="Sign out">
						<svg
							viewBox="0 0 24 24"
							class="size-4"
							fill="none"
							stroke="currentColor"
							stroke-width="2"
							aria-hidden="true"
							><path d="M10 17l5-5-5-5M15 12H3M15 4h4a2 2 0 012 2v12a2 2 0 01-2 2h-4" /></svg
						>
						<span class="hidden lg:inline">Sign out</span>
					</button>
				</form>
			{:else}
				<a href="/auth" class="button-ghost !min-h-10">Sign in</a>
				<a href="/auth/register" class="button-primary !min-h-10">Join now</a>
			{/if}
		</div>
	</nav>
</header>

<main class="app-container py-8 sm:py-12">
	{@render children()}
</main>
