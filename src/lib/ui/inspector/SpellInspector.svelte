<script lang="ts">
	// Zauberkarte: alle Angaben, Beschreibung, Zugehörigkeit zu Zauberlisten.
	import { addAbility, deleteSpell, setSpellInList, spellLevelLabel, updateSpell } from '$lib/store/actions';
	import { sheet } from '$lib/store/sheet.svelte';
	import { ui } from '$lib/store/ui.svelte';
	import Icon from '../components/Icon.svelte';
	import MarkdownEditor from '../components/MarkdownEditor.svelte';

	let { id }: { id: string } = $props();
	const c = $derived(sheet.character!);
	const s = $derived(c.spells[id]);
	const lists = $derived(Object.values(c.spellLists).sort((a, b) => a.order - b.order));
	let confirmDelete = $state(false);

	const SCHOOLS = ['Bannmagie', 'Beschwörung', 'Erkenntnismagie', 'Hervorrufung', 'Illusion', 'Nekromantie', 'Verwandlung', 'Verzauberung'];
	const PROPS = [
		{ key: 'castingTime', label: 'Zeitaufwand', ph: '1 Aktion' },
		{ key: 'range', label: 'Reichweite', ph: '18 m' },
		{ key: 'components', label: 'Komponenten', ph: 'V, G, M (eine Feder)' },
		{ key: 'duration', label: 'Wirkungsdauer', ph: 'Bis zu 1 Minute' }
	] as const;
</script>

{#if s}
	<div class="inspector" data-inspect-spell={id}>
		<header>
			<span class="eyebrow">Zauber · {spellLevelLabel(s.level)}{s.school ? ` · ${s.school}` : ''}</span>
			<input class="input inline title" value={s.name} aria-label="Name" oninput={(e) => updateSpell(id, 'name', (e.currentTarget as HTMLInputElement).value)} />
		</header>

		<section class="grid">
			<label>
				<span class="eyebrow">Grad</span>
				<select class="select" value={s.level} onchange={(e) => updateSpell(id, 'level', Number((e.currentTarget as HTMLSelectElement).value))}>
					{#each [0, 1, 2, 3, 4, 5, 6, 7, 8, 9] as l (l)}<option value={l}>{spellLevelLabel(l)}</option>{/each}
				</select>
			</label>
			<label>
				<span class="eyebrow">Schule</span>
				<input class="input" list="spell-schools" value={s.school ?? ''} oninput={(e) => updateSpell(id, 'school', (e.currentTarget as HTMLInputElement).value)} />
				<datalist id="spell-schools">{#each SCHOOLS as sc (sc)}<option value={sc}></option>{/each}</datalist>
			</label>
			{#each PROPS as p (p.key)}
				<label>
					<span class="eyebrow">{p.label}</span>
					<input class="input" placeholder={p.ph} value={s[p.key] ?? ''} oninput={(e) => updateSpell(id, p.key, (e.currentTarget as HTMLInputElement).value)} />
				</label>
			{/each}
		</section>

		<section class="flags">
			<label class="check"><input type="checkbox" checked={!!s.concentration} onchange={(e) => updateSpell(id, 'concentration', (e.currentTarget as HTMLInputElement).checked)} /> Konzentration</label>
			<label class="check"><input type="checkbox" checked={!!s.ritual} onchange={(e) => updateSpell(id, 'ritual', (e.currentTarget as HTMLInputElement).checked)} /> Ritual</label>
			{#if s.concentration}
				<button
					type="button"
					class="btn ghost small"
					title="Legt einen Zustand an – zum Abhaken, solange du dich konzentrierst"
					onclick={() => {
						const aid = addAbility({ kind: 'condition', name: `Konzentration: ${s.name}`, origin: 'Zauber' });
						ui.toast('Zustand angelegt', { label: 'Öffnen', run: () => ui.push({ kind: 'ability', id: aid }) });
					}}
				>
					<Icon name="sparkle" size={16} /> Als Zustand eintragen
				</button>
			{/if}
		</section>

		<label class="block">
			<span class="eyebrow">Tags</span>
			<input
				class="input"
				placeholder="durch Komma getrennt, z. B. Feuer, Fläche"
				value={s.tags.join(', ')}
				onchange={(e) =>
					updateSpell(
						id,
						'tags',
						(e.currentTarget as HTMLInputElement).value
							.split(',')
							.map((t) => t.trim())
							.filter(Boolean)
					)}
			/>
		</label>

		<section>
			<span class="eyebrow">Beschreibung</span>
			<MarkdownEditor value={s.description} onchange={(v) => updateSpell(id, 'description', v)} placeholder="Markdown: **fett**, *kursiv*, - Listen …" />
		</section>

		<section>
			<span class="eyebrow">In Zauberlisten</span>
			<div class="lists">
				{#each lists as l (l.id)}
					<label class="check"><input type="checkbox" checked={l.spellIds.includes(id)} onchange={(e) => setSpellInList(id, l.id, (e.currentTarget as HTMLInputElement).checked)} /> {l.name}</label>
				{/each}
				{#if !lists.length}<p class="empty">Keine Zauberlisten – im Bearbeitungsmodus über eine Karten-Liste anlegen.</p>{/if}
			</div>
		</section>

		<label class="block">
			<span class="eyebrow">Notizen</span>
			<textarea class="textarea" rows="2" value={s.notes ?? ''} oninput={(e) => updateSpell(id, 'notes', (e.currentTarget as HTMLTextAreaElement).value)}></textarea>
		</label>

		<footer>
			{#if s.originId}<span class="muted small">Importierte Kopie</span>{/if}
			<span class="spacer"></span>
			{#if confirmDelete}
				<button type="button" class="btn danger small" onclick={() => { deleteSpell(id); ui.back(); }}>Wirklich löschen</button>
				<button type="button" class="btn ghost small" onclick={() => (confirmDelete = false)}>Abbrechen</button>
			{:else}
				<button type="button" class="btn ghost danger small" onclick={() => (confirmDelete = true)}><Icon name="trash" size={16} /> Zauber löschen</button>
			{/if}
		</footer>
	</div>
{:else}
	<p class="empty">Dieser Zauber existiert nicht mehr.</p>
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
	.title {
		font-family: var(--font-display);
		font-size: 24px;
		font-weight: 600;
		margin-left: -6px;
		width: calc(100% + 6px);
	}
	.grid {
		display: grid;
		grid-template-columns: 1fr 1fr;
		gap: 10px 12px;
	}
	.grid label,
	.block {
		display: flex;
		flex-direction: column;
		gap: 4px;
	}
	.flags {
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		gap: 4px 16px;
	}
	.lists {
		display: flex;
		flex-wrap: wrap;
		gap: 0 16px;
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
