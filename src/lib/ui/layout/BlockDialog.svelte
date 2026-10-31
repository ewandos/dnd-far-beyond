<script lang="ts">
	// Baustein hinzufügen oder einstellen.
	import { untrack } from 'svelte';
	import type { ActionKind, Block, BlockType, CardListKind } from '$lib/engine/types';
	import { ACTION_KIND_LABEL, ACTION_KINDS } from '$lib/engine/actions';
	import { addContainer, addSpellList, addText, renameSpellList } from '$lib/store/actions';
	import { addBlock, BLOCK_LABEL, updateBlock } from '$lib/store/layoutActions';
	import { sheet } from '$lib/store/sheet.svelte';
	import { containerPath } from '../containers';
	import { groupedFields, groupNames } from '../fields';
	import FieldSelect from '../components/FieldSelect.svelte';
	import Icon from '../components/Icon.svelte';
	import { CARD_KIND_LABEL, DEFAULT_SIZE } from './blocks';

	let { tabId, block, onclose }: { tabId: string; block?: Block; onclose: () => void } = $props();

	const c = $derived(sheet.character!);
	const TYPES: { type: BlockType; text: string }[] = [
		{ type: 'field', text: 'Ein Zahlenwert, z. B. RK oder TP aktuell (optional mit −/+).' },
		{ type: 'fieldGroup', text: 'Mehrere Felder als Liste oder Kacheln, z. B. alle Fertigkeiten.' },
		{ type: 'counter', text: 'Kästchen zum Ankreuzen, z. B. Zauberplätze oder Trefferwürfel.' },
		{ type: 'container', text: 'Ein Inventar-Container mit Inhalt, z. B. Rucksack.' },
		{ type: 'cardList', text: 'Fähigkeiten, Zustände, ausgerüstete Items oder eine Zauberliste.' },
		{ type: 'text', text: 'Markdown-Notizen, z. B. Hintergrund oder Beziehungen.' },
		{ type: 'actions', text: 'Aktionen, Bonusaktionen, Reaktionen und Sonstiges – aus Items, Fähigkeiten und Zaubern.' }
	];

	let type = $state<BlockType | null>(null);
	let title = $state('');
	let cfg = $state<Record<string, unknown>>({});
	let source = $state<'group' | 'pick'>('group');
	let newName = $state('');

	// Beim Öffnen einmal aus dem Baustein übernehmen (nicht reaktiv, sonst überschreibt es Eingaben).
	$effect.pre(() => {
		const b = block;
		if (!b) return;
		const parsed = JSON.parse(JSON.stringify(b.config)) as Record<string, unknown>;
		untrack(() => {
			type = b.type;
			title = b.title ?? '';
			cfg = parsed;
			source = Array.isArray(parsed.fieldIds) || Array.isArray(parsed.counterIds) ? 'pick' : 'group';
		});
	});

	function choose(t: BlockType) {
		type = t;
		const firstContainer = Object.values(c.containers).sort((a, b) => a.order - b.order)[0];
		const firstText = Object.values(c.texts).sort((a, b) => a.order - b.order)[0];
		const defaults: Record<BlockType, Record<string, unknown>> = {
			field: { fieldId: '' },
			fieldGroup: { group: groupNames(c)[0], display: 'list' },
			counter: { group: counterGroups[0] ?? '' },
			container: { containerId: firstContainer?.id ?? '' },
			cardList: { kind: 'ability' },
			text: { textId: firstText?.id ?? '' },
			actions: { spellListIds: spellLists.slice(0, 1).map((l) => l.id), showStandard: true }
		};
		cfg = defaults[t];
		source = 'group';
	}

	const counterGroups = $derived([...new Set(Object.values(c.counters).map((x) => x.group).filter((g): g is string => !!g))]);
	const counters = $derived(Object.values(c.counters).sort((a, b) => a.order - b.order));
	const fieldGroups = $derived(groupedFields(c, { includeHidden: true }));
	const containers = $derived(
		Object.values(c.containers)
			.map((x) => ({ id: x.id, path: containerPath(c, x.id), equipped: x.equipped }))
			.sort((a, b) => a.path.localeCompare(b.path, 'de'))
	);
	const spellLists = $derived(Object.values(c.spellLists).sort((a, b) => a.order - b.order));
	const texts = $derived(Object.values(c.texts).sort((a, b) => a.order - b.order));

	function toggleIn(key: 'fieldIds' | 'counterIds', id: string, on: boolean) {
		const list = Array.isArray(cfg[key]) ? [...(cfg[key] as string[])] : [];
		cfg[key] = on ? [...list, id] : list.filter((x) => x !== id);
	}
	const picked = (key: 'fieldIds' | 'counterIds', id: string) => Array.isArray(cfg[key]) && (cfg[key] as string[]).includes(id);

	function setSource(s: 'group' | 'pick') {
		source = s;
		const key = type === 'counter' ? 'counterIds' : 'fieldIds';
		if (s === 'pick') {
			delete cfg.group;
			if (!Array.isArray(cfg[key])) cfg[key] = [];
		} else {
			delete cfg[key];
			cfg.group = type === 'counter' ? (counterGroups[0] ?? '') : groupNames(c)[0];
		}
	}

	const valid = $derived.by(() => {
		if (!type) return false;
		if (type === 'field') return !!cfg.fieldId && !!c.fields[cfg.fieldId as string];
		if (type === 'container') return !!c.containers[cfg.containerId as string];
		if (type === 'text') return !!c.texts[cfg.textId as string];
		return true;
	});

	function save() {
		if (!type || !valid) return;
		const config = JSON.parse(JSON.stringify(cfg));
		if (block) updateBlock(tabId, block.id, { config, title });
		else addBlock(tabId, type, config, DEFAULT_SIZE[type], title.trim() || undefined);
		onclose();
	}
