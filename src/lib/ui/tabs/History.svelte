<script lang="ts">
	// „Was ist wann passiert?“ – filterbar nach Feld oder Objekt.
	import type { HistoryEvent } from '$lib/engine/types';
	import { sheet } from '$lib/store/sheet.svelte';
	import { ui } from '$lib/store/ui.svelte';
	import { formatDateTime } from '../format';
	import Icon from '../components/Icon.svelte';

	const c = $derived(sheet.character!);

	function objectName(e: HistoryEvent): string {
		return (
			c.fields[e.target]?.name ??
			c.items[e.target]?.name ??
			c.abilities[e.target]?.name ??
			c.containers[e.target]?.name ??
			c.counters[e.target]?.name ??
			c.texts[e.target]?.title ??
			''
		);
	}

	const KIND_GROUPS: Record<string, string> = {
		field: 'Felder',
		modifier: 'Modifikatoren',
		item: 'Items',
		container: 'Container',
		ability: 'Fähigkeiten & Zustände',
		proficiency: 'Übung',
		counter: 'Zähler',
		text: 'Notizen',
		character: 'Charakter'
	};
	let kind = $state('');

	const events = $derived.by(() => {
		const q = ui.historyFilter.trim().toLowerCase();
		const list = c.history
			.map((e, index) => ({ e, index, name: objectName(e) }))
			.filter(({ e, name }) => {
				if (kind && !e.kind.startsWith(kind + '.')) return false;
				if (!q) return true;
				return e.title.toLowerCase().includes(q) || name.toLowerCase().includes(q) || e.target.toLowerCase() === q;
			});
		return list.reverse().slice(0, 500);
	});

	const show = (v: unknown) => (v === undefined || v === null || v === '' ? '—' : typeof v === 'number' ? v.toLocaleString('de-DE') : String(v));
</script>

<div class="history">
	<div class="toolbar">
		<input class="input" type="search" placeholder="Filtern nach Feld oder Objekt, z. B. „TP aktuell“" aria-label="Verlauf filtern" bind:value={ui.historyFilter} />
		<select class="select kind" bind:value={kind} aria-label="Art">
			<option value="">Alle Arten</option>
			{#each Object.entries(KIND_GROUPS) as [k, label] (k)}<option value={k}>{label}</option>{/each}
		</select>
		<button type="button" class="btn" disabled={!sheet.canUndo} onclick={() => sheet.undo()}><Icon name="undo" size={18} /> Rückgängig</button>
		<button type="button" class="btn" disabled={!sheet.canRedo} onclick={() => sheet.redo()}><Icon name="redo" size={18} /> Wiederholen</button>
	</div>

	<section class="card">
		{#if events.length}
			<ol>
				{#each events as { e, index, name } (e.id)}
					<li>
						<time class="num" datetime={e.at}>{formatDateTime(e.at)}</time>
						<span class="title">
							{e.title}
							{#if name && !e.title.includes(name)}<span class="muted"> · {name}</span>{/if}
						</span>
						{#if e.before !== undefined || e.after !== undefined}
							<span class="change num"><span class="before">{show(e.before)}</span> → <strong>{show(e.after)}</strong></span>
						{:else}
							<span></span>
						{/if}
						{#if index === c.history.length - 1}
							<span class="latest">zuletzt</span>
						{/if}
					</li>
				{/each}
			</ol>
		{:else}
			<p class="empty pad">{c.history.length ? 'Keine passenden Einträge.' : 'Noch keine Änderungen.'}</p>
		{/if}
	</section>
	<p class="muted small">
		Schnelle Folgeänderungen am selben Wert werden zusammengefasst. Gespeichert werden die letzten 2000 Änderungen; sie reisen mit der Export-Datei.
	</p>
</div>

<style>
	.history {
		display: flex;
		flex-direction: column;
		gap: 12px;
	}
	.toolbar {
		display: flex;
		gap: 8px;
	}
	.toolbar .input {
		flex: 1;
	}
	.kind {
		width: 220px;
	}
	ol {
		list-style: none;
		margin: 0;
		padding: 4px 0;
	}
	li {
		display: grid;
		grid-template-columns: 170px 1fr auto 60px;
		gap: 12px;
		align-items: baseline;
		padding: 9px 16px;
		border-bottom: 1px solid color-mix(in srgb, var(--border) 60%, transparent);
	}
	li:last-child {
		border-bottom: none;
	}
	time {
		font-size: 13px;
		color: var(--muted);
	}
	.change {
		white-space: nowrap;
	}
	.before {
		color: var(--muted);
	}
	.latest {
		font-size: 11px;
		color: var(--accent);
		text-transform: uppercase;
		letter-spacing: 0.06em;
	}
	.pad {
		padding: 16px;
	}
	.small {
		font-size: 13px;
		margin: 0;
	}
</style>
