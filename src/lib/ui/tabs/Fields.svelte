<script lang="ts">
	// Alle Felder verwalten: eigene Felder anlegen, umbenennen, gruppieren, ausblenden, löschen.
	import { GROUPS } from '$lib/model/defaults';
	import {
		addCounter,
		addField,
		addSpellList,
		addText,
		deleteSpellList,
		deleteText,
		renameSpellList,
		updateText,
		deleteCounter,
		deleteModifier,
		renameCounter,
		setFieldBase,
		updateField,
		updateModifier
	} from '$lib/store/actions';
	import { sheet } from '$lib/store/sheet.svelte';
	import { ui } from '$lib/store/ui.svelte';
	import { toDisplayExpr } from '$lib/engine/formula';
	import { groupedFields, groupNames } from '../fields';
	import { OP_SYMBOL } from '../format';
	import CounterBoxes from '../components/CounterBoxes.svelte';
	import FieldSelect from '../components/FieldSelect.svelte';
	import FieldValue from '../components/FieldValue.svelte';
	import Icon from '../components/Icon.svelte';
	import NumberInput from '../components/NumberInput.svelte';

	const c = $derived(sheet.character!);
	const ev = $derived(sheet.evaluation!);
	const groups = $derived(groupedFields(c, { includeHidden: true }));
	const allGroups = $derived(groupNames(c));
	const unassigned = $derived(ev.unassigned.map((id) => c.modifiers[id]).filter(Boolean));
	const counters = $derived(Object.values(c.counters).sort((a, b) => a.order - b.order));

	let newName = $state('');
	let newGroup = $state<string>(GROUPS.custom);
	let newBase = $state(0);
	let filter = $state('');
	let counterName = $state('');
	let listName = $state('');
	let textName = $state('');
	let confirmDelete = $state<string | null>(null);
	const spellLists = $derived(Object.values(c.spellLists).sort((a, b) => a.order - b.order));
	const texts = $derived(Object.values(c.texts).sort((a, b) => a.order - b.order));
	/** Wird die Liste bzw. Notiz in einem Baustein verwendet? */
	const usedIn = (key: 'spellListId' | 'textId', id: string) =>
		c.layout.tabs.filter((t) => t.blocks.some((b) => b.config[key] === id)).map((t) => t.name);

	function create() {
		if (!newName.trim()) return;
		const id = addField({ name: newName, group: newGroup, base: newBase });
		newName = '';
		newBase = 0;
		ui.toast('Feld angelegt', { label: 'Öffnen', run: () => ui.open({ kind: 'field', id }) });
	}

	function sourceName(m: { source: { kind: string; id: string } }) {
		if (m.source.kind === 'item') return c.items[m.source.id]?.name;
		if (m.source.kind === 'ability') return c.abilities[m.source.id]?.name;
		return 'Feldeigen';
	}
	const match = (name: string) => !filter.trim() || name.toLowerCase().includes(filter.trim().toLowerCase());
</script>

