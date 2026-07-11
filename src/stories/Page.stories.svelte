<script module>
	import { defineMeta } from '@storybook/addon-svelte-csf';
	import { userEvent, waitFor, within } from '@storybook/test';
	import Page from './Page.svelte';

	// More on how to set up stories at: https://storybook.js.org/docs/writing-stories
	const { Story } = defineMeta({
		title: 'Example/Page',
		component: Page,
		parameters: {
			// More on how to position stories at: https://storybook.js.org/docs/configure/story-layout
			layout: 'fullscreen'
		}
	});
</script>

<Story
	name="Logged In"
	play={async ({ canvasElement }) => {
		const canvas = within(canvasElement);
		const loginButton = canvas.getByRole('button', { name: /Log in/i });
		await userEvent.click(loginButton);
		await waitFor(() => {
			if (canvas.queryByRole('button', { name: /Log in/i })) {
				throw new Error('Login button is still visible');
			}
		});

		canvas.getByRole('button', { name: /Log out/i });
	}}
/>

<Story name="Logged Out" />
