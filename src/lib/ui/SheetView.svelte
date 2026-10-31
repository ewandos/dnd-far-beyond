<script lang="ts">
	import { STD } from '$lib/model/defaults';
	import { renameCharacter } from '$lib/store/actions';
	import { exportCharacterFile } from '$lib/store/files';
	import { sheet } from '$lib/store/sheet.svelte';
	import { TABS, ui } from '$lib/store/ui.svelte';
	import { relativeTime } from './format';
	import DragGhost from './components/DragGhost.svelte';
	import FieldValue from './components/FieldValue.svelte';
	import Icon from './components/Icon.svelte';
	import Inspector from './inspector/Inspector.svelte';
	import Abilities from './tabs/Abilities.svelte';
	import Fields from './tabs/Fields.svelte';
	import History from './tabs/History.svelte';
	import Inventory from './tabs/Inventory.svelte';
	import Notes from './tabs/Notes.svelte';
	import Overview from './tabs/Overview.svelte';

	let { onexported }: { onexported?: () => void } = $props();
	const c = $derived(sheet.character!);

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

	<nav class="tabs" aria-label="Bereiche">
		{#each TABS as t (t.id)}
			<button type="button" class="tab" class:active={ui.tab === t.id} aria-current={ui.tab === t.id ? 'page' : undefined} onclick={() => (ui.tab = t.id)}>
				{t.label}
				{#if t.id === 'fields' && (sheet.evaluation?.unassigned.length ?? 0) > 0}<span class="badge">{sheet.evaluation?.unassigned.length}</span>{/if}
			</button>
		{/each}
	</nav>

	<main>
		{#if ui.tab === 'overview'}<Overview />
		{:else if ui.tab === 'inventory'}<Inventory />
		{:else if ui.tab === 'abilities'}<Abilities />
		{:else if ui.tab === 'fields'}<Fields />
		{:else if ui.tab === 'notes'}<Notes />
		{:else if ui.tab === 'history'}<History />
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
	main {
		padding: 16px;
		padding-bottom: 80px;
		max-width: 1500px;
	}
</style>
