<script lang="ts">
	// Antippbarer Zahlenwert mit dezenten Hinweis-Symbolen (Konflikt, Fehler, Zyklus).
	import { sheet } from '$lib/store/sheet.svelte';
	import { ui } from '$lib/store/ui.svelte';
	import { formatValue } from '../format';
	import Icon from './Icon.svelte';

	let {
		id,
		size = 'md',
		label
	}: { id: string; size?: 'xl' | 'lg' | 'md' | 'sm'; label?: string } = $props();

	const field = $derived(sheet.character?.fields[id]);
	const result = $derived(sheet.evaluation?.fields[id]);
	const hasCycle = $derived(result?.issues.some((i) => i.kind === 'cycle') ?? false);
	const hasError = $derived(result?.issues.some((i) => i.kind !== 'cycle') ?? false);
	const hasConflict = $derived(!!result?.conflict);
	const active = $derived(ui.panel?.kind === 'field' && ui.panel.id === id);
	const modified = $derived(!!result && result.value !== result.base);
</script>

{#if field && result}
	<button
		type="button"
		class="value {size}"
		class:active
		class:modified
		data-field={id}
		aria-label="{label ?? field.name}: {formatValue(result.value, field)} – Herkunft anzeigen"
		onclick={(e) => {
			e.stopPropagation();
			ui.open({ kind: 'field', id });
		}}
	>
		<span class="num">{formatValue(result.value, field)}</span>
		{#if hasConflict || hasError || hasCycle}
			<span class="flags">
				{#if hasConflict}<span class="flag warn" title="Konflikt: mehrere Setzen-Modifikatoren"><Icon name="conflict" size={12} stroke={2.2} /></span>{/if}
				{#if hasCycle}<span class="flag err" title="Zirkelbezug"><Icon name="cycle" size={12} stroke={2.2} /></span>{/if}
				{#if hasError}<span class="flag err" title="Fehlerhafter Modifikator"><Icon name="alert" size={12} stroke={2.2} /></span>{/if}
			</span>
		{/if}
	</button>
{/if}

<style>
	.value {
		position: relative;
		display: inline-flex;
		align-items: center;
		justify-content: center;
		gap: 4px;
		min-width: var(--tap);
		min-height: var(--tap);
		padding: 0 6px;
		border: 1px solid transparent;
		border-radius: var(--radius-sm);
		background: transparent;
		color: var(--text);
		font-weight: 600;
		line-height: 1;
		transition:
			background 0.12s,
			border-color 0.12s;
	}
	.value:hover {
		background: var(--surface-2);
	}
	.value.active {
		border-color: var(--accent);
		background: var(--accent-soft);
	}
	.value.modified .num {
		text-decoration: underline dotted var(--faint);
		text-underline-offset: 4px;
		text-decoration-thickness: 1px;
	}
	.xl {
		font-size: 34px;
		min-height: 52px;
		padding: 0 10px;
	}
	.lg {
		font-size: 24px;
	}
	.md {
		font-size: 17px;
	}
	.sm {
		font-size: 14px;
		min-height: 36px;
		min-width: 36px;
	}
	.flags {
		position: absolute;
		top: 2px;
		right: 2px;
		display: flex;
		gap: 1px;
	}
	.flag {
		display: inline-flex;
		border-radius: 50%;
		padding: 1px;
		background: var(--surface);
	}
	.flag.warn {
		color: var(--accent);
	}
	.flag.err {
		color: var(--danger);
	}
</style>
