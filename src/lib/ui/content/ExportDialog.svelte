<script lang="ts">
	// Mehrere Inhalte als eine Datei exportieren – z. B. die Beute einer Sitzung für alle Spieler.
	import type { ContentRef } from '$lib/model/content';
	import { sheet } from '$lib/store/sheet.svelte';
	import { ui } from '$lib/store/ui.svelte';
	import Icon from '../components/Icon.svelte';
	import { exportEntries } from './io';

	let { onclose }: { onclose: () => void } = $props();
	const c = $derived(sheet.character!);
	let query = $state('');
	let selected = $state<Set<string>>(new Set());

	const byName = <T extends { name: string }>(a: T, b: T) => a.name.localeCompare(b.name, 'de');
	const groups = $derived([
		{ title: 'Items', type: 'item' as const, list: Object.values(c.items).sort(byName) },
		{ title: 'Fähigkeiten', type: 'ability' as const, list: Object.values(c.abilities).filter((a) => a.kind === 'ability').sort(byName) },
		{ title: 'Zustände', type: 'ability' as const, list: Object.values(c.abilities).filter((a) => a.kind === 'condition').sort(byName) },
		{ title: 'Zauber', type: 'spell' as const, list: Object.values(c.spells).sort(byName) }
	]);
	const match = (name: string) => !query.trim() || name.toLowerCase().includes(query.trim().toLowerCase());
	const key = (type: string, id: string) => `${type}:${id}`;

	function toggle(k: string, on: boolean) {
		const next = new Set(selected);
		if (on) next.add(k);
		else next.delete(k);
		selected = next;
	}

	async function doExport() {
		const refs: ContentRef[] = [...selected].map((k) => {
			const [type, ...rest] = k.split(':');
			return { type: type as ContentRef['type'], id: rest.join(':') };
		});
		const result = await exportEntries(refs);
		if (result !== 'cancelled') {
			ui.toast(`${refs.length} Inhalt${refs.length === 1 ? '' : 'e'} exportiert`);
			onclose();
		}
	}
</script>

<svelte:window onkeydown={(e) => e.key === 'Escape' && onclose()} />

<div class="backdrop" role="presentation" onclick={(e) => e.target === e.currentTarget && onclose()}>
	<div class="dialog card" role="dialog" aria-modal="true" aria-labelledby="export-title">
		<header>
			<h2 id="export-title" class="section-title">Inhalte exportieren</h2>
			<button type="button" class="btn ghost icon" aria-label="Schließen" onclick={onclose}><Icon name="x" /></button>
		</header>
		<div class="body">
			<input class="input" type="search" placeholder="Suchen …" aria-label="Inhalte suchen" bind:value={query} />
			{#each groups as g (g.title)}
				{@const shown = g.list.filter((x) => match(x.name))}
				{#if shown.length}
					<section>
						<span class="eyebrow">{g.title}</span>
						{#each shown as x (x.id)}
							<label class="check"><input type="checkbox" checked={selected.has(key(g.type, x.id))} onchange={(e) => toggle(key(g.type, x.id), (e.currentTarget as HTMLInputElement).checked)} /> {x.name}</label>
						{/each}
					</section>
				{/if}
			{/each}
			{#if groups.every((g) => !g.list.length)}<p class="empty">Noch keine Items, Fähigkeiten, Zustände oder Zauber.</p>{/if}
			<p class="muted small">Die Datei enthält Beschreibung, Modifikatoren und Nutzungs-Kästchen – aber nicht, wo ein Item liegt.</p>
		</div>
		<footer>
			<span class="spacer"></span>
			<button type="button" class="btn ghost" onclick={onclose}>Abbrechen</button>
			<button type="button" class="btn primary" disabled={!selected.size} onclick={doExport}><Icon name="download" size={18} /> {selected.size || ''} Exportieren</button>
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
		width: 520px;
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
		gap: 10px;
	}
	section {
		display: flex;
		flex-direction: column;
	}
	section .check {
		min-height: 38px;
	}
	.small {
		font-size: 13px;
		margin: 0;
	}
</style>
