<script lang="ts">
	// Kästchen zum Ankreuzen. Kein Reset-Knopf: Kästchen ändern sich nur durch Antippen.
	import { setCounterChecked, setCounterMax } from '$lib/store/actions';
	import { sheet } from '$lib/store/sheet.svelte';
	import Icon from './Icon.svelte';

	let { id, label, editable = false, compact = false }: { id: string; label?: string; editable?: boolean; compact?: boolean } = $props();
	const counter = $derived(sheet.character?.counters[id]);
</script>

{#if counter}
	<div class="counter" class:compact>
		{#if label !== ''}
			<span class="name">{label ?? counter.name}</span>
		{/if}
		<div class="boxes" role="group" aria-label={counter.name}>
			{#each Array.from({ length: counter.max }, (_, i) => i) as i (i)}
				<button
					type="button"
					class="box"
					class:checked={i < counter.checked}
					aria-label="{counter.name}: Kästchen {i + 1} {i < counter.checked ? 'angekreuzt' : 'frei'}"
					onclick={() => setCounterChecked(id, i < counter.checked ? i : i + 1)}
				>
					{#if i < counter.checked}<Icon name="x" size={16} stroke={2.4} />{/if}
				</button>
			{/each}
			{#if counter.max === 0 && !editable}
				<span class="none">–</span>
			{/if}
			{#if editable}
				<span class="adjust">
					<button type="button" class="btn ghost small icon" title="Kästchen entfernen" aria-label="Kästchen entfernen" disabled={counter.max === 0} onclick={() => setCounterMax(id, counter.max - 1)}><Icon name="minus" size={16} /></button>
					<button type="button" class="btn ghost small icon" title="Kästchen hinzufügen" aria-label="Kästchen hinzufügen" onclick={() => setCounterMax(id, counter.max + 1)}><Icon name="plus" size={16} /></button>
				</span>
			{/if}
		</div>
	</div>
{/if}

<style>
	.counter {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 10px;
		min-height: var(--tap);
	}
	.name {
		font-size: 14px;
	}
	.boxes {
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		gap: 2px;
		justify-content: flex-end;
	}
	.box {
		display: inline-flex;
		align-items: center;
		justify-content: center;
		width: 36px;
		height: 36px;
		padding: 0;
		border: none;
		background: transparent;
		color: var(--accent-text);
		position: relative;
	}
	.box::before {
		content: '';
		position: absolute;
		inset: 8px;
		border: 1.5px solid var(--border-strong);
		border-radius: 4px;
		background: var(--surface);
		transition: all 0.1s;
	}
	.box.checked::before {
		background: var(--accent);
		border-color: var(--accent);
	}
	.box :global(svg) {
		position: relative;
	}
	.box:hover::before {
		border-color: var(--accent);
	}
	.none {
		color: var(--faint);
		padding: 0 8px;
	}
	.adjust {
		display: inline-flex;
		margin-left: 4px;
		color: var(--muted);
	}
	.compact .box {
		width: 32px;
		height: 32px;
	}
</style>
