<script lang="ts">
	// Markdown-Text: Vorschau, Antippen von „Bearbeiten“ öffnet das Textfeld.
	import Icon from './Icon.svelte';
	import Markdown from './Markdown.svelte';

	let {
		value,
		onchange,
		placeholder = '',
		rows = 5
	}: { value: string; onchange: (v: string) => void; placeholder?: string; rows?: number } = $props();

	let editing = $state(false);
	let area: HTMLTextAreaElement | undefined = $state();

	$effect(() => {
		if (editing && area) {
			area.focus();
			autosize();
		}
	});

	function autosize() {
		if (!area) return;
		area.style.height = 'auto';
		area.style.height = Math.min(area.scrollHeight + 2, 600) + 'px';
	}
</script>

{#if editing}
	<div class="editor">
		<textarea
			bind:this={area}
			class="textarea"
			{rows}
			{placeholder}
			{value}
			oninput={(e) => {
				onchange((e.currentTarget as HTMLTextAreaElement).value);
				autosize();
			}}
			onkeydown={(e) => {
				if (e.key === 'Escape') {
					e.stopPropagation();
					editing = false;
				}
			}}
		></textarea>
		<div class="bar">
			<span class="muted hint">Markdown</span>
			<button type="button" class="btn small" onclick={() => (editing = false)}>Fertig</button>
		</div>
	</div>
{:else}
	<div class="view">
		{#if value.trim()}
			<Markdown source={value} />
		{:else}
			<p class="empty">{placeholder || 'Leer'}</p>
		{/if}
		<button type="button" class="btn ghost small edit" onclick={() => (editing = true)} aria-label="Text bearbeiten">
			<Icon name="edit" size={15} /> Bearbeiten
		</button>
	</div>
{/if}

<style>
	.editor {
		display: flex;
		flex-direction: column;
		gap: 6px;
		margin-top: 4px;
	}
	.bar {
		display: flex;
		justify-content: space-between;
		align-items: center;
	}
	.hint {
		font-size: 12px;
	}
	.view {
		position: relative;
		margin-top: 4px;
		padding: 2px 0 0;
	}
	.edit {
		margin-top: 4px;
		color: var(--muted);
		padding-left: 0;
	}
</style>
