<script lang="ts">
	// Alle Felder verwalten: eigene Felder anlegen, umbenennen, gruppieren, ausblenden, löschen.
	import { GROUPS } from '$lib/model/defaults';
	import {
		addCounter,
		addField,
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
					<span class="desc">{m.description || 'Modifikator'} <span class="muted">({sourceName(m) ?? 'Quelle fehlt'}) · {OP_SYMBOL[m.op]} {toDisplayExpr(m.expr, Object.values(c.fields))}</span></span>
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
</style>
