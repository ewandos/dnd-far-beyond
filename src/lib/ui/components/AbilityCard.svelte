<script lang="ts">
	import { setAbilityActive } from '$lib/store/actions';
	import { sheet } from '$lib/store/sheet.svelte';
	import { ui } from '$lib/store/ui.svelte';
	import CounterBoxes from './CounterBoxes.svelte';
	import Markdown from './Markdown.svelte';
	import ModSummary from './ModSummary.svelte';
	import Switch from './Switch.svelte';

	let { id, showDescription = false }: { id: string; showDescription?: boolean } = $props();
	const a = $derived(sheet.character?.abilities[id]);
	const selected = $derived(ui.panel?.kind === 'ability' && ui.panel.id === id);
</script>

{#if a}
	<div class="card-row" class:off={!a.active} class:selected data-ability={id}>
		<div class="head">
			<button type="button" class="name" onclick={() => ui.open({ kind: 'ability', id })}>
				<span class="title">{a.name}</span>
				{#if a.origin}<span class="origin">{a.origin}</span>{/if}
			</button>
			<Switch checked={a.active} label="{a.name} {a.active ? 'ausschalten' : 'einschalten'}" onchange={(v) => setAbilityActive(id, v)} />
		</div>
		<ModSummary kind="ability" {id} />
		{#if a.counterId}
			<CounterBoxes id={a.counterId} label="Nutzungen" compact />
		{/if}
		{#if showDescription && a.description.trim()}
			<div class="desc"><Markdown source={a.description} /></div>
		{/if}
	</div>
{/if}

<style>
	.card-row {
		display: flex;
		flex-direction: column;
		gap: 2px;
		padding: 6px 0 8px;
		border-bottom: 1px solid var(--border);
	}
	.card-row:last-child {
		border-bottom: none;
	}
	.card-row.selected .title {
		color: var(--accent);
	}
	.head {
		display: flex;
		align-items: center;
		gap: 8px;
	}
	.name {
		flex: 1;
		min-width: 0;
		display: flex;
		align-items: baseline;
		gap: 8px;
		min-height: 36px;
		padding: 0;
		border: none;
		background: none;
		text-align: left;
	}
	.title {
		font-family: var(--font-display);
		font-weight: 600;
		font-size: 16px;
	}
	.name:hover .title {
		color: var(--accent);
	}
	.origin {
		font-size: 11px;
		font-weight: 600;
		letter-spacing: 0.06em;
		text-transform: uppercase;
		color: var(--muted);
		background: var(--surface-2);
		border-radius: 4px;
		padding: 1px 6px;
		white-space: nowrap;
	}
	.off .title,
	.off :global(.summary) {
		opacity: 0.55;
	}
	.desc {
		margin-top: 4px;
		font-size: 14px;
		color: var(--text);
	}
</style>
