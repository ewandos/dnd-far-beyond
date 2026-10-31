<script lang="ts">
	// Eine Aktion bearbeiten: Art, Quelle, Angriff, Schaden, Rettungswurf, Nutzungen.
	import { ACTION_KIND_SINGULAR, ACTION_KINDS, resolveStats } from '$lib/engine/actions';
	import type { CharAction } from '$lib/engine/types';
	import { addUsageCounter, deleteAction, deleteCounter, renameCounter, setActionSource, updateAction } from '$lib/store/actions';
	import { sheet } from '$lib/store/sheet.svelte';
	import { ui } from '$lib/store/ui.svelte';
	import CounterBoxes from '../components/CounterBoxes.svelte';
	import FormulaInput from '../components/FormulaInput.svelte';
	import Icon from '../components/Icon.svelte';
	import MarkdownEditor from '../components/MarkdownEditor.svelte';

	let { id }: { id: string } = $props();
	const c = $derived(sheet.character!);
	const a = $derived(c.actions[id]);
	const stats = $derived(a && sheet.evaluation ? resolveStats(c, sheet.evaluation, a) : {});
	const items = $derived(Object.values(c.items).sort((x, y) => x.name.localeCompare(y.name, 'de')));
	const abilities = $derived(Object.values(c.abilities).sort((x, y) => x.name.localeCompare(y.name, 'de')));
	const sourceKey = $derived(a?.source ? `${a.source.kind}:${a.source.id}` : '');
	let confirmDelete = $state(false);

	function setSource(key: string) {
		if (!key) return setActionSource(id, undefined);
		const [kind, sid] = key.split(':') as ['item' | 'ability', string];
		setActionSource(id, { kind, id: sid });
	}
	const text = (key: keyof CharAction) => (a?.[key] as string | undefined) ?? '';
</script>

