<script lang="ts">
	// Inhalte importieren: Datei wählen, Einträge auswählen, als Kopien übernehmen.
	import { ContentError, entryLabel, entryName, planImport, type ContentEntry } from '$lib/model/content';
	import { newId } from '$lib/model/ids';
	import { applyImport, spellLevelLabel } from '$lib/store/actions';
	import { pickFile } from '$lib/store/files';
	import { sheet } from '$lib/store/sheet.svelte';
	import { ui } from '$lib/store/ui.svelte';
	import { containerPath } from '../containers';
	import Icon from '../components/Icon.svelte';
	import Markdown from '../components/Markdown.svelte';
	import { loadContentText, type LoadedContent } from './io';

	let { onclose }: { onclose: () => void } = $props();
	const c = $derived(sheet.character!);

	let loaded = $state<LoadedContent | null>(null);
	let fileName = $state('');
	let error = $state('');
	let selected = $state<Set<number>>(new Set());
	let query = $state('');
	let typeFilter = $state<'all' | 'item' | 'spell' | 'ability'>('all');
	let preview = $state<number | null>(null);
	const LIMIT = 200;

	const containers = $derived(
		Object.values(c.containers)
			.map((x) => ({ id: x.id, path: containerPath(c, x.id), equipped: x.equipped }))
			.sort((a, b) => Number(a.equipped) - Number(b.equipped) || a.path.localeCompare(b.path, 'de'))
	);
	const lists = $derived(Object.values(c.spellLists).sort((a, b) => a.order - b.order));
	let containerId = $state('');
	let spellListId = $state('');
	$effect.pre(() => {
		if (!containerId || !c.containers[containerId]) containerId = containers[0]?.id ?? '';
	});

	const indexed = $derived((loaded?.entries ?? []).map((e, i) => ({ e, i, name: entryName(e), label: entryLabel(e) })));
	const matches = $derived(
		indexed.filter(({ e, name }) => (typeFilter === 'all' || e.type === typeFilter) && (!query.trim() || name.toLowerCase().includes(query.trim().toLowerCase())))
	);
	const counts = $derived({
		item: indexed.filter((x) => x.e.type === 'item').length,
		spell: indexed.filter((x) => x.e.type === 'spell').length,
		ability: indexed.filter((x) => x.e.type === 'ability').length
	});
	const chosen = $derived([...selected].map((i) => loaded!.entries[i]).filter(Boolean));
	const hasItems = $derived(chosen.some((e) => e.type === 'item'));
	const hasSpells = $derived(chosen.some((e) => e.type === 'spell'));

	async function choose() {
		const file = await pickFile();
		if (!file) return;
		error = '';
		try {
			loaded = loadContentText(await file.text());
			fileName = file.name;
			// Kleine Dateien (z. B. vom SL) komplett vorauswählen, große 5eTools-Dateien nicht.
			selected = new Set(loaded.entries.length <= 25 ? loaded.entries.map((_, i) => i) : []);
			preview = null;
		} catch (e) {
			error = e instanceof ContentError ? e.message : 'Datei konnte nicht gelesen werden: ' + String(e);
		}
	}

	function toggle(i: number, on: boolean) {
		const next = new Set(selected);
		if (on) next.add(i);
		else next.delete(i);
		selected = next;
	}

	function selectVisible(on: boolean) {
		const next = new Set(selected);
		for (const { i } of matches.slice(0, LIMIT)) on ? next.add(i) : next.delete(i);
		selected = next;
	}

	function doImport() {
		if (!chosen.length || !containerId) return;
		const plan = planImport(JSON.parse(JSON.stringify(c)), chosen, { containerId, spellListId: spellListId || undefined }, newId);
		applyImport(plan, spellListId || undefined);
		const n = plan.items.length + plan.abilities.length + plan.spells.length;
		if (plan.unassigned) {
			ui.toast(`${n} importiert – ${plan.unassigned} Modifikator${plan.unassigned === 1 ? '' : 'en'} nicht zugeordnet`, {
				label: 'Zuordnen',
				run: () => (ui.tab = 'sys.fields')
			});
		} else {
			ui.toast(`${n} Inhalt${n === 1 ? '' : 'e'} importiert`);
		}
		onclose();
	}

	function description(e: ContentEntry): string {
		return e.type === 'item' ? e.item.description : e.type === 'ability' ? e.ability.description : e.spell.description;
	}
</script>

<svelte:window onkeydown={(e) => e.key === 'Escape' && onclose()} />

