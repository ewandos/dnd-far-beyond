<script lang="ts">
	import { STD } from '$lib/model/defaults';
	import { renameCharacter } from '$lib/store/actions';
	import { exportCharacterFile } from '$lib/store/files';
	import { sheet } from '$lib/store/sheet.svelte';
	import { SYSTEM_TABS, ui } from '$lib/store/ui.svelte';
	import { addTab, deleteTab, moveTab, renameTab, setTabHidden } from '$lib/store/layoutActions';
	import { relativeTime } from './format';
	import DragGhost from './components/DragGhost.svelte';
	import FieldValue from './components/FieldValue.svelte';
	import Icon from './components/Icon.svelte';
	import Inspector from './inspector/Inspector.svelte';
	import LayoutGrid from './layout/LayoutGrid.svelte';
	import Fields from './tabs/Fields.svelte';
	import History from './tabs/History.svelte';

	let { onexported }: { onexported?: () => void } = $props();
	const c = $derived(sheet.character!);

	const layoutTabs = $derived([...c.layout.tabs].sort((a, b) => a.order - b.order));
	const visibleTabs = $derived(ui.editMode ? layoutTabs : layoutTabs.filter((t) => !t.hidden));
	const isSystem = (id: string) => SYSTEM_TABS.some((t) => t.id === id);
	// Aktiver Tab: gewählter Layout-Tab bzw. Systemseite, sonst der erste sichtbare.
	const activeTab = $derived(
		isSystem(ui.tab) || visibleTabs.some((t) => t.id === ui.tab) ? ui.tab : (visibleTabs[0]?.id ?? SYSTEM_TABS[0].id)
	);
	let confirmTabDelete = $state<string | null>(null);

	let now = $state(Date.now());
	$effect(() => {
		const t = setInterval(() => (now = Date.now()), 60_000);
		return () => clearInterval(t);
	});
	const exportAge = $derived(relativeTime(c.meta.lastExportedAt, now));
	const exportStale = $derived(!c.meta.lastExportedAt || c.meta.updatedAt > c.meta.lastExportedAt);

	async function doExport() {
		const previous = c.meta.lastExportedAt;
		c.meta.lastExportedAt = new Date().toISOString();
		const result = await exportCharacterFile($state.snapshot(c));
		if (result === 'cancelled') {
			c.meta.lastExportedAt = previous;
			return;
		}
		onexported?.();
		ui.toast(result === 'shared' ? 'Charakter geteilt' : 'Charakter-Datei heruntergeladen');
	}

	function onKey(e: KeyboardEvent) {
		const mod = e.metaKey || e.ctrlKey;
		if (!mod) return;
		const t = e.target as HTMLElement | null;
		// In Textfeldern bleibt das native Rückgängig der Eingabe erhalten.
		if (t?.closest('input, textarea, [contenteditable]')) return;
		const key = e.key.toLowerCase();
		if (key === 'z' && !e.shiftKey) {
			e.preventDefault();
			sheet.undo();
		} else if ((key === 'z' && e.shiftKey) || key === 'y') {
			e.preventDefault();
			sheet.redo();
		}
	}
</script>

<svelte:window onkeydown={onKey} />

