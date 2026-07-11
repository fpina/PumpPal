<script lang="ts">
	let { form } = $props();
</script>

<section class="surface mx-auto grid max-w-5xl overflow-hidden lg:grid-cols-[1.05fr_0.95fr]">
	<div
		class="sport-stripe relative hidden min-h-[650px] flex-col justify-between bg-[#0d1d16] p-10 lg:flex"
	>
		<div class="relative z-10">
			<p class="eyebrow">Member access</p>
			<h2 class="display-title mt-6 !text-[4.6rem]">
				Train.<br />Track.<br /><span class="text-[#c8ff3d]">Repeat.</span>
			</h2>
			<p class="mt-6 max-w-sm text-base leading-7 text-[#8da097]">
				The strongest version of you is built one logged session at a time.
			</p>
		</div>
		<div class="relative z-10 grid grid-cols-3 gap-3">
			<div class="surface-soft p-4">
				<strong class="block text-2xl font-black text-[#c8ff3d]">100%</strong><span
					class="mt-1 block text-[0.62rem] font-bold uppercase tracking-widest text-[#71847b]"
					>Your effort</span
				>
			</div>
			<div class="surface-soft p-4">
				<strong class="block text-2xl font-black text-[#3ee8cf]">24/7</strong><span
					class="mt-1 block text-[0.62rem] font-bold uppercase tracking-widest text-[#71847b]"
					>Ready</span
				>
			</div>
			<div class="surface-soft p-4">
				<strong class="block text-2xl font-black text-white">1%</strong><span
					class="mt-1 block text-[0.62rem] font-bold uppercase tracking-widest text-[#71847b]"
					>Better daily</span
				>
			</div>
		</div>
	</div>

	<div class="flex items-center p-6 sm:p-10 lg:p-12">
		<div class="w-full">
			<p class="eyebrow">Welcome back</p>
			<h1 class="mt-4 text-3xl font-black tracking-[-0.035em] text-white sm:text-4xl">
				Sign in to PumpPal
			</h1>
			<p class="mt-2 text-sm leading-6 text-[#8da097]">
				Your training history is waiting. Pick up where you left off.
			</p>

			{#if form?.message}<p class="status-message mt-5">{form.message}</p>{/if}

			<form method="POST" action="?/login" class="mt-7 space-y-5">
				<div>
					<label for="email" class="field-label">Email address</label>
					<input
						type="email"
						id="email"
						name="email"
						value={form?.values?.email ?? ''}
						autocomplete="email"
						required
						class="field-control"
						placeholder="athlete@example.com"
					/>
					{#if form?.errors?.email}<p class="field-error">{form.errors.email[0]}</p>{/if}
				</div>
				<div>
					<label for="password" class="field-label">Password</label>
					<input
						type="password"
						id="password"
						name="password"
						autocomplete="current-password"
						required
						class="field-control"
						placeholder="Enter your password"
					/>
					{#if form?.errors?.password}<p class="field-error">{form.errors.password[0]}</p>{/if}
				</div>
				<button type="submit" class="button-primary w-full"
					>Sign in <span aria-hidden="true">→</span></button
				>
			</form>

			<div class="my-7 flex items-center gap-3">
				<span class="h-px flex-1 bg-white/7"></span><span
					class="text-[0.65rem] font-bold uppercase tracking-[0.16em] text-[#52655c]"
					>New to the crew?</span
				><span class="h-px flex-1 bg-white/7"></span>
			</div>
			<a href="/auth/register" class="button-ghost w-full">Create your account</a>
		</div>
	</div>
</section>
