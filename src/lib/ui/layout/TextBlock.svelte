<script lang="ts">
	import type { TextBlockConfig } from '$lib/engine/types';
	import { updateText } from '$lib/store/actions';
	import { sheet } from '$lib/store/sheet.svelte';
	import MarkdownEditor from '../components/MarkdownEditor.svelte';
	import Missing from './Missing.svelte';

	let { config }: { config: TextBlockConfig } = $props();
	const t = $derived(sheet.character?.texts[config.textId]);
</script>

{#if t}
	<MarkdownEditor value={t.content} onchange={(v) => updateText(t.id, 'content', v)} placeholder="Noch leer." rows={8} />
{:else}
	<Missing what="Notiz" />
{/if}
