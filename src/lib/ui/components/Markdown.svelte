<script lang="ts">
	import { renderMarkdown } from '../markdown';
	let { source, empty = '' }: { source: string; empty?: string } = $props();
	const html = $derived(renderMarkdown(source ?? ''));
</script>

{#if source?.trim()}
	<div class="md">{@html html}</div>
{:else if empty}
	<p class="empty">{empty}</p>
{/if}
