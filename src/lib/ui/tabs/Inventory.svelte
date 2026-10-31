<script lang="ts">
	import { GROUPS } from '$lib/model/defaults';
	import { addContainer, moveItem } from '$lib/store/actions';
	import { sheet } from '$lib/store/sheet.svelte';
	import { childContainers, orphanItems } from '../containers';
	import { drag } from '../dnd.svelte';
	import { sortedFields } from '../fields';
	import { formatNumber } from '../format';
	import ContainerBox from '../components/ContainerBox.svelte';
	import FieldValue from '../components/FieldValue.svelte';
	import Icon from '../components/Icon.svelte';
	import ItemRow from '../components/ItemRow.svelte';
	import QuickCreate from '../components/QuickCreate.svelte';

	const c = $derived(sheet.character!);
	const ev = $derived(sheet.evaluation!);
	const roots = $derived(childContainers(c, undefined));
	const orphans = $derived(orphanItems(c));
	const currency = $derived(sortedFields(c, { group: GROUPS.currency }));
	let quickContainer = $state<string | undefined>(undefined);
	$effect.pre(() => {
		if (!quickContainer || !c.containers[quickContainer]) quickContainer = roots.find((r) => !r.equipped)?.id ?? roots[0]?.id;
	});
</script>

<div class="inventory">
	<section class="card pad top">
		<QuickCreate kind="item" bind:containerId={quickContainer} chooseContainer />
	</section>

	<div class="bar">
		{#if currency.length}
			<div class="currency card">
				{#each currency as f (f.id)}
					<div class="coin">
						<span class="label" title={f.notes ?? ''}>{f.name}</span>
						<FieldValue id={f.id} size="md" />
					</div>
				{/each}
			</div>
		{/if}
		{#if ev.attunement.limit !== null}
			<div class="attune card" class:over={ev.attunement.over}>
				{#if ev.attunement.over}<Icon name="alert" size={16} />{/if}
				<span>Eingestimmt</span>
				<strong class="num">{formatNumber(ev.attunement.count)} / {formatNumber(ev.attunement.limit)}</strong>
			</div>
		{/if}
		<span class="spacer"></span>
		<button type="button" class="btn" onclick={() => addContainer('Neuer Container')}>
			<Icon name="plus" size={18} /> Container
		</button>
	</div>

	{#if drag.payload}
		<p class="drag-hint">Auf einen Container ziehen und loslassen.</p>
	{/if}

	<div class="columns">
		{#each roots as ct (ct.id)}<ContainerBox id={ct.id} />{/each}
	</div>

	{#if orphans.length}
		<section class="card pad orphans">
			<h2 class="section-title">Ohne Container</h2>
			{#each orphans as i (i.id)}
				<div class="orphan">
					<ItemRow id={i.id} />
					{#if roots[0]}<button type="button" class="btn small" onclick={() => moveItem(i.id, roots[0].id)}>In „{roots[0].name}“</button>{/if}
				</div>
			{/each}
		</section>
	{/if}
</div>

<style>
	.inventory {
		display: flex;
		flex-direction: column;
		gap: 14px;
	}
	.pad {
		padding: 12px 14px;
	}
	.bar {
		display: flex;
		align-items: center;
		gap: 12px;
		flex-wrap: wrap;
	}
	.currency {
		display: flex;
		gap: 4px;
		padding: 4px 10px;
	}
	.coin {
		display: flex;
		align-items: center;
		gap: 2px;
	}
	.coin .label {
		font-size: 12px;
		font-weight: 650;
		letter-spacing: 0.06em;
		color: var(--muted);
	}
	.attune {
		display: flex;
		align-items: center;
		gap: 8px;
		padding: 0 14px;
		min-height: 52px;
	}
	.attune.over {
		color: var(--danger);
		border-color: var(--danger);
		background: var(--danger-soft);
	}
	.spacer {
		flex: 1;
	}
	.columns {
		display: grid;
		grid-template-columns: repeat(auto-fill, minmax(320px, 1fr));
		gap: 14px;
		align-items: start;
	}
	.drag-hint {
		margin: -6px 0;
		font-size: 13px;
		color: var(--accent);
	}
	.orphan {
		display: flex;
		align-items: center;
		gap: 8px;
	}
	.orphan :global(.item) {
		flex: 1;
	}
</style>
