<script lang="ts">
	import { sheet } from '$lib/store/sheet.svelte';
	import { ui } from '$lib/store/ui.svelte';
	import { proficiencyFor } from '../fields';
	import FieldValue from './FieldValue.svelte';
	import ProfMarker from './ProfMarker.svelte';

	let { id, hint, showProf = true }: { id: string; hint?: string; showProf?: boolean } = $props();
	const c = $derived(sheet.character!);
	const field = $derived(c.fields[id]);
	const prof = $derived(showProf ? proficiencyFor(c, id) : undefined);
	const hasNotes = $derived(!!field?.notes?.trim());
</script>

{#if field}
	<div class="row" class:with-prof={showProf}>
		{#if showProf}
			{#if prof}<ProfMarker id={prof.id} />{:else}<span class="pad"></span>{/if}
		{/if}
		<button type="button" class="name" onclick={() => ui.open({ kind: 'field', id })} title={field.notes ?? ''}>
			{field.name}
			{#if hint}<span class="hint">{hint}</span>{/if}
			{#if hasNotes}<span class="dot" aria-label="hat Notizen"></span>{/if}
		</button>
		<FieldValue {id} size="md" />
	</div>
{/if}

<style>
	.row {
		display: flex;
		align-items: center;
		gap: 2px;
		min-height: 40px;
		border-bottom: 1px solid color-mix(in srgb, var(--border) 60%, transparent);
	}
	.row:last-child {
		border-bottom: none;
	}
	.pad {
		width: 36px;
		flex-shrink: 0;
	}
	.name {
		flex: 1;
		min-width: 0;
		display: flex;
		align-items: center;
		gap: 6px;
		min-height: 40px;
		padding: 0 4px;
		border: none;
		background: none;
		text-align: left;
		font-size: 14.5px;
		overflow: hidden;
		white-space: nowrap;
	}
	.name:hover {
		color: var(--accent);
	}
	.hint {
		font-size: 11px;
		color: var(--faint);
		letter-spacing: 0.04em;
	}
	.dot {
		width: 5px;
		height: 5px;
		border-radius: 50%;
		background: var(--accent);
		align-self: center;
	}
	.row :global(.value) {
		min-width: 52px;
		justify-content: flex-end;
	}
</style>
