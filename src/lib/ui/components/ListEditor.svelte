<script lang="ts">
	// Einträge als Chips; Eingabe mit Enter oder Komma hinzufügen.
	import { parseListText } from '$lib/engine/dice';
	import Icon from './Icon.svelte';

	let { value, onchange, label = 'Eintrag' }: { value: string[]; onchange: (v: string[]) => void; label?: string } = $props();
	let text = $state('');

	function add() {
		const items = parseListText(text).filter((x) => !value.some((v) => v.toLowerCase() === x.toLowerCase()));
		if (items.length) onchange([...value, ...items]);
		text = '';
	}
</script>

<div class="list-editor">
	{#each value as v, i (v + i)}
		<span class="chip">
			{v}
			<button type="button" aria-label="{v} entfernen" onclick={() => onchange(value.filter((_, j) => j !== i))}><Icon name="x" size={14} /></button>
		</span>
	{/each}
	<input
		class="input"
		placeholder="hinzufügen …"
		aria-label="{label} hinzufügen"
		bind:value={text}
		onkeydown={(e) => {
			if (e.key === 'Enter' || e.key === ',') {
				e.preventDefault();
				add();
			}
		}}
		onblur={add}
	/>
</div>

<style>
	.list-editor {
		display: flex;
		flex-wrap: wrap;
		gap: 6px;
		align-items: center;
	}
	.chip {
		display: inline-flex;
		align-items: center;
		gap: 2px;
		padding: 2px 2px 2px 10px;
		border-radius: 14px;
		background: var(--surface);
		border: 1px solid var(--border);
		font-size: 14px;
	}
	.chip button {
		display: inline-flex;
		align-items: center;
		justify-content: center;
		width: 26px;
		height: 26px;
		border: none;
		background: none;
		color: var(--muted);
		border-radius: 50%;
	}
	.chip button:hover {
		color: var(--danger);
	}
	.input {
		flex: 1;
		min-width: 120px;
		min-height: 36px;
	}
</style>