<div class="fields">
	<section class="card pad exchange">
		<div>
			<h2 class="section-title">Austausch</h2>
			<p class="muted small">Items, Fähigkeiten, Zustände und Zauber als Datei weitergeben oder vom SL bzw. aus 5eTools übernehmen.</p>
		</div>
		<button type="button" class="btn" onclick={() => (ui.dialog = 'import')}><Icon name="upload" size={18} /> Importieren</button>
		<button type="button" class="btn" onclick={() => (ui.dialog = 'export')}><Icon name="download" size={18} /> Exportieren</button>
	</section>

	<section class="card pad">
		<h2 class="section-title">Eigenes Feld anlegen</h2>
		<form
			class="create"
			onsubmit={(e) => {
				e.preventDefault();
				create();
			}}
		>
			<input class="input" placeholder="Name, z. B. Krankheitsfortschritt" aria-label="Feldname" bind:value={newName} />
			<input class="input group" list="group-names" placeholder="Gruppe" aria-label="Gruppe" bind:value={newGroup} />
			<datalist id="group-names">
				{#each allGroups as g (g)}<option value={g}></option>{/each}
			</datalist>
			<NumberInput value={newBase} onchange={(v) => (newBase = v)} label="Basiswert" />
			<button type="submit" class="btn primary" disabled={!newName.trim()}><Icon name="plus" size={18} /> Anlegen</button>
		</form>
		<p class="muted small">
			Eigene Felder sind gleichwertig zu Standardfeldern: referenzierbar mit <code>@Name</code> und modifizierbar.
			Felder einer neuen Gruppe erscheinen in der Übersicht als eigener Block.
		</p>
	</section>

	{#if unassigned.length}
		<section class="card pad warn">
			<h2 class="section-title"><Icon name="alert" size={18} /> Nicht zugeordnete Modifikatoren</h2>
			<p class="muted small">Diese Modifikatoren haben kein (existierendes) Zielfeld. Feld wählen oder löschen.</p>
			{#each unassigned as m (m.id)}
				<div class="unassigned">
					<span class="desc">{m.description || 'Modifikator'}{#if m.importHint} <span class="hint">→ ursprünglich „{m.importHint}“</span>{/if} <span class="muted">({sourceName(m) ?? 'Quelle fehlt'}) · {OP_SYMBOL[m.op]} {toDisplayExpr(m.expr, Object.values(c.fields))}</span></span>
					<FieldSelect value={null} onchange={(v) => v && updateModifier(m.id, { targetFieldId: v })} label="Zielfeld wählen" noneLabel="Feld wählen …" />
					<button type="button" class="btn ghost danger small icon" aria-label="Modifikator löschen" onclick={() => deleteModifier(m.id)}><Icon name="trash" size={16} /></button>
				</div>
			{/each}
		</section>
	{/if}

	<section class="card pad">
		<div class="head-row">
			<h2 class="section-title">Alle Felder</h2>
			<input class="input search" type="search" placeholder="Filtern …" aria-label="Felder filtern" bind:value={filter} />
		</div>
		<table>
			<thead>
				<tr><th>Name</th><th>Gruppe</th><th class="r">Basis</th><th class="r">Endwert</th><th class="c">Sichtbar</th></tr>
			</thead>
			{#each groups as g (g.name)}
				{@const fs = g.fields.filter((f) => match(f.name))}
				{#if fs.length}
					<tbody>
						<tr class="group"><td colspan="5">{g.name}</td></tr>
						{#each fs as f (f.id)}
							<tr class:hidden={f.hidden}>
								<td>
									<input class="input inline" value={f.name} aria-label="Name" oninput={(e) => { const v = (e.currentTarget as HTMLInputElement).value; if (v.trim()) updateField(f.id, 'name', v); }} />
								</td>
								<td>
									<input class="input inline" list="group-names" value={f.group ?? ''} aria-label="Gruppe von {f.name}" onchange={(e) => updateField(f.id, 'group', (e.currentTarget as HTMLInputElement).value || undefined)} />
								</td>
								<td class="r">
									{#if f.computed}<span class="muted small">gezählt</span>{:else}<NumberInput value={f.base} onchange={(v) => setFieldBase(f.id, v)} label="Basiswert {f.name}" width="72px" className="inline" />{/if}
								</td>
								<td class="r"><FieldValue id={f.id} size="sm" /></td>
								<td class="c">
									<button type="button" class="btn ghost small icon" aria-label={f.hidden ? 'Einblenden' : 'Ausblenden'} title={f.hidden ? 'Ausgeblendet' : 'Sichtbar'} onclick={() => updateField(f.id, 'hidden', f.hidden ? undefined : true)}>
										<Icon name={f.hidden ? 'eyeOff' : 'eye'} size={17} />
									</button>
								</td>
							</tr>
						{/each}
					</tbody>
				{/if}
			{/each}
		</table>
	</section>

	<section class="card pad">
		<h2 class="section-title">Zähler und Kästchen</h2>
		<p class="muted small">Kein Reset, keine Kopplung an Rasten – Kästchen ändern sich nur durch Antippen.</p>
		{#each counters as ct (ct.id)}
			<div class="counter-row">
				<input class="input inline" value={ct.name} aria-label="Name" oninput={(e) => renameCounter(ct.id, (e.currentTarget as HTMLInputElement).value)} />
				<CounterBoxes id={ct.id} label="" editable />
				<button type="button" class="btn ghost danger small icon" aria-label="Zähler löschen" onclick={() => deleteCounter(ct.id)}><Icon name="trash" size={16} /></button>
			</div>
		{/each}
		<form
			class="create"
			onsubmit={(e) => {
				e.preventDefault();
				if (counterName.trim()) {
					addCounter(counterName, 1);
					counterName = '';
				}
			}}
		>
			<input class="input" placeholder="Neuer Zähler, z. B. Kanalisieren" aria-label="Zählername" bind:value={counterName} />
			<button type="submit" class="btn" disabled={!counterName.trim()}><Icon name="plus" size={18} /> Zähler</button>
		</form>
	</section>
	<div class="two">
		<section class="card pad">
			<h2 class="section-title">Zauberlisten</h2>
			<p class="muted small">Ein Zauber kann in mehreren Listen stehen. Löschen entfernt nur die Liste, nicht die Zauber.</p>
			{#each spellLists as l (l.id)}
				{@const used = usedIn('spellListId', l.id)}
				<div class="counter-row">
					<input class="input inline" value={l.name} aria-label="Name der Zauberliste" oninput={(e) => renameSpellList(l.id, (e.currentTarget as HTMLInputElement).value)} />
					<span class="muted small">{l.spellIds.length} Zauber{used.length ? ` · in ${used.join(', ')}` : ''}</span>
					{#if confirmDelete === l.id}
						<button type="button" class="btn danger small" onclick={() => { deleteSpellList(l.id); confirmDelete = null; }}>Löschen</button>
					{:else}
						<button type="button" class="btn ghost danger small icon" aria-label="Zauberliste löschen" onclick={() => (confirmDelete = l.id)}><Icon name="trash" size={16} /></button>
					{/if}
				</div>
			{/each}
			<form class="create" onsubmit={(e) => { e.preventDefault(); if (listName.trim()) { addSpellList(listName); listName = ''; } }}>
				<input class="input" placeholder="Neue Liste, z. B. Aus dem Stab" aria-label="Neue Zauberliste" bind:value={listName} />
				<button type="submit" class="btn" disabled={!listName.trim()}><Icon name="plus" size={18} /> Liste</button>
			</form>
		</section>

		<section class="card pad">
			<h2 class="section-title">Notizen</h2>
			<p class="muted small">Notizen erscheinen über Textblöcke im Layout.</p>
			{#each texts as t (t.id)}
				{@const used = usedIn('textId', t.id)}
				<div class="counter-row">
					<input class="input inline" value={t.title} aria-label="Titel der Notiz" oninput={(e) => updateText(t.id, 'title', (e.currentTarget as HTMLInputElement).value)} />
					<span class="muted small">{used.length ? `in ${used.join(', ')}` : 'nicht im Layout'}</span>
					{#if confirmDelete === t.id}
						<button type="button" class="btn danger small" onclick={() => { deleteText(t.id); confirmDelete = null; }}>Löschen</button>
					{:else}
						<button type="button" class="btn ghost danger small icon" aria-label="Notiz löschen" onclick={() => (confirmDelete = t.id)}><Icon name="trash" size={16} /></button>
					{/if}
				</div>
			{/each}
			<form class="create" onsubmit={(e) => { e.preventDefault(); if (textName.trim()) { addText(textName); textName = ''; } }}>
				<input class="input" placeholder="Neue Notiz" aria-label="Neue Notiz" bind:value={textName} />
				<button type="submit" class="btn" disabled={!textName.trim()}><Icon name="plus" size={18} /> Notiz</button>
			</form>
		</section>
	</div>
</div>

<style>
	.fields {
		display: flex;
		flex-direction: column;
		gap: 14px;
	}
	.pad {
		padding: 12px 14px;
		display: flex;
		flex-direction: column;
		gap: 8px;
	}
	.warn {
		border-color: var(--accent);
	}
	.exchange {
		flex-direction: row;
		align-items: center;
		gap: 10px;
	}
	.exchange > div {
		flex: 1;
	}
	.hint {
		color: var(--accent);
		font-size: 13px;
	}
	.create {
		display: flex;
		gap: 8px;
		align-items: center;
	}
	.create .input:first-child {
		flex: 2;
	}
	.create .group {
		flex: 1;
	}
	.small {
		font-size: 13px;
		margin: 0;
	}
	.head-row {
		display: flex;
		justify-content: space-between;
		align-items: center;
		gap: 12px;
	}
	.search {
		max-width: 260px;
	}
	table {
		width: 100%;
		border-collapse: collapse;
	}
	th {
		text-align: left;
		font-size: 11px;
		font-weight: 600;
		letter-spacing: 0.08em;
		text-transform: uppercase;
		color: var(--muted);
		padding: 4px 6px;
	}
	td {
		padding: 1px 4px;
		border-top: 1px solid color-mix(in srgb, var(--border) 60%, transparent);
	}
	.r {
		text-align: right;
	}
	.c {
		text-align: center;
	}
	tr.group td {
		font-family: var(--font-display);
		font-weight: 600;
		font-size: 15px;
		padding: 14px 6px 4px;
		border-top: none;
	}
	tr.hidden td:not(:last-child) {
		opacity: 0.5;
	}
	.unassigned,
	.counter-row {
		display: flex;
		gap: 8px;
		align-items: center;
	}
	.unassigned .desc {
		flex: 1;
	}
	.unassigned :global(select) {
		width: 240px;
	}
	.counter-row .input {
		flex: 1;
	}
	.two {
		display: grid;
		grid-template-columns: 1fr 1fr;
		gap: 14px;
		align-items: start;
	}
</style>
