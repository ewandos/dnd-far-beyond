<script lang="ts">
	// Raster eines Tabs. Spielmodus: fixiert. Bearbeitungsmodus: Bausteine ziehen, Größe ändern,
	// konfigurieren, entfernen und hinzufügen. Überdeckte Bausteine rutschen live nach unten.
	import type { Block } from '$lib/engine/types';
	import { bottom, cellSize, clampRect, GRID_COLUMNS, GRID_GAP, placeBlock, ROW_HEIGHT, type Rect } from '$lib/model/layout';
	import { BLOCK_LABEL, moveBlock, removeBlock } from '$lib/store/layoutActions';
	import { sheet } from '$lib/store/sheet.svelte';
	import { ui } from '$lib/store/ui.svelte';
	import Icon from '../components/Icon.svelte';
	import BlockDialog from './BlockDialog.svelte';
	import BlockFrame from './BlockFrame.svelte';
	import { blockTitle } from './blocks';

	let { tabId }: { tabId: string } = $props();

	const c = $derived(sheet.character!);
	const tab = $derived(c.layout.tabs.find((t) => t.id === tabId));
	let gridEl: HTMLDivElement | undefined = $state();

	interface Interaction {
		id: string;
		mode: 'move' | 'resize';
		startX: number;
		startY: number;
		pointerId: number;
		orig: Rect;
		preview: Rect;
	}
	let active = $state<Interaction | null>(null);
	let dialog = $state<{ block?: Block } | null>(null);
	let confirmRemove = $state<string | null>(null);

	const shown = $derived.by(() => {
		const blocks = tab?.blocks ?? [];
		return active ? placeBlock(blocks, active.id, active.preview) : blocks;
	});
	const rows = $derived(Math.max(bottom(shown) + (ui.editMode ? 4 : 0), ui.editMode ? 8 : 1));

	function begin(e: PointerEvent, b: Block, mode: Interaction['mode']) {
		if (e.button !== 0) return;
		e.preventDefault();
		e.stopPropagation();
		const orig = { x: b.x, y: b.y, w: b.w, h: b.h };
		active = { id: b.id, mode, startX: e.clientX, startY: e.clientY, pointerId: e.pointerId, orig, preview: orig };
		window.addEventListener('pointermove', onMove);
		window.addEventListener('pointerup', onUp);
		window.addEventListener('pointercancel', onCancel);
	}

	function onMove(e: PointerEvent) {
		if (!active || e.pointerId !== active.pointerId || !gridEl) return;
		e.preventDefault();
		const { col, row } = cellSize(gridEl.clientWidth);
		const dx = Math.round((e.clientX - active.startX) / col);
		const dy = Math.round((e.clientY - active.startY) / row);
		const o = active.orig;
		const next =
			active.mode === 'move'
				? clampRect({ x: o.x + dx, y: o.y + dy, w: o.w, h: o.h })
				: clampRect({ x: o.x, y: o.y, w: Math.min(o.w + dx, GRID_COLUMNS - o.x), h: o.h + dy });
		const p = active.preview;
		if (next.x !== p.x || next.y !== p.y || next.w !== p.w || next.h !== p.h) active.preview = next;
	}

	function onUp(e: PointerEvent) {
		if (active && e.pointerId === active.pointerId) moveBlock(tabId, active.id, active.preview);
		onCancel();
	}

	function onCancel() {
		active = null;
		window.removeEventListener('pointermove', onMove);
		window.removeEventListener('pointerup', onUp);
		window.removeEventListener('pointercancel', onCancel);
	}

	$effect(() => onCancel);

	/** Tastatur im Bearbeitungsmodus: Pfeile verschieben, mit Umschalt Größe ändern. */
	function onKey(e: KeyboardEvent, b: Block) {
		const d = { ArrowLeft: [-1, 0], ArrowRight: [1, 0], ArrowUp: [0, -1], ArrowDown: [0, 1] }[e.key];
		if (!d) return;
		e.preventDefault();
		const r = e.shiftKey ? { x: b.x, y: b.y, w: b.w + d[0], h: b.h + d[1] } : { x: b.x + d[0], y: b.y + d[1], w: b.w, h: b.h };
		moveBlock(tabId, b.id, clampRect(r));
	}
</script>

