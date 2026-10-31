<script lang="ts">
	import { spellLevelLabel } from '$lib/store/actions';
	import { sheet } from '$lib/store/sheet.svelte';
	import { ui } from '$lib/store/ui.svelte';
	import Markdown from './Markdown.svelte';

	let { id, showDescription = false }: { id: string; showDescription?: boolean } = $props();
	const s = $derived(sheet.character?.spells[id]);
	const selected = $derived(ui.panel?.kind === 'spell' && ui.panel.id === id);
	const facts = $derived(s ? [s.castingTime, s.range, s.duration].filter((x) => x?.trim()) : []);
</script>

{#if s}
	<div class="spell" class:selected data-spell={id}>
		<button type="button" class="head" onclick={() => ui.open({ kind: 'spell', id })}>
			<span class="lvl num" title={spellLevelLabel(s.level)}>{s.level <= 0 ? 'Z' : s.level}</span>
			<span class="name">{s.name}</span>
			{#if s.concentration}<span class="badge" title="Konzentration">K</span>{/if}
			{#if s.ritual}<span class="badge" title="Ritual">R</span>{/if}
			{#if s.school}<span class="school">{s.school}</span>{/if}
		</button>
		{#if facts.length || s.tags.length}
			<div class="facts">
				{facts.join(' · ')}
				{#each s.tags as t (t)}<span class="tag">{t}</span>{/each}
			</div>
		{/if}
		{#if showDescription && s.description.trim()}
			<div class="desc"><Markdown source={s.description} /></div>
		{/if}
	</div>
{/if}

<style>
	.spell {
		padding: 2px 0 6px;
		border-bottom: 1px solid color-mix(in srgb, var(--border) 70%, transparent);
	}
	.spell:last-child {
		border-bottom: none;
	}
	.head {
		display: flex;
		align-items: center;
		gap: 8px;
		width: 100%;
		min-height: 40px;
		padding: 0;
		border: none;
		background: none;
		text-align: left;
	}
	.lvl {
		display: inline-flex;
		align-items: center;
		justify-content: center;
		width: 24px;
		height: 24px;
		border-radius: 50%;
		border: 1.5px solid var(--accent);
		color: var(--accent);
		font-size: 12px;
		font-weight: 700;
		flex-shrink: 0;
	}
	.name {
		font-family: var(--font-display);
		font-weight: 600;
		font-size: 16px;
	}
	.head:hover .name,
	.selected .name {
		color: var(--accent);
	}
	.badge {
		font-size: 10.5px;
		font-weight: 700;
		color: var(--muted);
		border: 1px solid var(--border-strong);
		border-radius: 4px;
		padding: 0 4px;
	}
	.school {
		margin-left: auto;
		font-size: 12px;
		color: var(--muted);
	}
	.facts {
		display: flex;
		flex-wrap: wrap;
		gap: 4px 8px;
		align-items: center;
		padding-left: 32px;
		font-size: 12.5px;
		color: var(--muted);
	}
	.tag {
		background: var(--surface-2);
		border-radius: 4px;
		padding: 0 6px;
	}
	.desc {
		padding: 4px 0 0 32px;
		font-size: 14px;
	}
</style>