</script>

<svelte:window onkeydown={(e) => e.key === 'Escape' && onclose()} />

<div class="backdrop" role="presentation" onclick={(e) => e.target === e.currentTarget && onclose()}>
	<div class="dialog card" role="dialog" aria-modal="true" aria-labelledby="block-dialog-title">
		<header>
			<h2 id="block-dialog-title" class="section-title">
				{block ? `${BLOCK_LABEL[block.type]} einstellen` : type ? `${BLOCK_LABEL[type]} hinzufügen` : 'Baustein hinzufügen'}
			</h2>
			<button type="button" class="btn ghost icon" aria-label="Schließen" onclick={onclose}><Icon name="x" /></button>
		</header>

		<div class="body">
			{#if !type}
				<div class="types">
					{#each TYPES as t (t.type)}
						<button type="button" class="type" onclick={() => choose(t.type)}>
							<strong>{BLOCK_LABEL[t.type]}</strong>
							<span class="muted">{t.text}</span>
						</button>
					{/each}
				</div>
			{:else}
				{#if type === 'field'}
					<label class="row"><span class="eyebrow">Feld</span>
						<FieldSelect value={(cfg.fieldId as string) || null} onchange={(v) => (cfg.fieldId = v ?? '')} noneLabel="Feld wählen …" />
					</label>
					<label class="check"><input type="checkbox" checked={!!cfg.stepper} onchange={(e) => (cfg.stepper = (e.currentTarget as HTMLInputElement).checked || undefined)} /> −/+ zum schnellen Ändern (z. B. TP)</label>
				{:else if type === 'fieldGroup' || type === 'counter'}
					{@const key = type === 'counter' ? 'counterIds' : 'fieldIds'}
					<div class="segmented" role="radiogroup" aria-label="Auswahl">
						<button type="button" role="radio" aria-checked={source === 'group'} class:on={source === 'group'} onclick={() => setSource('group')}>Ganze Gruppe</button>
						<button type="button" role="radio" aria-checked={source === 'pick'} class:on={source === 'pick'} onclick={() => setSource('pick')}>Eigene Auswahl</button>
					</div>
					{#if source === 'group'}
						<label class="row"><span class="eyebrow">Gruppe</span>
							<select class="select" value={cfg.group as string} onchange={(e) => (cfg.group = (e.currentTarget as HTMLSelectElement).value)}>
								{#each type === 'counter' ? counterGroups : groupNames(c) as g (g)}<option value={g}>{g}</option>{/each}
							</select>
						</label>
						<p class="muted small">Neue {type === 'counter' ? 'Zähler' : 'Felder'} dieser Gruppe erscheinen automatisch.</p>
					{:else}
						<div class="picklist">
							{#if type === 'counter'}
								{#each counters as ct (ct.id)}
									<label class="check"><input type="checkbox" checked={picked(key, ct.id)} onchange={(e) => toggleIn(key, ct.id, (e.currentTarget as HTMLInputElement).checked)} /> {ct.name}</label>
								{/each}
							{:else}
								{#each fieldGroups as g (g.name)}
									<span class="eyebrow">{g.name}</span>
									{#each g.fields as f (f.id)}
										<label class="check"><input type="checkbox" checked={picked(key, f.id)} onchange={(e) => toggleIn(key, f.id, (e.currentTarget as HTMLInputElement).checked)} /> {f.name}</label>
									{/each}
								{/each}
							{/if}
						</div>
					{/if}
					{#if type === 'fieldGroup'}
						<div class="segmented" role="radiogroup" aria-label="Darstellung">
							<button type="button" role="radio" aria-checked={cfg.display !== 'tiles'} class:on={cfg.display !== 'tiles'} onclick={() => (cfg.display = 'list')}>Liste</button>
							<button type="button" role="radio" aria-checked={cfg.display === 'tiles'} class:on={cfg.display === 'tiles'} onclick={() => (cfg.display = 'tiles')}>Kacheln</button>
						</div>
					{/if}
				{:else if type === 'container'}
					<label class="row"><span class="eyebrow">Container</span>
						<select class="select" value={cfg.containerId as string} onchange={(e) => (cfg.containerId = (e.currentTarget as HTMLSelectElement).value)}>
							{#each containers as ct (ct.id)}<option value={ct.id}>{ct.path}{ct.equipped ? ' (ausgerüstet)' : ''}</option>{/each}
						</select>
					</label>
					<div class="new">
						<input class="input" placeholder="Neuer Container, z. B. Satteltaschen" aria-label="Neuer Container" bind:value={newName} />
						<button type="button" class="btn" disabled={!newName.trim()} onclick={() => { cfg.containerId = addContainer(newName); newName = ''; }}>Anlegen</button>
					</div>
				{:else if type === 'cardList'}
					<label class="row"><span class="eyebrow">Inhalt</span>
						<select
							class="select"
							value={cfg.kind as string}
							onchange={(e) => {
								cfg.kind = (e.currentTarget as HTMLSelectElement).value as CardListKind;
								if (cfg.kind === 'spells' && cfg.spellListId === undefined) cfg.spellListId = spellLists[0]?.id;
							}}
						>
							{#each Object.entries(CARD_KIND_LABEL) as [k, label] (k)}<option value={k}>{k === 'equipped' ? 'Ausgerüstete Items' : label}</option>{/each}
						</select>
					</label>
					{#if cfg.kind === 'spells'}
						<label class="row"><span class="eyebrow">Zauberliste</span>
							<select class="select" value={(cfg.spellListId as string) ?? ''} onchange={(e) => (cfg.spellListId = (e.currentTarget as HTMLSelectElement).value || undefined)}>
								<option value="">Alle Zauber</option>
								{#each spellLists as l (l.id)}<option value={l.id}>{l.name}</option>{/each}
							</select>
						</label>
						{#if cfg.spellListId && c.spellLists[cfg.spellListId as string]}
							{@const list = c.spellLists[cfg.spellListId as string]}
							<label class="row"><span class="eyebrow">Name der Liste</span>
								<input class="input" value={list.name} oninput={(e) => renameSpellList(list.id, (e.currentTarget as HTMLInputElement).value)} />
							</label>
						{/if}
						<div class="new">
							<input class="input" placeholder="Neue Liste, z. B. Aus dem Stab" aria-label="Neue Zauberliste" bind:value={newName} />
							<button type="button" class="btn" disabled={!newName.trim()} onclick={() => { cfg.spellListId = addSpellList(newName); newName = ''; }}>Anlegen</button>
						</div>
					{/if}
					{#if cfg.kind !== 'equipped'}
						<label class="check"><input type="checkbox" checked={!!cfg.showDescriptions} onchange={(e) => (cfg.showDescriptions = (e.currentTarget as HTMLInputElement).checked || undefined)} /> Beschreibungen anzeigen</label>
					{/if}
				{:else if type === 'actions'}
					{@const kinds = (cfg.kinds as ActionKind[] | undefined) ?? []}
					{@const listIds = (cfg.spellListIds as string[] | undefined) ?? []}
					<fieldset class="row">
						<span class="eyebrow">Arten (keine Auswahl = alle)</span>
						<div class="inline-checks">
							{#each ACTION_KINDS as k (k)}
								<label class="check"><input type="checkbox" checked={kinds.includes(k)} onchange={(e) => (cfg.kinds = (e.currentTarget as HTMLInputElement).checked ? [...kinds, k] : kinds.filter((x) => x !== k))} /> {ACTION_KIND_LABEL[k]}</label>
							{/each}
						</div>
					</fieldset>
					<fieldset class="row">
						<span class="eyebrow">Zauber aus diesen Listen aufnehmen</span>
						<div class="inline-checks">
							{#each spellLists as l (l.id)}
								<label class="check"><input type="checkbox" checked={listIds.includes(l.id)} onchange={(e) => (cfg.spellListIds = (e.currentTarget as HTMLInputElement).checked ? [...listIds, l.id] : listIds.filter((x) => x !== l.id))} /> {l.name}</label>
							{/each}
							{#if !spellLists.length}<span class="muted small">Keine Zauberlisten.</span>{/if}
						</div>
					</fieldset>
					<label class="check"><input type="checkbox" checked={cfg.showStandard !== false} onchange={(e) => (cfg.showStandard = (e.currentTarget as HTMLInputElement).checked)} /> Allgemeine Aktionen zeigen (Spurt, Ausweichen …)</label>
					<label class="check"><input type="checkbox" checked={!!cfg.hideInactive} onchange={(e) => (cfg.hideInactive = (e.currentTarget as HTMLInputElement).checked || undefined)} /> Nicht verfügbare ausblenden (z. B. Items im Rucksack)</label>
				{:else if type === 'text'}
					<label class="row"><span class="eyebrow">Notiz</span>
						<select class="select" value={cfg.textId as string} onchange={(e) => (cfg.textId = (e.currentTarget as HTMLSelectElement).value)}>
							{#each texts as t (t.id)}<option value={t.id}>{t.title}</option>{/each}
						</select>
					</label>
					<div class="new">
						<input class="input" placeholder="Neue Notiz, z. B. Beziehungen" aria-label="Neue Notiz" bind:value={newName} />
						<button type="button" class="btn" disabled={!newName.trim()} onclick={() => { cfg.textId = addText(newName); newName = ''; }}>Anlegen</button>
					</div>
				{/if}

				{#if type !== 'container'}
					<label class="row"><span class="eyebrow">Überschrift</span>
						<input class="input" placeholder="leer = automatisch" bind:value={title} />
					</label>
				{/if}
			{/if}
		</div>

		{#if type}
			<footer>
				{#if !block}<button type="button" class="btn ghost" onclick={() => (type = null)}><Icon name="back" size={18} /> Andere Art</button>{/if}
				<span class="spacer"></span>
				<button type="button" class="btn ghost" onclick={onclose}>Abbrechen</button>
				<button type="button" class="btn primary" disabled={!valid} onclick={save}>{block ? 'Übernehmen' : 'Hinzufügen'}</button>
			</footer>
		{/if}
	</div>
</div>

<style>
	.backdrop {
		position: fixed;
		inset: 0;
		z-index: 70;
		display: flex;
		align-items: center;
		justify-content: center;
		background: rgb(20 16 12 / 0.4);
		padding: 24px;
	}
	.dialog {
		width: 560px;
		max-height: calc(100vh - 48px);
		display: flex;
		flex-direction: column;
		box-shadow: var(--shadow-lg);
	}
	header,
	footer {
		display: flex;
		align-items: center;
		gap: 8px;
		padding: 10px 12px 10px 18px;
	}
	header {
		justify-content: space-between;
		border-bottom: 1px solid var(--border);
	}
	footer {
		border-top: 1px solid var(--border);
	}
	.spacer {
		flex: 1;
	}
	.body {
		padding: 16px 18px;
		overflow-y: auto;
		display: flex;
		flex-direction: column;
		gap: 12px;
	}
	.types {
		display: grid;
		grid-template-columns: 1fr 1fr;
		gap: 8px;
	}
	.type {
		display: flex;
		flex-direction: column;
		gap: 4px;
		padding: 12px;
		border: 1px solid var(--border);
		border-radius: var(--radius);
		background: var(--surface);
		text-align: left;
		font-size: 13px;
	}
	.type strong {
		font-family: var(--font-display);
		font-size: 16px;
	}
	.type:hover {
		border-color: var(--accent);
		background: var(--accent-soft);
	}
	.row {
		display: flex;
		flex-direction: column;
		gap: 4px;
	}
	.new {
		display: flex;
		gap: 8px;
	}
	fieldset.row {
		border: none;
		margin: 0;
		padding: 0;
	}
	.inline-checks {
		display: flex;
		flex-wrap: wrap;
		gap: 0 16px;
	}
	.picklist {
		display: flex;
		flex-direction: column;
		max-height: 300px;
		overflow-y: auto;
		padding: 4px 8px;
		border: 1px solid var(--border);
		border-radius: var(--radius-sm);
	}
	.picklist .eyebrow {
		margin-top: 8px;
	}
	.picklist .check {
		min-height: 36px;
	}
	.small {
		font-size: 13px;
		margin: 0;
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
	}
	.segmented button:last-child {
		border-right: none;
	}
	.segmented button.on {
		background: var(--accent);
		color: var(--accent-text);
		font-weight: 600;
	}
</style>
