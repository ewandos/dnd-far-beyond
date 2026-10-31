<script lang="ts">
	// Inventar-Container mit Inhalt; verschachtelbar, Ablageziel für Drag & Drop.
	import { addContainer, deleteContainer, updateContainer } from '$lib/store/actions';
	import { sheet } from '$lib/store/sheet.svelte';
	import { ui } from '$lib/store/ui.svelte';
	import { childContainers, itemsIn } from '../containers';
	import { drag, draggable, handleDrop } from '../dnd.svelte';
	import ContainerBox from './ContainerBox.svelte';
	import Icon from './Icon.svelte';
	import ItemRow from './ItemRow.svelte';
	import Switch from './Switch.svelte';

	let { id, depth = 0, bare = false }: { id: string; depth?: number; bare?: boolean } = $props();
	const c = $derived(sheet.character!);
	const ct = $derived(c.containers[id]);
	const items = $derived(itemsIn(c, id));
	const children = $derived(childContainers(c, id));
	const isOver = $derived(drag.over === id && !!drag.payload);
	let menu = $state(false);
</script>

{#if ct}
	<div class="container" class:bare class:nested={depth > 0} class:equipped={ct.equipped} class:over={isOver} data-drop-container={id} data-container={id}>
		<div class="head">
			{#if depth > 0}
				<span class="grip" use:draggable={{ payload: { kind: 'container', id, label: ct.name }, ondrop: handleDrop }} title="Ziehen zum Verschieben" aria-hidden="true">
					<Icon name="grip" size={18} stroke={3} />
				</span>
			{/if}
			<Icon name="folder" size={18} />
			<input class="input inline name" value={ct.name} aria-label="Containername" oninput={(e) => updateContainer(id, 'name', (e.currentTarget as HTMLInputElement).value)} />
			<span class="eq" class:on={ct.equipped}>{ct.equipped ? 'ausgerüstet' : ''}</span>
			<Switch small checked={ct.equipped} label="Als „ausgerüstet“ markieren" onchange={(v) => updateContainer(id, 'equipped', v)} />
			<button type="button" class="btn ghost small icon" aria-label="Container-Menü" aria-expanded={menu} onclick={() => (menu = !menu)}>
				<Icon name="chevronDown" size={16} />
			</button>
		</div>
		{#if menu}
			<div class="menu">
				<button type="button" class="btn small" onclick={() => { addContainer('Beutel', id); menu = false; }}>
					<Icon name="plus" size={16} /> Container darin
				</button>
				<button
					type="button"
					class="btn small danger"
					onclick={() => {
						if (!deleteContainer(id)) ui.toast('Der letzte Container mit Inhalt kann nicht gelöscht werden.');
						menu = false;
					}}
				>
					<Icon name="trash" size={16} /> Löschen (Inhalt wandert eine Ebene höher)
				</button>
			</div>
		{/if}
		{#if ct.equipped && depth === 0}
			<p class="hint">Nur Items direkt in diesem Container wirken.</p>
		{/if}
		<div class="content">
			{#each items as i (i.id)}<ItemRow id={i.id} />{/each}
			{#each children as child (child.id)}<ContainerBox id={child.id} depth={depth + 1} />{/each}
			{#if !items.length && !children.length}
				<p class="empty drop">Leer – Items hierher ziehen</p>
			{/if}
		</div>
	</div>
{/if}

<style>
	.container {
		border: 1px solid var(--border);
		border-radius: var(--radius);
		background: var(--surface);
		padding: 6px 12px 8px;
		transition:
			border-color 0.1s,
			background 0.1s;
	}
	.container.equipped {
		border-color: color-mix(in srgb, var(--accent) 45%, var(--border));
	}
	.container.bare {
		border: none;
		background: transparent;
		padding: 0;
		box-shadow: none;
	}
	.container.bare.over {
		background: var(--accent-soft);
		box-shadow: 0 0 0 2px var(--accent);
	}
	.container.nested {
		margin: 6px 0 4px;
		background: var(--surface-2);
	}
	.container.over {
		border-color: var(--accent);
		background: var(--accent-soft);
		box-shadow: 0 0 0 2px var(--accent);
	}
	.head {
		display: flex;
		align-items: center;
		gap: 6px;
		color: var(--muted);
	}
	.grip {
		display: inline-flex;
		cursor: grab;
		color: var(--faint);
		padding: 8px 0;
	}
	.name {
		flex: 1;
		font-family: var(--font-display);
		font-weight: 600;
		font-size: 17px;
		color: var(--text);
		min-width: 0;
	}
	.eq {
		font-size: 12px;
	}
	.eq.on {
		color: var(--accent);
		font-weight: 600;
	}
	.menu {
		display: flex;
		gap: 6px;
		flex-wrap: wrap;
		padding: 6px 0;
	}
	.hint {
		margin: 0 0 2px;
		font-size: 12px;
		color: var(--faint);
	}
	.empty.drop {
		font-size: 13px;
	}
</style>
