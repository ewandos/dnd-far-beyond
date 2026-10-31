<script lang="ts">
	import { goto } from '$app/navigation';
	import { onMount } from 'svelte';
	import type { Character } from '$lib/engine/types';
	import { createDefaultCharacter } from '$lib/model/defaults';
	import { newId } from '$lib/model/ids';
	import { ImportError, parseCharacterFile } from '$lib/model/migrate';
	import { characterExists, deleteCharacter, listCharacters, loadCharacter, saveCharacter, type CharacterSummary } from '$lib/store/db';
	import { exportCharacterFile, isAppleTouchDevice, isStandalone, pickFile } from '$lib/store/files';
	import { ui } from '$lib/store/ui.svelte';
	import { relativeTime } from '$lib/ui/format';
	import Icon from '$lib/ui/components/Icon.svelte';

	let list = $state<CharacterSummary[] | null>(null);
	let newName = $state('');
	let confirmDelete = $state<string | null>(null);
	let pendingImport = $state<Character | null>(null);
	let showInstallHint = $state(false);
	let persisted = $state<boolean | null>(null);

	async function refresh() {
		list = await listCharacters();
	}

	onMount(() => {
		document.title = 'Charakterbogen';
		void refresh();
		try {
			showInstallHint = isAppleTouchDevice() && !isStandalone() && localStorage.getItem('installHintDismissed') !== '1';
		} catch {
			showInstallHint = isAppleTouchDevice() && !isStandalone();
		}
		navigator.storage?.persisted?.().then((p) => (persisted = p)).catch(() => {});
	});

	async function create() {
		const c = createDefaultCharacter(newName.trim() || 'Neuer Charakter');
		await saveCharacter(c);
		newName = '';
		await goto(`#/c/${c.id}`);
	}

	async function importFile() {
		const file = await pickFile();
		if (!file) return;
		try {
			const c = parseCharacterFile(await file.text());
			if (await characterExists(c.id)) {
				pendingImport = c;
				return;
			}
			await finishImport(c);
		} catch (e) {
			ui.toast(e instanceof ImportError ? e.message : 'Import fehlgeschlagen: ' + String(e));
		}
	}

	async function finishImport(c: Character, mode: 'replace' | 'copy' = 'replace') {
		if (mode === 'copy') {
			c.id = newId();
			c.name = `${c.name} (Kopie)`;
		}
		await saveCharacter(c);
		pendingImport = null;
		await refresh();
		ui.toast(`„${c.name}“ importiert`, { label: 'Öffnen', run: () => goto(`#/c/${c.id}`) });
	}

	async function exportOne(id: string) {
		const c = await loadCharacter(id);
		if (!c) return;
		const previous = c.meta.lastExportedAt;
		c.meta.lastExportedAt = new Date().toISOString();
		const result = await exportCharacterFile(c);
		if (result === 'cancelled') c.meta.lastExportedAt = previous;
		else await saveCharacter(c);
		await refresh();
	}

	async function remove(id: string) {
		await deleteCharacter(id);
		confirmDelete = null;
		await refresh();
	}
</script>