<div class="sheet" class:with-panel={!!ui.panel}>
	<header class="top">
		<a class="btn ghost icon home" href="#/" aria-label="Alle Charaktere" title="Alle Charaktere"><Icon name="back" /></a>
		<input class="input inline name" value={c.name} aria-label="Charaktername" oninput={(e) => renameCharacter((e.currentTarget as HTMLInputElement).value)} />
		{#if c.fields[STD.level]}
			<span class="level">
				<span class="eyebrow">{c.fields[STD.level].name}</span>
				<FieldValue id={STD.level} size="md" />
			</span>
		{/if}
		<span class="spacer"></span>
		<button
			type="button"
			class="btn mode"
			class:primary={ui.editMode}
			aria-pressed={ui.editMode}
			aria-label="Layout bearbeiten"
			title={ui.editMode ? 'Zurück zum Spielmodus' : 'Tabs und Bausteine anordnen'}
			onclick={() => {
				ui.editMode = !ui.editMode;
				if (ui.editMode) ui.close();
			}}
		>
			<Icon name={ui.editMode ? 'check' : 'edit'} size={18} />
			{ui.editMode ? 'Fertig' : 'Layout'}
		</button>
		<button type="button" class="btn ghost icon" disabled={!sheet.canUndo} aria-label="Rückgängig" title="Rückgängig (⌘/Strg+Z)" onclick={() => sheet.undo()}><Icon name="undo" /></button>
		<button type="button" class="btn ghost icon" disabled={!sheet.canRedo} aria-label="Wiederholen" title="Wiederholen (⌘/Strg+Umschalt+Z)" onclick={() => sheet.redo()}><Icon name="redo" /></button>
		<button
			type="button"
			class="btn ghost icon"
			aria-label="Farbschema: {ui.theme === 'system' ? 'System' : ui.theme === 'light' ? 'Hell' : 'Dunkel'}"
			title="Farbschema: {ui.theme === 'system' ? 'wie System' : ui.theme === 'light' ? 'hell' : 'dunkel'}"
			onclick={() => ui.cycleTheme()}
		>
			<Icon name={ui.theme === 'system' ? 'monitor' : ui.theme === 'light' ? 'sun' : 'moon'} />
		</button>
		<button type="button" class="btn export" class:stale={exportStale} onclick={doExport} title="Als JSON-Datei sichern">
			<Icon name="download" size={18} />
			<span class="export-text">
				Exportieren
				<small>zuletzt: {exportAge}</small>
			</span>
		</button>
	</header>

	<nav class="tabs" class:editing={ui.editMode} aria-label="Bereiche">
		{#each visibleTabs as t, i (t.id)}
			{#if ui.editMode}
				<div class="tab-edit" class:active={activeTab === t.id} class:hidden-tab={t.hidden}>
					<input
						class="input inline"
						value={t.name}
						aria-label="Tabname"
						onfocus={() => (ui.tab = t.id)}
						oninput={(e) => renameTab(t.id, (e.currentTarget as HTMLInputElement).value)}
					/>
					<button type="button" class="btn ghost small icon" aria-label="Nach links" disabled={i === 0} onclick={() => moveTab(t.id, -1)}><Icon name="back" size={16} /></button>
					<button type="button" class="btn ghost small icon" aria-label="Nach rechts" disabled={i === visibleTabs.length - 1} onclick={() => moveTab(t.id, 1)}><Icon name="chevronRight" size={16} /></button>
					<button type="button" class="btn ghost small icon" aria-label={t.hidden ? 'Einblenden' : 'Ausblenden'} title={t.hidden ? 'Ausgeblendet' : 'Sichtbar'} onclick={() => setTabHidden(t.id, !t.hidden)}>
						<Icon name={t.hidden ? 'eyeOff' : 'eye'} size={16} />
					</button>
					{#if confirmTabDelete === t.id}
						<button type="button" class="btn danger small" onclick={() => { deleteTab(t.id); confirmTabDelete = null; }}>Löschen</button>
					{:else}
						<button type="button" class="btn ghost small icon" aria-label="Tab löschen" onclick={() => (confirmTabDelete = t.id)}><Icon name="trash" size={16} /></button>
					{/if}
				</div>
			{:else}
				<button type="button" class="tab" class:active={activeTab === t.id} aria-current={activeTab === t.id ? 'page' : undefined} onclick={() => (ui.tab = t.id)}>
					{t.name || 'Ohne Namen'}
				</button>
			{/if}
		{/each}
		{#if ui.editMode}
			<button type="button" class="btn ghost small" onclick={() => (ui.tab = addTab('Neuer Tab'))}><Icon name="plus" size={16} /> Tab</button>
		{/if}
		<span class="spacer"></span>
		{#each SYSTEM_TABS as t (t.id)}
			<button type="button" class="tab system" class:active={activeTab === t.id} aria-current={activeTab === t.id ? 'page' : undefined} onclick={() => (ui.tab = t.id)}>
				{t.label}
				{#if t.id === 'sys.fields' && (sheet.evaluation?.unassigned.length ?? 0) > 0}<span class="badge">{sheet.evaluation?.unassigned.length}</span>{/if}
			</button>
		{/each}
	</nav>

	<main class:editing={ui.editMode}>
		{#if activeTab === 'sys.fields'}<Fields />
		{:else if activeTab === 'sys.history'}<History />
		{:else}<LayoutGrid tabId={activeTab} />
		{/if}
	</main>
</div>

<Inspector />
<DragGhost />

<style>
	.sheet {
		min-height: 100vh;
		transition: padding-right 0.16s;
	}
	/* Auf breiten Bildschirmen weicht der Bogen dem Panel aus, schmaler überlagert es. */
	@media (min-width: 1400px) {
		.sheet.with-panel {
			padding-right: 440px;
		}
	}
	.top {
		position: sticky;
		top: 0;
		z-index: 20;
		display: flex;
		align-items: center;
		gap: 6px;
		height: var(--header-h);
		padding: env(safe-area-inset-top) 16px 0;
		background: color-mix(in srgb, var(--bg) 92%, transparent);
		backdrop-filter: blur(8px);
		-webkit-backdrop-filter: blur(8px);
		border-bottom: 1px solid var(--border);
	}
	.home {
		text-decoration: none;
		color: var(--text);
	}
	.name {
		font-family: var(--font-display);
		font-size: 24px;
		font-weight: 650;
		width: 340px;
		min-width: 0;
	}
	.level {
		display: flex;
		align-items: center;
		gap: 2px;
		padding-left: 10px;
		border-left: 1px solid var(--border);
	}
	.spacer {
		flex: 1;
	}
	.export {
		gap: 8px;
		margin-left: 6px;
	}
	.export-text {
		display: flex;
		flex-direction: column;
		align-items: flex-start;
		line-height: 1.1;
	}
	.export small {
		font-size: 11px;
		font-weight: 400;
		color: var(--muted);
	}
	.export.stale small {
		color: var(--accent);
	}
	.tabs {
		display: flex;
		gap: 2px;
		padding: 8px 16px 0;
		border-bottom: 1px solid var(--border);
	}
	.tab {
		position: relative;
		min-height: var(--tap);
		padding: 0 16px;
		border: none;
		border-bottom: 2px solid transparent;
		background: none;
		color: var(--muted);
		font-weight: 500;
		font-size: 15px;
		margin-bottom: -1px;
	}
	.tab:hover {
		color: var(--text);
	}
	.tab.active {
		color: var(--text);
		border-bottom-color: var(--accent);
		font-weight: 600;
	}
	.badge {
		display: inline-flex;
		align-items: center;
		justify-content: center;
		min-width: 18px;
		height: 18px;
		padding: 0 5px;
		margin-left: 4px;
		border-radius: 9px;
		background: var(--accent);
		color: var(--accent-text);
		font-size: 11px;
		font-weight: 700;
	}
	.tabs.editing {
		background: var(--accent-soft);
		padding-bottom: 6px;
		align-items: center;
		flex-wrap: wrap;
		gap: 6px;
	}
	.tab-edit {
		display: flex;
		align-items: center;
		gap: 0;
		padding: 2px 4px;
		border: 1px solid var(--border);
		border-radius: var(--radius-sm);
		background: var(--surface);
	}
	.tab-edit.active {
		border-color: var(--accent);
	}
	.tab-edit.hidden-tab .input {
		opacity: 0.5;
		text-decoration: line-through;
	}
	.tab-edit .input {
		width: 130px;
		min-height: 36px;
		font-weight: 600;
	}
	.tab.system {
		font-size: 14px;
	}
	main {
		padding: 16px;
		padding-bottom: 80px;
		max-width: 1500px;
	}
</style>
