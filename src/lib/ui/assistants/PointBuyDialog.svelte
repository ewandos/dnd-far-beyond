<script lang="ts">
	// Point-Buy-Rechner: Kosten nach Standardtabelle, Budget frei wählbar. Nichts wird erzwungen.
	import { ATTRIBUTES, STD, type AttributeKey } from '$lib/model/defaults';
	import { abilityModifier, POINT_BUY_BUDGET, POINT_BUY_MAX, POINT_BUY_MIN, pointCost, totalCost } from '$lib/model/pointbuy';
	import { applyAttributeScores } from '$lib/store/actions';
	import { sheet } from '$lib/store/sheet.svelte';
	import { ui } from '$lib/store/ui.svelte';
	import { formatSigned } from '../format';
	import Icon from '../components/Icon.svelte';
	import NumberInput from '../components/NumberInput.svelte';
	import Modal from './Modal.svelte';

	let { onclose }: { onclose: () => void } = $props();
	const c = sheet.character!;

	// Frischer Charakter (alle Werte 10): bei 8 beginnen, sonst bei den aktuellen Werten.
	const fresh = ATTRIBUTES.every((a) => (c.fields[STD.attr(a.key)]?.base ?? 10) === 10);
	const start = (k: AttributeKey) => {
		const v = c.fields[STD.attr(k)]?.base ?? 8;
		return !fresh && v >= POINT_BUY_MIN && v <= POINT_BUY_MAX ? v : 8;
	};
	let scores = $state<Record<AttributeKey, number>>(Object.fromEntries(ATTRIBUTES.map((a) => [a.key, start(a.key)])) as Record<AttributeKey, number>);
	let bonus = $state<Record<AttributeKey, number>>(Object.fromEntries(ATTRIBUTES.map((a) => [a.key, 0])) as Record<AttributeKey, number>);
	let budget = $state(POINT_BUY_BUDGET);
	let setMods = $state(true);

	const cost = $derived(totalCost(ATTRIBUTES.map((a) => scores[a.key])));
	const remaining = $derived(budget - cost.cost);

	function apply() {
		const finals = Object.fromEntries(ATTRIBUTES.map((a) => [a.key, scores[a.key] + bonus[a.key]])) as Record<AttributeKey, number>;
		const mods = setMods ? (Object.fromEntries(ATTRIBUTES.map((a) => [a.key, abilityModifier(finals[a.key])])) as Record<AttributeKey, number>) : undefined;
		applyAttributeScores(finals, mods);
		ui.toast('Attributswerte übernommen');
		onclose();
	}
</script>

<Modal title="Point-Buy-Rechner" {onclose} width={600}>
	<p class="muted small">
		Standardkosten: 8 = 0 … 13 = 5, 14 = 7, 15 = 9. Boni aus Volk oder Hintergrund in der Spalte „Bonus“ – oder später als Modifikatoren,
		dann bleibt ihre Herkunft sichtbar.
	</p>
	<table>
		<thead><tr><th>Attribut</th><th>Kauf</th><th class="r">Kosten</th><th>Bonus</th><th class="r">Ergebnis</th><th class="r">Mod</th></tr></thead>
		<tbody>
			{#each ATTRIBUTES as a (a.key)}
				{@const pc = pointCost(scores[a.key])}
				{@const fin = scores[a.key] + bonus[a.key]}
				<tr>
					<td><strong>{a.name}</strong> <span class="muted small">{a.long}</span></td>
					<td>
						<div class="step">
							<button type="button" class="btn small icon" aria-label="{a.name} senken" disabled={scores[a.key] <= POINT_BUY_MIN} onclick={() => scores[a.key]--}><Icon name="minus" size={16} /></button>
							<span class="num val">{scores[a.key]}</span>
							<button type="button" class="btn small icon" aria-label="{a.name} erhöhen" disabled={scores[a.key] >= POINT_BUY_MAX} onclick={() => scores[a.key]++}><Icon name="plus" size={16} /></button>
						</div>
					</td>
					<td class="r num">{pc ?? '–'}</td>
					<td><NumberInput value={bonus[a.key]} onchange={(v) => (bonus[a.key] = v)} label="Bonus {a.name}" width="60px" /></td>
					<td class="r num"><strong>{fin}</strong></td>
					<td class="r num">{formatSigned(abilityModifier(fin))}</td>
				</tr>
			{/each}
		</tbody>
	</table>
	<div class="summary" class:over={remaining < 0}>
		<label class="budget">Budget <NumberInput value={budget} onchange={(v) => (budget = v)} label="Budget" width="64px" /></label>
		<span>Ausgegeben <strong class="num">{cost.cost}</strong></span>
		<span>Übrig <strong class="num">{remaining}</strong></span>
		{#if remaining < 0}<span class="warn"><Icon name="alert" size={16} /> Budget überschritten – nur ein Hinweis</span>{/if}
	</div>
	<label class="check"><input type="checkbox" bind:checked={setMods} /> Attributsmodifikatoren mit eintragen (⌊(Wert − 10) / 2⌋)</label>

	{#snippet footer()}
		<span class="spacer"></span>
		<button type="button" class="btn ghost" onclick={onclose}>Abbrechen</button>
		<button type="button" class="btn primary" onclick={apply}>Übernehmen</button>
	{/snippet}
</Modal>

<style>
	table {
		width: 100%;
		border-collapse: collapse;
	}
	th {
		text-align: left;
		font-size: 11px;
		letter-spacing: 0.08em;
		text-transform: uppercase;
		color: var(--muted);
		padding: 4px;
	}
	td {
		padding: 3px 4px;
		border-top: 1px solid color-mix(in srgb, var(--border) 60%, transparent);
	}
	.r {
		text-align: right;
	}
	.step {
		display: flex;
		align-items: center;
		gap: 4px;
	}
	.val {
		width: 26px;
		text-align: center;
		font-weight: 600;
		font-size: 17px;
	}
	.summary {
		display: flex;
		align-items: center;
		gap: 18px;
		padding: 8px 12px;
		border-radius: var(--radius-sm);
		background: var(--surface-2);
	}
	.summary.over {
		background: var(--danger-soft);
	}
	.budget {
		display: flex;
		align-items: center;
		gap: 6px;
	}
	.warn {
		display: inline-flex;
		align-items: center;
		gap: 4px;
		color: var(--danger);
		font-size: 13px;
	}
	.small {
		font-size: 13px;
		margin: 0;
	}
	.spacer {
		flex: 1;
	}
</style>
