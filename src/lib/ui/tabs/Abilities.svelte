<script lang="ts">
	import type { AbilityKind } from '$lib/engine/types';
	import { sheet } from '$lib/store/sheet.svelte';
	import AbilityCard from '../components/AbilityCard.svelte';
	import QuickCreate from '../components/QuickCreate.svelte';

	const c = $derived(sheet.character!);
	const list = (kind: AbilityKind) =>
		Object.values(c.abilities)
			.filter((a) => a.kind === kind)
			.sort((a, b) => (a.origin ?? '').localeCompare(b.origin ?? '', 'de') || a.order - b.order);
	let showDescriptions = $state(true);
</script>

<div class="toolbar">
	<label class="check">
		<input type="checkbox" bind:checked={showDescriptions} />
		Beschreibungen anzeigen
	</label>
</div>
<div class="columns">
	{#each [{ kind: 'ability', title: 'Fähigkeiten', empty: 'Noch keine Fähigkeiten – Klassen-, Volks- oder Story-Merkmale hier eintragen.' }, { kind: 'condition', title: 'Zustände', empty: 'Keine Zustände. Krankheiten, Flüche, Segen oder Konzentration hier eintragen.' }] as col (col.kind)}
		{@const items = list(col.kind as AbilityKind)}
		<section class="card pad">
			<h2 class="section-title">{col.title} <span class="count muted">{items.length}</span></h2>
			<QuickCreate kind={col.kind as AbilityKind} />
			<div class="list">
				{#each items as a (a.id)}<AbilityCard id={a.id} showDescription={showDescriptions} />{/each}
				{#if !items.length}<p class="empty">{col.empty}</p>{/if}
			</div>
		</section>
	{/each}
</div>

<style>
	.toolbar {
		display: flex;
		justify-content: flex-end;
		margin: -8px 0 4px;
	}
	.columns {
		display: grid;
		grid-template-columns: 1fr 1fr;
		gap: 14px;
		align-items: start;
	}
	.pad {
		padding: 12px 14px;
		display: flex;
		flex-direction: column;
		gap: 10px;
	}
	.count {
		font-family: var(--font-ui);
		font-size: 13px;
		font-weight: 500;
	}
</style>
