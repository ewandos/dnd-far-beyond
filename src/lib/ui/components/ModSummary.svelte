<script lang="ts">
	// Kurzfassung der Modifikatoren einer Quelle: „RK +2 · Bewegungsrate +3“.
	import { isPlainNumber } from '$lib/engine/formula';
	import { sheet } from '$lib/store/sheet.svelte';
	import { formatEffect, OP_SYMBOL } from '../format';

	let { kind, id }: { kind: 'item' | 'ability'; id: string } = $props();
	const c = $derived(sheet.character!);
	const parts = $derived(
		Object.values(c.modifiers)
			.filter((m) => m.source.kind === kind && m.source.id === id)
			.sort((a, b) => a.order - b.order)
			.map((m) => {
				const st = sheet.evaluation?.modifiers[m.id];
				const target = m.targetFieldId ? (c.fields[m.targetFieldId]?.name ?? '?') : 'nicht zugeordnet';
				let eff: string;
				if (st?.value !== undefined) eff = formatEffect(m.op, st.value);
				else if (isPlainNumber(m.expr)) eff = formatEffect(m.op, parseFloat(m.expr.replace('−', '-')));
				else eff = `${OP_SYMBOL[m.op]} ƒ`;
				return { id: m.id, text: `${target} ${eff}`, error: st?.state === 'error' || st?.state === 'unassigned' };
			})
	);
</script>

{#if parts.length}
	<span class="summary">
		{#each parts as p, i (p.id)}
			<span class:error={p.error}>{p.text}</span>{#if i < parts.length - 1}<span class="sep">·</span>{/if}
		{/each}
	</span>
{/if}

<style>
	.summary {
		display: inline-flex;
		flex-wrap: wrap;
		gap: 0 6px;
		font-size: 12.5px;
		color: var(--muted);
		font-variant-numeric: tabular-nums;
	}
	.sep {
		color: var(--faint);
	}
	.error {
		color: var(--danger);
	}
</style>
