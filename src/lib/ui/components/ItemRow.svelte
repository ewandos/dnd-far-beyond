<script lang="ts">
	import { sheet } from '$lib/store/sheet.svelte';
	import { ui } from '$lib/store/ui.svelte';
	import { draggable, handleDrop } from '../dnd.svelte';
	import { formatNumber } from '../format';
	import CounterBoxes from './CounterBoxes.svelte';
	import Icon from './Icon.svelte';
	import ModSummary from './ModSummary.svelte';

	let { id, draggableRow = true }: { id: string; draggableRow?: boolean } = $props();
	const c = $derived(sheet.character!);
	const item = $derived(c.items[id]);
	const selected = $derived(ui.panel?.kind === 'item' && ui.panel.id === id);
</script>

{#if item}
	<div class="item" class:selected data-item={id}>
		{#if draggableRow}
			<span class="grip" use:draggable={{ payload: { kind: 'item', id, label: item.name }, ondrop: handleDrop }} title="Ziehen zum Verschieben" aria-hidden="true">
				<Icon name="grip" size={18} stroke={3} />
			</span>
		{/if}
		<div class="main">
			<button type="button" class="name" onclick={() => ui.open({ kind: 'item', id })}>
				<span class="title">{item.name}</span>
				{#if item.quantity !== 1}<span class="qty num">×{formatNumber(item.quantity)}</span>{/if}
				{#if item.requiresAttunement}<span class="att" title="Erfordert Einstimmung">Einstimmung</span>{/if}
			</button>
			<ModSummary kind="item" {id} />
			{#if item.counterId}
				<CounterBoxes id={item.counterId} label="Nutzungen" compact />
			{/if}
		</div>
	</div>
{/if}

<style>
	.item {
		display: flex;
		align-items: flex-start;
		gap: 2px;
		padding: 4px 0;
		border-bottom: 1px solid color-mix(in srgb, var(--border) 70%, transparent);
	}
	.item:last-child {
		border-bottom: none;
	}
	.grip {
		display: inline-flex;
		align-items: center;
		justify-content: center;
		width: 30px;
		height: 40px;
		color: var(--faint);
		cursor: grab;
		flex-shrink: 0;
	}
	.grip:hover {
		color: var(--accent);
	}
	.main {
		flex: 1;
		min-width: 0;
		display: flex;
		flex-direction: column;
		padding-bottom: 2px;
	}
	.name {
		display: flex;
		align-items: center;
		gap: 8px;
		min-height: 40px;
		padding: 0;
		border: none;
		background: none;
		text-align: left;
	}
	.title {
		font-weight: 550;
		font-size: 15px;
	}
	.name:hover .title,
	.selected .title {
		color: var(--accent);
	}
	.qty {
		font-size: 13px;
		color: var(--muted);
	}
	.att {
		font-size: 10.5px;
		font-weight: 600;
		letter-spacing: 0.05em;
		text-transform: uppercase;
		color: var(--accent);
		border: 1px solid currentColor;
		border-radius: 4px;
		padding: 0 5px;
	}
</style>
