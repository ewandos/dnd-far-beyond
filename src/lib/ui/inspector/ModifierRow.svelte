<script lang="ts">
	// Ein Modifikator in der Aufschlüsselung: Wirkung, Beschreibung, Quelle bzw. Zielfeld,
	// Formel mit aufgelösten Referenzen, Status (inaktiv, Konflikt, Fehler).
	import { isPlainNumber, toDisplayExpr } from '$lib/engine/formula';
	import type { Step } from '$lib/engine/evaluate';
	import { sheet } from '$lib/store/sheet.svelte';
	import { ui } from '$lib/store/ui.svelte';
	import { formatEffect, formatNumber, OP_SYMBOL } from '../format';
	import Icon from '../components/Icon.svelte';
	import ModifierForm from './ModifierForm.svelte';
	import RefChain from './RefChain.svelte';
	import SourceChip from './SourceChip.svelte';

	let { modifierId, context, step }: { modifierId: string; context: 'field' | 'source'; step?: Step } = $props();

	let editing = $state(false);
	let showRefs = $state(false);

	const c = $derived(sheet.character!);
	const m = $derived(c.modifiers[modifierId]);
	const status = $derived(sheet.evaluation?.modifiers[modifierId]);
	const fields = $derived(Object.values(c.fields));
	const display = $derived(m ? toDisplayExpr(m.expr, fields) : '');
	const plain = $derived(m ? isPlainNumber(m.expr) : true);
	const modState = $derived(status?.state ?? 'inactive');
	const target = $derived(m?.targetFieldId ? c.fields[m.targetFieldId] : undefined);
	const effect = $derived.by(() => {
		if (!m) return '';
		const t = step?.text ?? status?.text;
		if (t !== undefined) return m.op === 'set' ? `= ${t}` : t;
		const v = step?.value ?? status?.value;
		if (v !== undefined) return formatEffect(m.op, v);
		return plain ? `${OP_SYMBOL[m.op]} ${display.trim()}` : OP_SYMBOL[m.op];
	});
	const refs = $derived(step?.refs ?? []);
	const targetKind = $derived(target?.type ?? 'number');
	const sourceName = $derived(
		m?.source.kind === 'item' ? c.items[m.source.id]?.name : m?.source.kind === 'ability' ? c.abilities[m.source.id]?.name : undefined
	);
	// Beschreibung nur zeigen, wenn sie mehr sagt als der Name der Quelle.
	const showDesc = $derived(
		!!m &&
			(m.source.kind === 'field' ||
				(!!m.description && m.description !== sourceName && !(m.source.kind === 'proficiency' && m.description === 'Übung')))
	);
</script>