<div class="backdrop" role="presentation" onclick={(e) => e.target === e.currentTarget && onclose()}>
	<div class="dialog card" role="dialog" aria-modal="true" aria-labelledby="import-title">
		<header>
			<h2 id="import-title" class="section-title">Inhalte importieren</h2>
			<button type="button" class="btn ghost icon" aria-label="Schließen" onclick={onclose}><Icon name="x" /></button>
		</header>

		<div class="body">
			<div class="file">
				<button type="button" class="btn" onclick={choose}><Icon name="upload" size={18} /> Datei wählen</button>
				{#if loaded}
					<span class="muted">{fileName} · {loaded.format === '5etools' ? '5eTools' : 'Inhalts-Datei'} · {loaded.entries.length} Einträge</span>
				{:else}
					<span class="muted">Inhalts-Datei vom SL oder 5eTools-JSON (Items, Zauber, Talente)</span>
				{/if}
			</div>
			{#if error}<p class="error" role="alert">{error}</p>{/if}

			{#if loaded}
				<div class="filters">
					<input class="input" type="search" placeholder="Suchen …" aria-label="Einträge suchen" bind:value={query} />
					<select class="select type" bind:value={typeFilter} aria-label="Art">
						<option value="all">Alle ({indexed.length})</option>
						{#if counts.item}<option value="item">Items ({counts.item})</option>{/if}
						{#if counts.spell}<option value="spell">Zauber ({counts.spell})</option>{/if}
						{#if counts.ability}<option value="ability">Fähigkeiten/Talente ({counts.ability})</option>{/if}
					</select>
				</div>
				<div class="bulk">
					<button type="button" class="btn ghost small" onclick={() => selectVisible(true)}>Angezeigte auswählen</button>
					<button type="button" class="btn ghost small" onclick={() => selectVisible(false)}>Angezeigte abwählen</button>
					<span class="muted small">{selected.size} ausgewählt</span>
				</div>
				<ul class="entries">
					{#each matches.slice(0, LIMIT) as { e, i, name, label } (i)}
						<li class:open={preview === i}>
							<label class="check">
								<input type="checkbox" checked={selected.has(i)} onchange={(ev) => toggle(i, (ev.currentTarget as HTMLInputElement).checked)} />
								<span class="name">{name}</span>
							</label>
							<span class="kind">{e.type === 'spell' ? spellLevelLabel(e.spell.level) : label}</span>
							{#if (e.type === 'item' || e.type === 'ability') && e.modifiers.length}
								<span class="mods" title="Bringt Modifikatoren mit">{e.modifiers.length} Mod.</span>
							{/if}
							<button type="button" class="btn ghost small icon" aria-label="Vorschau {name}" aria-expanded={preview === i} onclick={() => (preview = preview === i ? null : i)}>
								<Icon name={preview === i ? 'chevronDown' : 'chevronRight'} size={16} />
							</button>
							{#if preview === i}
								<div class="preview"><Markdown source={description(e)} empty="Keine Beschreibung." /></div>
							{/if}
						</li>
					{/each}
				</ul>
				{#if matches.length > LIMIT}<p class="muted small">{matches.length - LIMIT} weitere – Suche verwenden.</p>{/if}
				{#if !matches.length}<p class="empty">Keine Treffer.</p>{/if}

				<div class="targets">
					{#if hasItems}
						<label><span class="eyebrow">Items in</span>
							<select class="select" bind:value={containerId}>
								{#each containers as ct (ct.id)}<option value={ct.id}>{ct.path}{ct.equipped ? ' (ausgerüstet)' : ''}</option>{/each}
							</select>
						</label>
					{/if}
					{#if hasSpells}
						<label><span class="eyebrow">Zauber in Liste</span>
							<select class="select" bind:value={spellListId}>
								<option value="">— keine Liste —</option>
								{#each lists as l (l.id)}<option value={l.id}>{l.name}</option>{/each}
							</select>
						</label>
					{/if}
				</div>
				<p class="muted small">
					Importiert werden Kopien. Modifikatoren auf Standardfelder werden automatisch zugeordnet, alle anderen kommen als
					„nicht zugeordnet“ an.{loaded.format === '5etools' ? ' 5eTools-Angaben werden nicht zu Modifikatoren – die trägst du bei Bedarf selbst ein.' : ''}
				</p>
			{/if}
		</div>

		<footer>
			<span class="spacer"></span>
			<button type="button" class="btn ghost" onclick={onclose}>Abbrechen</button>
			<button type="button" class="btn primary" disabled={!chosen.length} onclick={doImport}>{chosen.length ? `${chosen.length} importieren` : 'Importieren'}</button>
		</footer>
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
		width: 680px;
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
	.file,
	.filters,
	.bulk {
		display: flex;
		align-items: center;
		gap: 10px;
	}
	.filters .input {
		flex: 1;
	}
	.type {
		width: 230px;
	}
	.error {
		margin: 0;
		color: var(--danger);
	}
	.entries {
		list-style: none;
		margin: 0;
		padding: 0;
		border: 1px solid var(--border);
		border-radius: var(--radius-sm);
		max-height: 360px;
		overflow-y: auto;
	}
	.entries li {
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		gap: 0 10px;
		padding: 0 6px 0 10px;
		border-bottom: 1px solid color-mix(in srgb, var(--border) 60%, transparent);
	}
	.entries li:last-child {
		border-bottom: none;
	}
	.entries .check {
		flex: 1;
		min-width: 0;
		min-height: 40px;
	}
	.name {
		font-weight: 500;
	}
	.kind,
	.mods {
		font-size: 12px;
		color: var(--muted);
	}
	.mods {
		color: var(--accent);
	}
	.preview {
		flex-basis: 100%;
		padding: 4px 4px 12px 28px;
		font-size: 14px;
	}
	.targets {
		display: flex;
		gap: 12px;
	}
	.targets label {
		flex: 1;
		display: flex;
		flex-direction: column;
		gap: 4px;
	}
	.small {
		font-size: 13px;
		margin: 0;
	}
</style>