<div class="home">
	<header>
		<div>
			<h1>Charakterbogen</h1>
			<p class="muted">Wie Papier – nur dass jeder Wert verrät, woher er kommt.</p>
		</div>
		<button type="button" class="btn ghost icon" aria-label="Farbschema wechseln" title="Farbschema" onclick={() => ui.cycleTheme()}>
			<Icon name={ui.theme === 'system' ? 'monitor' : ui.theme === 'light' ? 'sun' : 'moon'} />
		</button>
	</header>

	{#if showInstallHint}
		<div class="hint card">
			<Icon name="info" />
			<p>
				<strong>Tipp fürs iPad:</strong> Über <em>Teilen → Zum Home-Bildschirm</em> hinzufügen. Nur so schützt Safari die gespeicherten
				Charaktere zuverlässig vor dem automatischen Löschen – und die App startet auch im Flugmodus.
			</p>
			<button
				type="button"
				class="btn ghost small icon"
				aria-label="Hinweis schließen"
				onclick={() => {
					showInstallHint = false;
					try {
						localStorage.setItem('installHintDismissed', '1');
					} catch {
						/* egal */
					}
				}}><Icon name="x" size={16} /></button
			>
		</div>
	{/if}

	<section class="actions">
		<form
			class="create"
			onsubmit={(e) => {
				e.preventDefault();
				void create();
			}}
		>
			<input class="input" placeholder="Name des neuen Charakters" aria-label="Name des neuen Charakters" bind:value={newName} />
			<button type="submit" class="btn primary"><Icon name="plus" size={18} /> Neuer Charakter</button>
		</form>
		<button type="button" class="btn" onclick={importFile}><Icon name="upload" size={18} /> Importieren</button>
	</section>

	{#if pendingImport}
		<div class="card dialog" role="alertdialog" aria-labelledby="dup-title">
			<h2 id="dup-title" class="section-title">„{pendingImport.name}“ gibt es schon</h2>
			<p>Auf diesem Gerät existiert bereits ein Charakter mit derselben ID.</p>
			<div class="row">
				<button type="button" class="btn primary" onclick={() => pendingImport && finishImport(pendingImport, 'replace')}>Ersetzen</button>
				<button type="button" class="btn" onclick={() => pendingImport && finishImport(pendingImport, 'copy')}>Als Kopie importieren</button>
				<button type="button" class="btn ghost" onclick={() => (pendingImport = null)}>Abbrechen</button>
			</div>
		</div>
	{/if}

	<section class="list">
		{#if list === null}
			<p class="muted">Lade …</p>
		{:else if list.length === 0}
			<div class="card empty-state">
				<h2 class="section-title">Noch keine Charaktere</h2>
				<p class="muted">Lege einen neuen Charakter an oder importiere eine Charakter-Datei (.json).</p>
			</div>
		{:else}
			{#each list as c (c.id)}
				<article class="card char">
					<a class="open" href="#/c/{c.id}">
						<span class="name">{c.name}</span>
						<span class="meta muted">
							{#if c.level !== undefined}Stufe {c.level} · {/if}geändert {relativeTime(c.updatedAt)} ·
							<span class:stale={!c.lastExportedAt || c.lastExportedAt < c.updatedAt}>exportiert: {relativeTime(c.lastExportedAt)}</span>
						</span>
					</a>
					<div class="row-actions">
						<button type="button" class="btn ghost" onclick={() => exportOne(c.id)} title="Als Datei sichern"><Icon name="download" size={18} /> Export</button>
						{#if confirmDelete === c.id}
							<button type="button" class="btn danger" onclick={() => remove(c.id)}>Endgültig löschen</button>
							<button type="button" class="btn ghost" onclick={() => (confirmDelete = null)}>Abbrechen</button>
						{:else}
							<button type="button" class="btn ghost icon danger" aria-label="{c.name} löschen" title="Löschen" onclick={() => (confirmDelete = c.id)}><Icon name="trash" size={18} /></button>
						{/if}
					</div>
				</article>
			{/each}
		{/if}
	</section>

	<footer class="muted">
		Alle Daten liegen nur auf diesem Gerät{persisted === true ? ' (dauerhafter Speicher aktiv)' : ''}. Die exportierte JSON-Datei ist die Sicherung –
		regelmäßig exportieren, z. B. nach iCloud Drive.
	</footer>
</div>

<style>
	.home {
		max-width: 860px;
		margin: 0 auto;
		padding: 48px 24px;
		display: flex;
		flex-direction: column;
		gap: 20px;
	}
	header {
		display: flex;
		justify-content: space-between;
		align-items: flex-start;
	}
	h1 {
		font-size: 40px;
		font-weight: 650;
	}
	header p {
		margin: 6px 0 0;
	}
	.hint {
		display: flex;
		gap: 12px;
		align-items: flex-start;
		padding: 12px 14px;
		border-color: var(--accent);
		background: var(--accent-soft);
	}
	.hint p {
		margin: 0;
		flex: 1;
	}
	.actions {
		display: flex;
		gap: 10px;
	}
	.create {
		display: flex;
		gap: 10px;
		flex: 1;
	}
	.dialog {
		padding: 16px;
		display: flex;
		flex-direction: column;
		gap: 8px;
		border-color: var(--accent);
	}
	.dialog p {
		margin: 0;
	}
	.row {
		display: flex;
		gap: 8px;
	}
	.list {
		display: flex;
		flex-direction: column;
		gap: 10px;
	}
	.empty-state {
		padding: 28px;
		text-align: center;
	}
	.empty-state p {
		margin: 6px 0 0;
	}
	.char {
		display: flex;
		align-items: center;
		gap: 12px;
		padding: 6px 8px 6px 18px;
	}
	.open {
		flex: 1;
		display: flex;
		flex-direction: column;
		padding: 10px 0;
		text-decoration: none;
		color: inherit;
		min-width: 0;
	}
	.name {
		font-family: var(--font-display);
		font-size: 21px;
		font-weight: 600;
	}
	.open:hover .name {
		color: var(--accent);
	}
	.meta {
		font-size: 13px;
	}
	.stale {
		color: var(--accent);
	}
	.row-actions {
		display: flex;
		gap: 4px;
	}
	footer {
		font-size: 13px;
		margin-top: 12px;
	}
</style>