{#if a}
	<div class="inspector" data-inspect-action={id}>
		<header>
			<span class="eyebrow">{ACTION_KIND_SINGULAR[a.kind]}{a.standard ? ' · allgemein' : ''}</span>
			<input class="input inline title" value={a.name} aria-label="Name" oninput={(e) => updateAction(id, 'name', (e.currentTarget as HTMLInputElement).value)} />
		</header>

		<div class="segmented" role="radiogroup" aria-label="Art">
			{#each ACTION_KINDS as k (k)}
				<button type="button" role="radio" aria-checked={a.kind === k} class:on={a.kind === k} onclick={() => updateAction(id, 'kind', k)}>{ACTION_KIND_SINGULAR[k]}</button>
			{/each}
		</div>

		<label class="row">
			<span class="eyebrow">Gehört zu</span>
			<div class="source">
				<select class="select" value={sourceKey} aria-label="Quelle" onchange={(e) => setSource((e.currentTarget as HTMLSelectElement).value)}>
					<option value="">— frei (immer verfügbar) —</option>
					{#if items.length}<optgroup label="Items">{#each items as i (i.id)}<option value="item:{i.id}">{i.name}</option>{/each}</optgroup>{/if}
					{#if abilities.length}<optgroup label="Fähigkeiten & Zustände">{#each abilities as x (x.id)}<option value="ability:{x.id}">{x.name}</option>{/each}</optgroup>{/if}
				</select>
				{#if a.source}
					<button type="button" class="btn ghost small" onclick={() => a.source && ui.push({ kind: a.source.kind, id: a.source.id })}>Öffnen</button>
				{/if}
			</div>
			<span class="muted small">An einem Item erscheint die Aktion nur aktiv, solange es ausgerüstet ist.</span>
		</label>

		<section class="grid">
			<label class="row">
				<span class="eyebrow">Angriffsbonus {#if stats.attack}<strong class="val" class:error={!!stats.attack.error}>{stats.attack.text}</strong>{/if}</span>
				<FormulaInput value={text('attack')} onchange={(v) => updateAction(id, 'attack', v)} placeholder="z. B. @STR-Mod + @Übungsbonus" label="Angriffsbonus" />
			</label>
			<label class="row">
				<span class="eyebrow">Schaden {#if stats.damage}<strong class="val" class:error={!!stats.damage.error}>{stats.damage.text}</strong>{/if}</span>
				<FormulaInput value={text('damage')} onchange={(v) => updateAction(id, 'damage', v)} placeholder="z. B. 1d8 + @STR-Mod" label="Schaden" kind="dice" />
			</label>
			<label class="row">
				<span class="eyebrow">Schadensart</span>
				<input class="input" value={text('damageType')} placeholder="z. B. Hieb, Feuer" oninput={(e) => updateAction(id, 'damageType', (e.currentTarget as HTMLInputElement).value)} />
			</label>
			<label class="row">
				<span class="eyebrow">Reichweite</span>
				<input class="input" value={text('range')} placeholder="z. B. 1,5 m oder 24/96 m" oninput={(e) => updateAction(id, 'range', (e.currentTarget as HTMLInputElement).value)} />
			</label>
			<label class="row">
				<span class="eyebrow">Rettungswurf-SG {#if stats.save}<strong class="val" class:error={!!stats.save.error}>{stats.save.text}</strong>{/if}</span>
				<FormulaInput value={text('saveDc')} onchange={(v) => updateAction(id, 'saveDc', v)} placeholder="z. B. @Zauber-SG" label="Rettungswurf-SG" />
			</label>
			<label class="row">
				<span class="eyebrow">Rettungswurf-Attribut</span>
				<input class="input" value={text('saveAbility')} placeholder="z. B. GES" oninput={(e) => updateAction(id, 'saveAbility', (e.currentTarget as HTMLInputElement).value)} />
			</label>
		</section>
		<p class="muted small">Alles optional. Formeln mit <code>@</code> wie bei Modifikatoren – die App würfelt nicht und prüft keine Regeln.</p>

		{#if a.kind === 'reaction' || a.trigger}
			<label class="row">
				<span class="eyebrow">Auslöser</span>
				<input class="input" value={text('trigger')} placeholder="z. B. Du wirst von einem Angriff getroffen." oninput={(e) => updateAction(id, 'trigger', (e.currentTarget as HTMLInputElement).value)} />
			</label>
		{/if}

		<section>
			<span class="eyebrow">Beschreibung</span>
			<MarkdownEditor value={a.description} onchange={(v) => updateAction(id, 'description', v)} placeholder="Markdown …" />
		</section>

		<section>
			<span class="eyebrow">Nutzungs-Kästchen</span>
			{#if a.counterId && c.counters[a.counterId]}
				{@const counterId = a.counterId}
				<div class="usage">
					<input class="input inline" value={c.counters[counterId].name} aria-label="Name des Zählers" oninput={(e) => renameCounter(counterId, (e.currentTarget as HTMLInputElement).value)} />
					<CounterBoxes id={counterId} label="" editable />
					<button type="button" class="btn ghost small icon" aria-label="Nutzungs-Kästchen entfernen" onclick={() => deleteCounter(counterId)}><Icon name="trash" size={16} /></button>
				</div>
			{:else}
				<div><button type="button" class="btn ghost small" onclick={() => addUsageCounter({ kind: 'action', id }, 1)}><Icon name="plus" size={16} /> Kästchen hinzufügen</button></div>
			{/if}
		</section>

		<footer>
			<span class="spacer"></span>
			{#if confirmDelete}
				<button type="button" class="btn danger small" onclick={() => { deleteAction(id); ui.back(); }}>Wirklich löschen</button>
				<button type="button" class="btn ghost small" onclick={() => (confirmDelete = false)}>Abbrechen</button>
			{:else}
				<button type="button" class="btn ghost danger small" onclick={() => (confirmDelete = true)}><Icon name="trash" size={16} /> Aktion löschen</button>
			{/if}
		</footer>
	</div>
{:else}
	<p class="empty">Diese Aktion existiert nicht mehr.</p>
{/if}

<style>
	.inspector {
		display: flex;
		flex-direction: column;
		gap: 14px;
	}
	header {
		display: flex;
		flex-direction: column;
		gap: 2px;
	}
	.title {
		font-family: var(--font-display);
		font-size: 24px;
		font-weight: 600;
		margin-left: -6px;
		width: calc(100% + 6px);
	}
	.segmented {
		display: flex;
		border: 1px solid var(--border);
		border-radius: var(--radius-sm);
		overflow: hidden;
	}
	.segmented button {
		flex: 1;
		min-height: 40px;
		border: none;
		border-right: 1px solid var(--border);
		background: var(--surface);
		font-size: 13.5px;
	}
	.segmented button:last-child {
		border-right: none;
	}
	.segmented button.on {
		background: var(--accent);
		color: var(--accent-text);
		font-weight: 600;
	}
	.row {
		display: flex;
		flex-direction: column;
		gap: 4px;
	}
	.source {
		display: flex;
		gap: 6px;
	}
	.grid {
		display: grid;
		grid-template-columns: 1fr 1fr;
		gap: 10px 12px;
	}
	.val {
		margin-left: 6px;
		color: var(--accent);
		letter-spacing: 0;
		text-transform: none;
		font-size: 12.5px;
	}
	.val.error {
		color: var(--danger);
	}
	.usage {
		display: flex;
		align-items: center;
		gap: 8px;
		flex-wrap: wrap;
	}
	.usage .input {
		flex: 1;
		min-width: 140px;
	}
	footer {
		display: flex;
		align-items: center;
		gap: 8px;
		padding-top: 12px;
		border-top: 1px solid var(--border);
	}
	.spacer {
		flex: 1;
	}
	.small {
		font-size: 13px;
		margin: 0;
	}
</style>
