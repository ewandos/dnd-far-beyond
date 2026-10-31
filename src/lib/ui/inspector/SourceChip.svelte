<script lang="ts">
	// Quelle eines Modifikators: Sprung zur Quelle und Schalter direkt im Panel.
	import type { Modifier } from '$lib/engine/types';
	import { PROFICIENCY_LABEL, setAbilityActive, toggleItemEquipped } from '$lib/store/actions';
	import { sheet } from '$lib/store/sheet.svelte';
	import { ui } from '$lib/store/ui.svelte';
	import Icon from '../components/Icon.svelte';
	import ProfMarker from '../components/ProfMarker.svelte';
	import Switch from '../components/Switch.svelte';

	let { source }: { source: Modifier['source'] } = $props();
	const c = $derived(sheet.character!);
	const item = $derived(source.kind === 'item' ? c.items[source.id] : undefined);
	const ability = $derived(source.kind === 'ability' ? c.abilities[source.id] : undefined);
	const prof = $derived(source.kind === 'proficiency' ? c.proficiencies[source.id] : undefined);
	const equipped = $derived(item ? !!c.containers[item.containerId]?.equipped : false);
</script>

<span class="chip-row">
	{#if item}
		<button type="button" class="chip" title="Item öffnen" onclick={() => ui.push({ kind: 'item', id: item.id })}>
			<Icon name="box" size={14} />
			<span class="label">{item.name}</span>
		</button>
		<Switch small checked={equipped} label={equipped ? 'Ablegen' : 'Ausrüsten'} onchange={() => toggleItemEquipped(item.id)} />
	{:else if ability}
		<button
			type="button"
			class="chip"
			title="{ability.kind === 'condition' ? 'Zustand' : 'Fähigkeit'} öffnen"
			onclick={() => ui.push({ kind: 'ability', id: ability.id })}
		>
			<Icon name={ability.kind === 'condition' ? 'sparkle' : 'book'} size={14} />
			<span class="label">{ability.name}</span>
		</button>
		<Switch small checked={ability.active} label={ability.active ? 'Ausschalten' : 'Einschalten'} onchange={(v) => setAbilityActive(ability.id, v)} />
	{:else if prof}
		<span class="chip static">Übung: {PROFICIENCY_LABEL[prof.level]}</span>
		<ProfMarker id={prof.id} />
	{:else if source.kind === 'field'}
		<span class="chip static">Feldeigen</span>
	{:else}
		<span class="chip static missing">Quelle fehlt</span>
	{/if}
</span>

<style>
	.chip-row {
		display: inline-flex;
		align-items: center;
		gap: 2px;
		min-width: 0;
	}
	.chip {
		display: inline-flex;
		align-items: center;
		gap: 5px;
		min-height: 30px;
		max-width: 190px;
		padding: 0 9px;
		border: 1px solid var(--border);
		border-radius: 15px;
		background: var(--surface);
		font-size: 12.5px;
		color: var(--text);
	}
	button.chip:hover {
		border-color: var(--accent);
		color: var(--accent);
	}
	.chip.static {
		background: transparent;
		color: var(--muted);
	}
	.chip.missing {
		color: var(--danger);
	}
	.label {
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
	}
</style>
