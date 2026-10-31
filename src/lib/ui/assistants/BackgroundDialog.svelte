<script lang="ts">
	// Hintergrund-Assistent: alles, was zum Hintergrund gehört, in einem Schritt eintragen.
	import { ATTRIBUTES, GROUPS, STD, type AttributeKey } from '$lib/model/defaults';
	import { planBackground, type BackgroundInput } from '$lib/model/background';
	import { newId } from '$lib/model/ids';
	import { applyBackground } from '$lib/store/actions';
	import { sheet } from '$lib/store/sheet.svelte';
	import { ui } from '$lib/store/ui.svelte';
	import { sortedFields } from '../fields';
	import Modal from './Modal.svelte';

	let { onclose }: { onclose: () => void } = $props();
	const c = $derived(sheet.character!);
	const skills = $derived(sortedFields(c, { group: GROUPS.skills, includeHidden: true }).filter((f) => Object.values(c.proficiencies).some((p) => p.fieldId === f.id)));
	const containers = $derived(Object.values(c.containers).sort((a, b) => Number(a.equipped) - Number(b.equipped) || a.order - b.order));

	let name = $state('');
	let chosen = $state<string[]>([]);
	let tools = $state('');
	let languages = $state('');
	let incMode = $state<'none' | '21' | '111'>('none');
	let inc = $state<AttributeKey[]>(['str', 'dex', 'con']);
	let featureName = $state('');
	let featureDesc = $state('');
	let isFeat = $state(false);
	let equipment = $state('');
	let gold = $state(0);
	let story = $state('');
	let containerId = $state('');
	$effect.pre(() => {
		if (!containerId || !c.containers[containerId]) containerId = containers[0]?.id ?? STD.backpack;
	});

	const profLevel = (fieldId: string) => Object.values(c.proficiencies).find((p) => p.fieldId === fieldId)?.level ?? 0;

	function apply() {
		const increases =
			incMode === '21'
				? [
						{ attr: inc[0], amount: 2 },
						{ attr: inc[1], amount: 1 }
					]
				: incMode === '111'
					? inc.map((attr) => ({ attr, amount: 1 }))
					: [];
		const input: BackgroundInput = {
			name,
			skills: chosen,
			tools,
			languages,
			increases,
			feature: { name: featureName, description: featureDesc, isFeat },
			equipment,
			gold,
			story
		};
		const plan = planBackground(JSON.parse(JSON.stringify(c)), input, containerId, newId);
		applyBackground(plan, name);
		ui.toast(`Hintergrund „${name.trim() || 'Hintergrund'}“ eingetragen`, { label: 'Öffnen', run: () => ui.open({ kind: 'ability', id: plan.abilities[0].id }) });
		onclose();
	}
</script>

<Modal title="Hintergrund-Assistent" {onclose} width={640}>
	<p class="muted small">
		Trägt ein, was du sonst von Hand machen würdest: Übungen, eine Fähigkeit „Hintergrund“ (mit Attributserhöhungen als Modifikatoren),
		Merkmal oder Herkunftstalent, Ausrüstung und Gold. Keine Regelprüfung, alles bleibt danach frei änderbar – und ein Rückgängig nimmt alles zurück.
	</p>
	<label class="row"><span class="eyebrow">Name des Hintergrunds</span><input class="input" bind:value={name} placeholder="z. B. Akolyth" /></label>

	<fieldset>
		<legend class="eyebrow">Fertigkeiten (geübt) – üblich sind zwei</legend>
		<div class="skills">
			{#each skills as f (f.id)}
				<label class="check">
					<input type="checkbox" value={f.id} bind:group={chosen} />
					{f.name}{#if profLevel(f.id) >= 1}<span class="muted small">&nbsp;(schon geübt)</span>{/if}
				</label>
			{/each}
		</div>
	</fieldset>

	<div class="two">
		<label class="row"><span class="eyebrow">Werkzeuge</span><input class="input" bind:value={tools} placeholder="z. B. Kalligrafie-Werkzeug" /></label>
		<label class="row"><span class="eyebrow">Sprachen</span><input class="input" bind:value={languages} placeholder="z. B. Celestisch, Elfisch" /></label>
	</div>

	<fieldset>
		<legend class="eyebrow">Attributswerte erhöhen (Regeln 2024, optional)</legend>
		<div class="inc">
			<select class="select" bind:value={incMode} aria-label="Art der Erhöhung">
				<option value="none">keine</option>
				<option value="21">+2 / +1</option>
				<option value="111">+1 / +1 / +1</option>
			</select>
			{#if incMode !== 'none'}
				{#each incMode === '21' ? [0, 1] : [0, 1, 2] as i (i)}
					<select class="select attr" bind:value={inc[i]} aria-label="Attribut {i + 1}">
						{#each ATTRIBUTES as a (a.key)}<option value={a.key}>{incMode === '21' ? (i === 0 ? '+2 ' : '+1 ') : '+1 '}{a.name}</option>{/each}
					</select>
				{/each}
			{/if}
		</div>
	</fieldset>

	<fieldset>
		<legend class="eyebrow">Merkmal oder Herkunftstalent</legend>
		<div class="two">
			<input class="input" bind:value={featureName} placeholder="z. B. Unterschlupf der Gläubigen" aria-label="Name des Merkmals" />
			<label class="check"><input type="checkbox" bind:checked={isFeat} /> ist ein Talent</label>
		</div>
		<textarea class="textarea" rows="3" bind:value={featureDesc} placeholder="Beschreibung (Markdown)" aria-label="Beschreibung des Merkmals"></textarea>
	</fieldset>

	<div class="two">
		<label class="row grow"><span class="eyebrow">Ausrüstung – eine Zeile pro Gegenstand</span>
			<textarea class="textarea" rows="4" bind:value={equipment} placeholder={'Heiliges Symbol\n2x Kerze\nWeihrauch x5'}></textarea>
		</label>
		<div class="col">
			<label class="row"><span class="eyebrow">in Container</span>
				<select class="select" bind:value={containerId}>{#each containers as ct (ct.id)}<option value={ct.id}>{ct.name}</option>{/each}</select>
			</label>
			<label class="row"><span class="eyebrow">Gold dazu (GM)</span><input class="input num" type="number" step="any" bind:value={gold} /></label>
		</div>
	</div>

	<label class="row"><span class="eyebrow">Geschichte (wird an die Notiz „Hintergrund“ angehängt)</span>
		<textarea class="textarea" rows="3" bind:value={story}></textarea>
	</label>

	{#snippet footer()}
		<span class="spacer"></span>
		<button type="button" class="btn ghost" onclick={onclose}>Abbrechen</button>
		<button type="button" class="btn primary" onclick={apply}>Eintragen</button>
	{/snippet}
</Modal>

<style>
	.row {
		display: flex;
		flex-direction: column;
		gap: 4px;
	}
	fieldset {
		border: none;
		padding: 0;
		margin: 0;
		display: flex;
		flex-direction: column;
		gap: 6px;
	}
	.skills {
		display: grid;
		grid-template-columns: repeat(3, 1fr);
		gap: 0 8px;
	}
	.skills .check {
		min-height: 36px;
		font-size: 14px;
	}
	.two {
		display: flex;
		gap: 12px;
		align-items: flex-start;
	}
	.two > * {
		flex: 1;
	}
	.col {
		display: flex;
		flex-direction: column;
		gap: 8px;
		max-width: 200px;
	}
	.inc {
		display: flex;
		gap: 8px;
	}
	.inc .select {
		width: 150px;
	}
	.small {
		font-size: 13px;
		margin: 0;
	}
	.spacer {
		flex: 1;
	}
</style>
