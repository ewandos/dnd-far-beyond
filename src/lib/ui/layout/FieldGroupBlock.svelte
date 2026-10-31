<script lang="ts">
	// Mehrere Felder als Liste (mit Übungs-Markern) oder als Kacheln.
	import type { FieldGroupBlockConfig } from '$lib/engine/types';
	import { ATTRIBUTES, SKILLS, STD } from '$lib/model/defaults';
	import { sheet } from '$lib/store/sheet.svelte';
	import { sortedFields } from '../fields';
	import FieldRow from '../components/FieldRow.svelte';
	import FieldValue from '../components/FieldValue.svelte';

	let { config }: { config: FieldGroupBlockConfig } = $props();
	const c = $derived(sheet.character!);

	const SKILL_ATTR = new Map(SKILLS.map((s) => [STD.skill(s.key), ATTRIBUTES.find((a) => a.key === s.attr)!.name]));

	const fields = $derived.by(() => {
		if (config.fieldIds?.length) return config.fieldIds.map((id) => c.fields[id]).filter((f) => f && !f.hidden);
		if (config.group !== undefined) return sortedFields(c, { group: config.group });
		return [];
	});
	// Standard-Attribute zeigen ihren Modifikator in der Kachel (std.str ↔ std.str_mod).
	const companion = (id: string) => {
		const mod = c.fields[`${id}_mod`];
		return mod && !mod.hidden ? mod : undefined;
	};
</script>

{#if config.display === 'tiles'}
	<div class="tiles">
		{#each fields as f (f.id)}
			{@const mod = companion(f.id)}
			<div class="tile">
				<span class="label" title={f.notes ?? ''}>{f.name}</span>
				<FieldValue id={f.id} size="lg" />
				{#if mod}<span class="mod"><FieldValue id={mod.id} size="sm" label={mod.name} /></span>{/if}
			</div>
		{/each}
	</div>
{:else}
	<div class="list">
		{#each fields as f (f.id)}<FieldRow id={f.id} hint={SKILL_ATTR.get(f.id)} />{/each}
	</div>
{/if}
{#if !fields.length}<p class="empty">Keine Felder.</p>{/if}

<style>
	.tiles {
		display: grid;
		grid-template-columns: repeat(auto-fill, minmax(92px, 1fr));
		gap: 8px;
	}
	.tile {
		display: flex;
		flex-direction: column;
		align-items: center;
		padding: 6px 4px;
		border: 1px solid var(--border);
		border-radius: var(--radius-sm);
		background: var(--surface-2);
		min-width: 0;
	}
	.label {
		font-size: 11.5px;
		font-weight: 650;
		letter-spacing: 0.07em;
		color: var(--muted);
		text-transform: uppercase;
		max-width: 100%;
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
	}
	.mod {
		border-radius: 18px;
		background: var(--surface);
		border: 1px solid var(--border);
	}
	.mod :global(.value) {
		min-height: 30px;
		padding: 0 10px;
	}
	.empty {
		margin: 0;
	}
</style>
