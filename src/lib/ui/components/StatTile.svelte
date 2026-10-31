<script lang="ts">
	import { sheet } from '$lib/store/sheet.svelte';
	import FieldValue from './FieldValue.svelte';

	let { id, label, sub }: { id: string; label?: string; sub?: string } = $props();
	const field = $derived(sheet.character?.fields[id]);
</script>

{#if field && !field.hidden}
	<div class="tile">
		<span class="label">{label ?? field.name}</span>
		<FieldValue {id} size="xl" />
		{#if sub}<span class="sub">{sub}</span>{/if}
	</div>
{/if}

<style>
	.tile {
		display: flex;
		flex-direction: column;
		align-items: center;
		gap: 2px;
		padding: 10px 6px 8px;
		background: var(--surface);
		border: 1px solid var(--border);
		border-radius: var(--radius);
		min-width: 0;
	}
	.label {
		font-size: 11.5px;
		font-weight: 600;
		letter-spacing: 0.07em;
		text-transform: uppercase;
		color: var(--muted);
		text-align: center;
		white-space: nowrap;
		overflow: hidden;
		text-overflow: ellipsis;
		max-width: 100%;
	}
	.sub {
		font-size: 11px;
		color: var(--faint);
	}
</style>
