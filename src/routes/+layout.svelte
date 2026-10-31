<script lang="ts">
	import '../app.css';
	import { onMount } from 'svelte';
	import { requestPersistentStorage } from '$lib/store/db';
	import { ui } from '$lib/store/ui.svelte';
	import Toasts from '$lib/ui/components/Toasts.svelte';

	let { children } = $props();

	onMount(() => {
		ui.initTheme();
		void requestPersistentStorage();
	});
</script>

{@render children()}
<Toasts />
