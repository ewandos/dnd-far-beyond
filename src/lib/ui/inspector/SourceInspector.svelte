<script lang="ts">
	// Item, Fähigkeit oder Zustand: Karte mit Beschreibung und Modifikatoren samt Zielfeldern.
	import { ACTION_KIND_SINGULAR, ACTION_KINDS } from '$lib/engine/actions';
	import type { ActionKind } from '$lib/engine/types';
	import {
		addAction,
		addUsageCounter,
		deleteAbility,
		deleteCounter,
		deleteItem,
		KIND_LABEL,
		moveItem,
		renameCounter,
		setAbilityActive,
		toggleItemEquipped,
		updateAbility,
		updateItem
	} from '$lib/store/actions';
	import { sheet } from '$lib/store/sheet.svelte';
	import { ui } from '$lib/store/ui.svelte';
	import type { AbilityKind } from '$lib/engine/types';
	import CounterBoxes from '../components/CounterBoxes.svelte';
	import Icon from '../components/Icon.svelte';
	import { exportEntries } from '../content/io';
	import MarkdownEditor from '../components/MarkdownEditor.svelte';
	import NumberInput from '../components/NumberInput.svelte';
	import Switch from '../components/Switch.svelte';
	import ModifierForm from './ModifierForm.svelte';
	import ModifierRow from './ModifierRow.svelte';
	import { containerPath } from '../containers';

	let { kind, id }: { kind: 'item' | 'ability'; id: string } = $props();

	const c = $derived(sheet.character!);
	const item = $derived(kind === 'item' ? c.items[id] : undefined);
	const ability = $derived(kind === 'ability' ? c.abilities[id] : undefined);
	const source = $derived(item ?? ability);
	const mods = $derived(
		Object.values(c.modifiers)
			.filter((m) => m.source.kind === kind && m.source.id === id)
			.sort((a, b) => a.order - b.order)
	);
	const equipped = $derived(item ? !!c.containers[item.containerId]?.equipped : false);
	const containers = $derived(
		Object.values(c.containers)
			.map((ct) => ({ ...ct, path: containerPath(c, ct.id) }))
			.sort((a, b) => a.path.localeCompare(b.path, 'de'))
	);
	const noun = $derived(item ? 'Item' : ability ? KIND_LABEL[ability.kind] : '');

	let adding = $state(false);
	let newActionKind = $state<ActionKind>('action');
	const attached = $derived(
		Object.values(c.actions ?? {})
			.filter((a) => a.source?.kind === kind && a.source.id === id)
			.sort((a, b) => a.order - b.order)
	);
	let confirmDelete = $state(false);
	$effect(() => {
		void id;
		adding = false;
		confirmDelete = false;
	});

	function stepFor(modId: string) {
		const m = c.modifiers[modId];
		if (!m?.targetFieldId) return undefined;
		return sheet.evaluation?.fields[m.targetFieldId]?.steps.find((s) => s.modifierId === modId);
	}
</script>