{#if tab}
	<div
		class="grid"
		class:edit={ui.editMode}
		class:busy={!!active}
		bind:this={gridEl}
		style:grid-template-columns="repeat({GRID_COLUMNS}, minmax(0, 1fr))"
		style:grid-template-rows="repeat({rows}, {ROW_HEIGHT}px)"
		style:gap="{GRID_GAP}px"
		data-tab={tabId}
	>
		{#if ui.editMode}
			{#each Array.from({ length: rows * GRID_COLUMNS }, (_, i) => i) as i (i)}
				<div class="cell" style:grid-column={(i % GRID_COLUMNS) + 1} style:grid-row={Math.floor(i / GRID_COLUMNS) + 1}></div>
			{/each}
		{/if}

		{#each shown as b (b.id)}
			<div class="block" class:moving={active?.id === b.id} style:grid-column="{b.x + 1} / span {b.w}" style:grid-row="{b.y + 1} / span {b.h}">
				<div class="inner" inert={ui.editMode}>
					<BlockFrame block={b} />
				</div>
				{#if ui.editMode}
					<div
						class="overlay"
						role="button"
						tabindex="0"
						aria-label="{BLOCK_LABEL[b.type]} {blockTitle(c, b) ?? ''} – ziehen zum Verschieben, Pfeiltasten verschieben, Umschalt+Pfeil ändert die Größe"
						onpointerdown={(e) => begin(e, b, 'move')}
						onkeydown={(e) => onKey(e, b)}
					>
						<span class="kind"><Icon name="grip" size={16} stroke={3} /> {BLOCK_LABEL[b.type]}</span>
						<div class="tools">
							{#if confirmRemove === b.id}
								<button type="button" class="btn danger small" onpointerdown={(e) => e.stopPropagation()} onclick={() => { removeBlock(tabId, b.id); confirmRemove = null; }}>Entfernen</button>
								<button type="button" class="btn small" onpointerdown={(e) => e.stopPropagation()} onclick={() => (confirmRemove = null)}>Nein</button>
							{:else}
								<button type="button" class="btn small icon" aria-label="Baustein einstellen" title="Einstellen" onpointerdown={(e) => e.stopPropagation()} onclick={() => (dialog = { block: b })}>
									<Icon name="edit" size={16} />
								</button>
								<button type="button" class="btn small icon" aria-label="Baustein entfernen" title="Entfernen" onpointerdown={(e) => e.stopPropagation()} onclick={() => (confirmRemove = b.id)}>
									<Icon name="x" size={16} />
								</button>
							{/if}
						</div>
						<span class="size num">{b.w} × {b.h}</span>
						<span class="resize" role="presentation" title="Größe ändern" onpointerdown={(e) => begin(e, b, 'resize')}></span>
					</div>
				{/if}
			</div>
		{/each}
	</div>

	{#if ui.editMode}
		<div class="add">
			<button type="button" class="btn primary" onclick={() => (dialog = {})}><Icon name="plus" size={18} /> Baustein hinzufügen</button>
			<span class="muted hint">Bausteine ziehen zum Verschieben, Ecke unten rechts für die Größe. Überdeckte Bausteine rutschen nach unten.</span>
		</div>
	{:else if !tab.blocks.length}
		<div class="card empty-tab">
			<p>Dieser Tab ist leer.</p>
			<button type="button" class="btn" onclick={() => (ui.editMode = true)}><Icon name="edit" size={18} /> Layout bearbeiten</button>
		</div>
	{/if}

	{#if dialog}
		<BlockDialog {tabId} block={dialog.block} onclose={() => (dialog = null)} />
	{/if}
{/if}

<style>
	.grid {
		display: grid;
		position: relative;
	}
	.cell {
		border: 1px dashed color-mix(in srgb, var(--border-strong) 55%, transparent);
		border-radius: 4px;
		pointer-events: none;
	}
	.block {
		position: relative;
		min-width: 0;
		min-height: 0;
		z-index: 1;
	}
	.inner {
		height: 100%;
	}
	.edit .block .inner {
		opacity: 0.75;
	}
	.block.moving {
		z-index: 5;
	}
	.block.moving .overlay {
		background: color-mix(in srgb, var(--accent-soft) 70%, transparent);
		box-shadow: var(--shadow-lg);
	}
	.busy .block:not(.moving) {
		transition: transform 0.1s;
	}
	.overlay {
		position: absolute;
		inset: 0;
		border: 2px dashed var(--accent);
		border-radius: var(--radius);
		background: color-mix(in srgb, var(--surface) 35%, transparent);
		cursor: grab;
		touch-action: none;
		user-select: none;
		-webkit-user-select: none;
	}
	.overlay:active {
		cursor: grabbing;
	}
	.overlay:focus-visible {
		outline: 3px solid var(--accent);
	}
	.kind {
		position: absolute;
		top: 6px;
		left: 8px;
		display: inline-flex;
		align-items: center;
		gap: 4px;
		padding: 2px 8px 2px 4px;
		border-radius: 12px;
		background: var(--accent);
		color: var(--accent-text);
		font-size: 12px;
		font-weight: 600;
	}
	.tools {
		position: absolute;
		top: 4px;
		right: 4px;
		display: flex;
		gap: 4px;
	}
	.tools .btn {
		box-shadow: var(--shadow);
	}
	.size {
		position: absolute;
		left: 8px;
		bottom: 6px;
		font-size: 11px;
		color: var(--accent);
		font-weight: 600;
	}
	.resize {
		position: absolute;
		right: 0;
		bottom: 0;
		width: 36px;
		height: 36px;
		cursor: nwse-resize;
		touch-action: none;
		background:
			linear-gradient(135deg, transparent 50%, var(--accent) 50%, var(--accent) 58%, transparent 58%, transparent 68%, var(--accent) 68%, var(--accent) 76%, transparent 76%);
		border-bottom-right-radius: var(--radius);
	}
	.add {
		display: flex;
		align-items: center;
		gap: 12px;
		margin-top: 16px;
	}
	.hint {
		font-size: 13px;
	}
	.empty-tab {
		padding: 24px;
		display: flex;
		flex-direction: column;
		align-items: flex-start;
		gap: 8px;
	}
	.empty-tab p {
		margin: 0;
	}
</style>
