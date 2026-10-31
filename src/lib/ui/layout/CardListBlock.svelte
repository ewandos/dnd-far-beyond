<script lang="ts">
	// Karten-Liste: Fähigkeiten, Zustände, ausgerüstete Items oder eine Zauberliste – mit Schnellanlage.
	import type { CardListBlockConfig } from '$lib/engine/types';
	import { sheet } from '$lib/store/sheet.svelte';
	import { ui } from '$lib/store/ui.svelte';
	import { STD } from '$lib/model/defaults';
	import { formatNumber } from '../format';
	import AbilityCard from '../components/AbilityCard.svelte';
	import Icon from '../components/Icon.svelte';
	import ItemRow from '../components/ItemRow.svelte';
	import QuickCreate from '../components/QuickCreate.svelte';
	import SpellCard from '../components/SpellCard.svelte';
	import SpellQuickCreate from '../components/SpellQuickCreate.svelte';
	import Missing from './Missing.svelte';

	let { config }: { config: CardListBlockConfig } = $props();
	const c = $derived(sheet.character!);
	const ev = $derived(sheet.evaluation!);

	const abilities = $derived(
		config.kind === 'ability' || config.kind === 'condition'
			? Object.values(c.abilities)
					.filter((a) => a.kind === config.kind)
					.sort((a, b) => (a.origin ?? '').localeCompare(b.origin ?? '', 'de') || a.order - b.order)
			: []
	);
	const list = $derived(config.kind === 'spells' && config.spellListId ? c.spellLists[config.spellListId] : undefined);
	const spells = $derived.by(() => {
		if (config.kind !== 'spells') return [];
		const ids = config.spellListId ? (list?.spellIds ?? []) : Object.keys(c.spells);
		return ids
			.map((id) => c.spells[id])
			.filter(Boolean)
			.sort((a, b) => a.level - b.level || a.name.localeCompare(b.name, 'de'));
	});
	const equippedContainers = $derived(Object.values(c.containers).filter((x) => x.equipped).sort((a, b) => a.order - b.order));
	const equippedItems = $derived(
		config.kind === 'equipped' ? Object.values(c.items).filter((i) => c.containers[i.containerId]?.equipped).sort((a, b) => a.order - b.order) : []
	);
	let quickContainer = $state<string | undefined>(undefined);
	$effect.pre(() => {
		if (config.kind === 'equipped' && (!quickContainer || !c.containers[quickContainer])) quickContainer = equippedContainers[0]?.id;
	});
</script>

{#if config.kind === 'ability' || config.kind === 'condition'}
	<div class="cards">
		{#each abilities as a (a.id)}<AbilityCard id={a.id} showDescription={config.showDescriptions} />{/each}
		{#if !abilities.length}<p class="empty">{config.kind === 'condition' ? 'Keine Zustände.' : 'Noch keine Fähigkeiten.'}</p>{/if}
	</div>
	<QuickCreate kind={config.kind} />
{:else if config.kind === 'equipped'}
	{#if ev.attunement.limit !== null}
		<button
			type="button"
			class="attune"
			class:over={ev.attunement.over}
			title={ev.attunement.over ? 'Mehr eingestimmte Items als erlaubt – nur ein Hinweis' : 'Eingestimmte Items / Limit'}
			onclick={() => ui.open({ kind: 'field', id: STD.attuned })}
		>
			{#if ev.attunement.over}<Icon name="alert" size={14} />{/if}
			Einstimmung {formatNumber(ev.attunement.count)}/{formatNumber(ev.attunement.limit)}
		</button>
	{/if}
	<div class="cards">
		{#each equippedItems as i (i.id)}<ItemRow id={i.id} draggableRow={false} />{/each}
		{#if !equippedItems.length}<p class="empty">Nichts ausgerüstet.</p>{/if}
	</div>
	{#if equippedContainers.length}
		<QuickCreate kind="item" bind:containerId={quickContainer} chooseContainer={equippedContainers.length > 1} />
	{/if}
{:else if config.kind === 'spells'}
	{#if config.spellListId && !list}
		<Missing what="Zauberliste" />
	{:else}
		<div class="cards">
			{#each spells as s (s.id)}<SpellCard id={s.id} showDescription={config.showDescriptions} />{/each}
			{#if !spells.length}<p class="empty">Keine Zauber in dieser Liste.</p>{/if}
		</div>
		<SpellQuickCreate listId={config.spellListId} />
	{/if}
{/if}

<style>
	.cards {
		margin-bottom: 8px;
	}
	.empty {
		margin: 0;
	}
	.attune {
		position: absolute;
		top: 8px;
		right: 10px;
		display: inline-flex;
		align-items: center;
		gap: 4px;
		min-height: 30px;
		padding: 0 10px;
		border: 1px solid var(--border);
		border-radius: 15px;
		background: var(--surface-2);
		font-size: 12.5px;
		font-variant-numeric: tabular-nums;
	}
	.attune.over {
		color: var(--danger);
		border-color: var(--danger);
		background: var(--danger-soft);
	}
</style>