{#if m}
	<div class="row {modState}" data-modifier={m.id}>
		<div class="main">
			<span class="effect num" title={modState === 'overridden' ? 'Im Konflikt unterlegen' : ''}>{effect}</span>
			<div class="body">
				<div class="line1">
					{#if context === 'field'}
						{#if showDesc}
							<span class="desc">{m.description || 'Feldeigener Modifikator'}</span>
						{/if}
						<SourceChip source={m.source} />
					{:else}
						<button
							type="button"
							class="target"
							disabled={!target}
							title="Zum Feld springen"
							onclick={() => target && ui.push({ kind: 'field', id: target.id })}
						>
							{target?.name ?? (m.targetFieldId ? 'Gelöschtes Feld' : 'nicht zugeordnet')}{#if !target && m.importHint}&nbsp;(ursprünglich „{m.importHint}“){/if}
						</button>
						{#if m.description && m.description !== c.items[m.source.id]?.name && m.description !== c.abilities[m.source.id]?.name}
							<span class="desc muted">· {m.description}</span>
						{/if}
					{/if}
				</div>
				{#if (!plain || (step?.factor !== undefined && step.factor !== 1)) && targetKind !== 'list'}
					<div class="formula">
						<code>{display}</code>
						{#if step && step.text === undefined}
							<span class="muted">= {formatNumber(step.rawValue)}{#if step.factor !== undefined && step.factor !== 1}&nbsp;× {formatNumber(step.factor)}{step.factor === 0.5 ? ' (abgerundet)' : ''}{/if}</span>
						{/if}
						{#if refs.length}
							<button type="button" class="refs-toggle" aria-expanded={showRefs} onclick={() => (showRefs = !showRefs)}>
								<Icon name={showRefs ? 'chevronDown' : 'chevronRight'} size={14} />
								{refs.length === 1 ? 'Referenz' : `${refs.length} Referenzen`}
							</button>
						{/if}
					</div>
				{/if}
				{#if showRefs && refs.length}
					<div class="refs">
						{#each refs as r (r)}<RefChain fieldId={r} />{/each}
					</div>
				{/if}
				{#if step && context === 'field' && !step.overridden}
					<div class="running muted num">
						{step.beforeText !== undefined ? `${step.beforeText} → ${step.afterText}` : `${formatNumber(step.before)} → ${formatNumber(step.after)}`}
					</div>
				{/if}
				{#if modState !== 'applied' && status?.reason}
					<div class="reason">
						{#if modState === 'error'}<Icon name={status.issue?.kind === 'cycle' ? 'cycle' : 'alert'} size={14} />{/if}
						{status.reason}{#if status.issue?.chain}: {status.issue.chain.map((id) => c.fields[id]?.name ?? id).join(' → ')}{/if}
					</div>
				{/if}
			</div>
			<div class="side">
				<button type="button" class="btn ghost small icon" title="Bearbeiten" aria-label="Modifikator bearbeiten" aria-expanded={editing} onclick={() => (editing = !editing)}>
					<Icon name="edit" size={16} />
				</button>
			</div>
		</div>
		{#if editing}
			<div class="edit">
				<ModifierForm modifier={m} ondone={() => (editing = false)} />
			</div>
		{/if}
	</div>
{/if}

<style>
	.row {
		padding: 8px 0;
		border-bottom: 1px solid var(--border);
	}
	.row:last-child {
		border-bottom: none;
	}
	.main {
		display: flex;
		gap: 10px;
		align-items: flex-start;
	}
	.effect {
		flex: 0 0 64px;
		font-size: 17px;
		font-weight: 650;
		padding-top: 5px;
		white-space: nowrap;
		overflow: hidden;
		text-overflow: ellipsis;
	}
	.body {
		flex: 1;
		min-width: 0;
		padding-top: 5px;
	}
	.line1 {
		display: flex;
		flex-wrap: wrap;
		gap: 2px 8px;
		align-items: center;
		margin-top: -5px;
	}
	.desc {
		font-weight: 500;
	}
	.target {
		border: none;
		background: none;
		padding: 0;
		color: var(--accent);
		font-weight: 600;
	}
	.target:hover:not(:disabled) {
		text-decoration: underline;
	}
	.target:disabled {
		color: var(--danger);
		cursor: default;
	}
	.formula {
		display: flex;
		flex-wrap: wrap;
		gap: 4px 8px;
		align-items: center;
		margin-top: 3px;
		font-size: 13px;
	}
	code {
		background: var(--surface-2);
		border-radius: 4px;
		padding: 1px 5px;
		font-size: 12.5px;
		overflow-wrap: anywhere;
	}
	.refs-toggle {
		display: inline-flex;
		align-items: center;
		gap: 2px;
		border: none;
		background: none;
		padding: 4px 2px;
		color: var(--muted);
		font-size: 12.5px;
	}
	.refs-toggle:hover {
		color: var(--accent);
	}
	.refs {
		margin-top: 4px;
		padding: 4px 8px;
		background: var(--surface-2);
		border-radius: var(--radius-sm);
	}
	.running {
		font-size: 12px;
		margin-top: 2px;
	}
	.reason {
		display: flex;
		gap: 4px;
		align-items: center;
		margin-top: 3px;
		font-size: 12.5px;
		color: var(--muted);
		font-style: italic;
	}
	.side {
		display: flex;
		align-items: center;
		gap: 2px;
		flex-shrink: 0;
	}
	.edit {
		margin-top: 8px;
	}
	/* Inaktive Modifikatoren ausgegraut */
	.inactive .effect,
	.inactive .desc,
	.inactive .target,
	.inactive .formula,
	.inactive .running,
	.overridden .effect,
	.overridden .desc,
	.overridden .formula {
		opacity: 0.45;
	}
	.inactive .effect,
	.overridden .effect {
		text-decoration: line-through;
		text-decoration-thickness: 1px;
	}
	.error .effect {
		color: var(--danger);
		text-decoration: line-through;
	}
	.error .reason {
		color: var(--danger);
		font-style: normal;
	}
	.unassigned .reason {
		color: var(--accent);
	}
</style>
