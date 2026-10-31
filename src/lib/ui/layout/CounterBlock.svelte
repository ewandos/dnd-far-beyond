<script lang="ts">
	// Zähler zum Ankreuzen. „Anzahl“ schaltet −/+ ein – auch im Spielmodus, weil das ein Wert ist.
	import type { CounterBlockConfig } from '$lib/engine/types';
	import { sheet } from '$lib/store/sheet.svelte';
	import CounterBoxes from '../components/CounterBoxes.svelte';

	let { config }: { config: CounterBlockConfig } = $props();
	const c = $derived(sheet.character!);
	let editing = $state(false);

	const counters = $derived.by(() => {
		if (config.counterIds?.length) return config.counterIds.map((id) => c.counters[id]).filter(Boolean);
		if (config.group) return Object.values(c.counters).filter((x) => x.group === config.group).sort((a, b) => a.order - b.order);
		return [];
	});
	const visible = $derived(editing ? counters : counters.filter((x) => x.max > 0));
	const prefix = $derived(config.group ? config.group + ' ' : '');
	const label = (name: string) => (prefix && name.startsWith(prefix) ? name.slice(prefix.length) : name).replace(/^Todesrettungswürfe – /, 'Todesrettung: ');
</script>

<div class="counters">
	{#each visible as ct (ct.id)}
		<CounterBoxes id={ct.id} label={label(ct.name)} editable={editing} />
	{/each}
	{#if !visible.length}
		<p class="empty">{counters.length ? 'Alle auf 0 – über „Anzahl“ Kästchen hinzufügen.' : 'Keine Zähler.'}</p>
	{/if}
	{#if counters.length}
		<button type="button" class="btn ghost small toggle" onclick={() => (editing = !editing)}>{editing ? 'Fertig' : 'Anzahl ändern'}</button>
	{/if}
</div>

<style>
	.counters {
		display: flex;
		flex-direction: column;
	}
	.toggle {
		align-self: flex-end;
		color: var(--muted);
		margin-top: 2px;
	}
	.empty {
		margin: 0;
	}
</style>
