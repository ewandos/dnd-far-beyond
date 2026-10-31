<script lang="ts">
	// Ein Eintrag der Aktionsübersicht: Name, Herkunft, Angriff, Schaden, SG, Nutzungen.
	import type { ActionView } from '$lib/engine/actions';
	import { ui } from '$lib/store/ui.svelte';
	import CounterBoxes from './CounterBoxes.svelte';
	import Icon from './Icon.svelte';

	let { view }: { view: ActionView } = $props();
	const selected = $derived(
		(view.actionId && ui.panel?.kind === 'action' && ui.panel.id === view.actionId) ||
			(view.spellId && ui.panel?.kind === 'spell' && ui.panel.id === view.spellId)
	);

	function open() {
		if (view.spellId) ui.open({ kind: 'spell', id: view.spellId });
		else if (view.actionId) ui.open({ kind: 'action', id: view.actionId });
	}
	const originIcon = $derived(view.origin.kind === 'item' ? 'box' : view.origin.kind === 'ability' ? 'book' : view.origin.kind === 'spell' ? 'sparkle' : null);
</script>

<div class="entry" class:inactive={!view.active} class:selected data-action={view.key}>
	<button type="button" class="head" onclick={open}>
		<span class="name">{view.name}</span>
		{#if view.spellLevel !== undefined}<span class="lvl" title="Zaubergrad">{view.spellLevel <= 0 ? 'Z' : view.spellLevel}</span>{/if}
		{#if view.concentration}<span class="badge" title="Konzentration">K</span>{/if}
		{#if originIcon && view.origin.name}
			<span class="origin" title="Herkunft"><Icon name={originIcon} size={13} />{view.origin.name}</span>
		{/if}
	</button>
	{#if view.attack || view.damage || view.save || view.range}
		<div class="stats num">
			{#if view.attack}<span class="stat atk" class:error={!!view.attack.error} title={view.attack.error ?? 'Angriffsbonus'}>{view.attack.text}</span>{/if}
			{#if view.damage}<span class="stat" class:error={!!view.damage.error} title={view.damage.error ?? 'Schaden'}>{view.damage.text}{view.damageType ? ` ${view.damageType}` : ''}</span>{/if}
			{#if view.save}<span class="stat" class:error={!!view.save.error} title={view.save.error ?? 'Rettungswurf'}>{view.save.text}</span>{/if}
			{#if view.range}<span class="range">{view.range}</span>{/if}
		</div>
	{/if}
	{#if view.trigger}<div class="trigger">Auslöser: {view.trigger}</div>{/if}
	{#if !view.active && view.inactiveReason}<div class="reason">{view.inactiveReason}</div>{/if}
	{#if view.counterId}<CounterBoxes id={view.counterId} label="Nutzungen" compact />{/if}
</div>

<style>
	.entry {
		padding: 2px 0 6px;
		border-bottom: 1px solid color-mix(in srgb, var(--border) 70%, transparent);
	}
	.head {
		display: flex;
		align-items: center;
		flex-wrap: wrap;
		gap: 4px 8px;
		width: 100%;
		min-height: 38px;
		padding: 0;
		border: none;
		background: none;
		text-align: left;
	}
	.name {
		font-family: var(--font-display);
		font-weight: 600;
		font-size: 15.5px;
	}
	.head:hover .name,
	.selected .name {
		color: var(--accent);
	}
	.lvl {
		display: inline-flex;
		align-items: center;
		justify-content: center;
		width: 20px;
		height: 20px;
		border-radius: 50%;
		border: 1.5px solid var(--accent);
		color: var(--accent);
		font-size: 11px;
		font-weight: 700;
	}
	.badge {
		font-size: 10.5px;
		font-weight: 700;
		color: var(--muted);
		border: 1px solid var(--border-strong);
		border-radius: 4px;
		padding: 0 4px;
	}
	.origin {
		display: inline-flex;
		align-items: center;
		gap: 3px;
		margin-left: auto;
		font-size: 12px;
		color: var(--muted);
	}
	.stats {
		display: flex;
		flex-wrap: wrap;
		gap: 4px 6px;
		align-items: center;
	}
	.stat {
		padding: 1px 8px;
		border-radius: 12px;
		background: var(--surface-2);
		border: 1px solid var(--border);
		font-size: 13px;
		font-weight: 600;
	}
	.stat.atk {
		background: var(--accent-soft);
		border-color: color-mix(in srgb, var(--accent) 40%, var(--border));
	}
	.stat.error {
		color: var(--danger);
		border-color: var(--danger);
	}
	.range {
		font-size: 12.5px;
		color: var(--muted);
	}
	.trigger,
	.reason {
		font-size: 12.5px;
		color: var(--muted);
		font-style: italic;
		margin-top: 2px;
	}
	.inactive .head,
	.inactive .stats {
		opacity: 0.45;
	}
</style>