{#if source}
	<div class="inspector" data-inspect-source={id}>
		<header>
			<div class="top">
				<span class="eyebrow">{noun}{#if item} · {c.containers[item.containerId]?.name ?? '—'}{/if}</span>
				{#if item}
					<span class="state" class:on={equipped}>{equipped ? 'ausgerüstet' : 'nicht ausgerüstet'}</span>
					<Switch checked={equipped} label={equipped ? 'Ablegen' : 'Ausrüsten'} onchange={() => toggleItemEquipped(item.id)} />
				{:else if ability}
					<span class="state" class:on={ability.active}>{ability.active ? 'aktiv' : 'aus'}</span>
					<Switch checked={ability.active} label={ability.active ? 'Ausschalten' : 'Einschalten'} onchange={(v) => setAbilityActive(ability.id, v)} />
				{/if}
			</div>
			<input
				class="input inline title"
				value={source.name}
				aria-label="Name"
				oninput={(e) => {
					const v = (e.currentTarget as HTMLInputElement).value;
					if (item) updateItem(id, 'name', v);
					else updateAbility(id, 'name', v);
				}}
			/>
		</header>

		{#if item}
			<section class="props">
				<label>
					<span class="eyebrow">Menge</span>
					<NumberInput value={item.quantity} onchange={(v) => updateItem(id, 'quantity', v)} label="Menge" width="80px" min={0} />
				</label>
				<label class="grow">
					<span class="eyebrow">Container</span>
					<select class="select" value={item.containerId} onchange={(e) => moveItem(id, (e.currentTarget as HTMLSelectElement).value)}>
						{#each containers as ct (ct.id)}
							<option value={ct.id}>{ct.path}{ct.equipped ? ' (ausgerüstet)' : ''}</option>
						{/each}
					</select>
				</label>
				<label class="check">
					<input type="checkbox" checked={item.requiresAttunement} onchange={(e) => updateItem(id, 'requiresAttunement', (e.currentTarget as HTMLInputElement).checked)} />
					Erfordert Einstimmung
				</label>
			</section>
		{:else if ability}
			<section class="props">
				<label class="grow">
					<span class="eyebrow">Herkunft</span>
					<input
						class="input"
						list="origin-suggestions"
						placeholder="Klasse, Volk, Talent, Story …"
						value={ability.origin ?? ''}
						oninput={(e) => updateAbility(id, 'origin', (e.currentTarget as HTMLInputElement).value)}
					/>
					<datalist id="origin-suggestions">
						{#each ['Klasse', 'Volk', 'Talent', 'Hintergrund', 'Story', 'Item', 'Zauber', 'Krankheit', 'Fluch', 'Segen'] as o (o)}<option value={o}></option>{/each}
					</datalist>
				</label>
				<label>
					<span class="eyebrow">Art</span>
					<select class="select" value={ability.kind} onchange={(e) => updateAbility(id, 'kind', (e.currentTarget as HTMLSelectElement).value as AbilityKind)}>
						<option value="ability">Fähigkeit</option>
						<option value="condition">Zustand</option>
					</select>
				</label>
			</section>
		{/if}

		<section>
			<span class="eyebrow">Beschreibung</span>
			<MarkdownEditor
				value={source.description}
				onchange={(v) => (item ? updateItem(id, 'description', v) : updateAbility(id, 'description', v))}
				placeholder="Markdown: **fett**, *kursiv*, - Listen …"
			/>
		</section>

		<section class="mods">
			<h3 class="section-title">Modifikatoren</h3>
			{#if mods.length}
				<div>
					{#each mods as m (m.id)}
						<ModifierRow modifierId={m.id} context="source" step={stepFor(m.id)} />
					{/each}
				</div>
			{:else if !adding}
				<p class="empty">Keine Modifikatoren – rein beschreibend.</p>
			{/if}
			{#if adding}
				<ModifierForm fixedSource={{ kind, id }} ondone={() => (adding = false)} />
			{:else}
				<div>
					<button type="button" class="btn" onclick={() => (adding = true)}><Icon name="plus" size={18} /> Modifikator hinzufügen</button>
				</div>
			{/if}
		</section>

		<section class="mods">
			<h3 class="section-title">Aktionen</h3>
			{#each attached as act (act.id)}
				<button type="button" class="action-link" onclick={() => ui.push({ kind: 'action', id: act.id })}>
					<span class="kind-tag">{ACTION_KIND_SINGULAR[act.kind]}</span>
					<span>{act.name}</span>
				</button>
			{/each}
			{#if !attached.length}<p class="empty">Keine – z. B. „Angriff“ bei einer Waffe.</p>{/if}
			<div class="add-action">
				<select class="select" bind:value={newActionKind} aria-label="Art der neuen Aktion">
					{#each ACTION_KINDS as k (k)}<option value={k}>{ACTION_KIND_SINGULAR[k]}</option>{/each}
				</select>
				<button
					type="button"
					class="btn"
					onclick={() => {
						const aid = addAction({ name: item ? `Angriff: ${source.name}` : source.name, kind: newActionKind, source: { kind, id } });
						ui.push({ kind: 'action', id: aid });
					}}><Icon name="plus" size={18} /> Aktion hinzufügen</button
				>
			</div>
		</section>

		<section>
			<span class="eyebrow">Nutzungs-Kästchen</span>
			{#if source.counterId && c.counters[source.counterId]}
				{@const counterId = source.counterId}
				<div class="usage">
					<input
						class="input inline"
						value={c.counters[counterId].name}
						aria-label="Name des Zählers"
						oninput={(e) => renameCounter(counterId, (e.currentTarget as HTMLInputElement).value)}
					/>
					<CounterBoxes id={counterId} label="" editable />
					<button type="button" class="btn ghost small icon" title="Kästchen entfernen" aria-label="Nutzungs-Kästchen entfernen" onclick={() => deleteCounter(counterId)}>
						<Icon name="trash" size={16} />
					</button>
				</div>
			{:else}
				<div>
					<button type="button" class="btn ghost small" onclick={() => addUsageCounter({ kind, id }, 1)}>
						<Icon name="plus" size={16} /> Kästchen hinzufügen, z. B. „2 / lange Rast“
					</button>
				</div>
			{/if}
		</section>

		{#if item}
			<section>
				<label class="notes">
					<span class="eyebrow">Notizen</span>
					<textarea class="textarea" rows="2" value={item.notes ?? ''} oninput={(e) => updateItem(id, 'notes', (e.currentTarget as HTMLTextAreaElement).value)}></textarea>
				</label>
			</section>
		{/if}

		<footer>
			<button type="button" class="btn ghost small" title="Als Datei für andere Spieler" onclick={() => exportEntries([{ type: kind, id }])}><Icon name="download" size={16} /> Exportieren</button>
			{#if item?.originId || ability?.originId}
				<span class="muted small">Importierte Kopie</span>
			{/if}
			<span class="spacer"></span>
			{#if confirmDelete}
				<button
					type="button"
					class="btn danger small"
					onclick={() => {
						if (item) deleteItem(id);
						else deleteAbility(id);
						ui.back();
					}}>Wirklich löschen</button
				>
				<button type="button" class="btn ghost small" onclick={() => (confirmDelete = false)}>Abbrechen</button>
			{:else}
				<button type="button" class="btn ghost danger small" onclick={() => (confirmDelete = true)}>
					<Icon name="trash" size={16} />
					{noun} löschen
				</button>
			{/if}
		</footer>
	</div>
{:else}
	<p class="empty">Diese Quelle existiert nicht mehr.</p>
{/if}

<style>
	.inspector {
		display: flex;
		flex-direction: column;
		gap: 16px;
	}
	header {
		display: flex;
		flex-direction: column;
		gap: 2px;
	}
	.top {
		display: flex;
		align-items: center;
		gap: 8px;
	}
	.top .eyebrow {
		flex: 1;
	}
	.state {
		font-size: 13px;
		color: var(--muted);
	}
	.state.on {
		color: var(--accent);
		font-weight: 600;
	}
	.title {
		font-family: var(--font-display);
		font-size: 24px;
		font-weight: 600;
		margin-left: -6px;
		width: calc(100% + 6px);
	}
	.props {
		display: flex;
		gap: 12px;
		align-items: flex-end;
		flex-wrap: wrap;
	}
	.props > label:not(.check) {
		display: flex;
		flex-direction: column;
		gap: 4px;
	}
	.props .grow {
		flex: 1;
		min-width: 160px;
	}
	.mods {
		display: flex;
		flex-direction: column;
		gap: 8px;
	}
	.action-link {
		display: flex;
		align-items: center;
		gap: 8px;
		min-height: 40px;
		padding: 0;
		border: none;
		border-bottom: 1px solid var(--border);
		background: none;
		text-align: left;
		font-weight: 500;
	}
	.action-link:hover {
		color: var(--accent);
	}
	.kind-tag {
		font-size: 11px;
		font-weight: 600;
		letter-spacing: 0.05em;
		text-transform: uppercase;
		color: var(--accent);
		min-width: 92px;
	}
	.add-action {
		display: flex;
		gap: 8px;
	}
	.add-action .select {
		width: 160px;
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
	.notes {
		display: flex;
		flex-direction: column;
		gap: 4px;
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
	}
</style>
