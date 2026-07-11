<script lang="ts">
	let { form } = $props();
</script>

<section class="surface mx-auto grid max-w-5xl overflow-hidden lg:grid-cols-[0.95fr_1.05fr]">
	<div class="flex items-center p-6 sm:p-10 lg:p-12">
		<div class="w-full">
			<p class="eyebrow">Join the movement</p>
			<h1 class="mt-4 text-3xl font-black tracking-[-0.035em] text-white sm:text-4xl">
				Create your account
			</h1>
			<p class="mt-2 text-sm leading-6 text-[#8da097]">
				Set up your training log and turn every workout into visible progress.
			</p>

			{#if form?.message}<p class="status-message mt-5">{form.message}</p>{/if}

			<form method="POST" action="?/register" class="mt-7 space-y-4">
				<div>
					<label for="name" class="field-label">Name</label><input
						type="text"
						id="name"
						name="name"
						value={form?.values?.name ?? ''}
						autocomplete="name"
						required
						class="field-control"
						placeholder="How should we call you?"
					/>{#if form?.errors?.name}<p class="field-error">{form.errors.name[0]}</p>{/if}
				</div>
				<div>
					<label for="email" class="field-label">Email address</label><input
						type="email"
						id="email"
						name="email"
						value={form?.values?.email ?? ''}
						autocomplete="email"
						required
						class="field-control"
						placeholder="athlete@example.com"
					/>{#if form?.errors?.email}<p class="field-error">{form.errors.email[0]}</p>{/if}
				</div>
				<div class="grid gap-4 sm:grid-cols-2">
					<div>
						<label for="password" class="field-label">Password</label><input
							type="password"
							id="password"
							name="password"
							autocomplete="new-password"
							minlength="8"
							required
							class="field-control"
							placeholder="8+ characters"
						/>{#if form?.errors?.password}<p class="field-error">{form.errors.password[0]}</p>{/if}
					</div>
					<div>
						<label for="confirmPassword" class="field-label">Confirm password</label><input
							type="password"
							id="confirmPassword"
							name="confirmPassword"
							autocomplete="new-password"
							minlength="8"
							required
							class="field-control"
							placeholder="Repeat password"
						/>{#if form?.errors?.confirmPassword}<p class="field-error">
								{form.errors.confirmPassword[0]}
							</p>{/if}
					</div>
				</div>
				<button type="submit" class="button-primary mt-2 w-full"
					>Create account <span aria-hidden="true">→</span></button
				>
			</form>
			<p class="mt-6 text-center text-sm text-[#7e9188]">
				Already part of PumpPal? <a
					href="/auth"
					class="font-bold text-[#c8ff3d] no-underline hover:text-white">Sign in</a
				>
			</p>
		</div>
	</div>

	<div
		class="sport-stripe relative hidden min-h-[680px] flex-col justify-between bg-[#0d1d16] p-10 lg:flex"
	>
		<div class="relative z-10">
			<p class="eyebrow">No excuses</p>
			<h2 class="display-title mt-6 !text-[4.6rem]">
				Your work.<br />Your data.<br /><span class="text-[#3ee8cf]">Your gains.</span>
			</h2>
			<p class="mt-6 max-w-sm text-base leading-7 text-[#8da097]">
				A clean training record removes the guesswork and keeps you moving forward.
			</p>
		</div>
		<div class="relative z-10 surface-soft p-5">
			<p class="m-0 text-sm font-bold leading-6 text-[#b8c6bf]">
				“Discipline is choosing between what you want now and what you want most.”
			</p>
			<p class="mt-3 text-[0.65rem] font-extrabold uppercase tracking-[0.16em] text-[#c8ff3d]">
				Build the habit
			</p>
		</div>
	</div>
</section>
