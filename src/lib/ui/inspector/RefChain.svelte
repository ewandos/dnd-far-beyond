<script lang="ts">
	// Aufklappbare Referenz: zeigt den Endwert eines referenzierten Feldes und auf Wunsch
	// dessen Aufschlüsselung – bis die ganze Kette sichtbar ist.
	import { sheet } from '$lib/store/sheet.svelte';
	import { ui } from '$lib/store/ui.svelte';
	import { formatEffect, formatNumber, formatValue } from '../format';
	import Icon from '../components/Icon.svelte';
	import RefChain from './RefChain.svelte';

	let { fieldId, depth = 0 }: { fieldId: string; depth?: number } = $props();
	let open = $state(false);

	const c = $derived(sheet.character!);
	const field = $derived(c.fields[fieldId]);
	const r = $derived(sheet.evaluation?.fields[fieldId]);
	const expandable = $derived(!!r && r.steps.length > 0 && depth < 10);
</script>

{#if field && r}
	<div class="ref">
		<div class="head">
			<button type="button" class="toggle" disabled={!expandable} aria-expanded={open} aria-label="{field.name} aufklappen" onclick={() => (open = !open)}>
				{#if expandable}<Icon name={open ? 'chevronDown' : 'chevronRight'} size={14} />{/if}
			</button>
			<button type="button" class="name" title="Zum Feld springen" onclick={() => ui.push({ kind: 'field', id: fieldId })}>@{field.name}</button>
			<span class="val num">{formatValue(r.value, field)}</span>
		</div>
		{#if open}
			<ul class="steps">
				<li><span class="eff num">{formatNumber(r.base)}</span><span class="muted">Basiswert</span></li>
				{#each r.steps as s (s.modifierId)}
					{@const m = c.modifiers[s.modifierId]}
					<li class:overridden={s.overridden}>
						<span class="eff num">{formatEffect(s.op, s.value)}</span>
						<span class="desc">{m?.description || 'Modifikator'}</span>
						{#if s.refs.length}
							<div class="nested">
								{#each s.refs as ref (ref)}
									<RefChain fieldId={ref} depth={depth + 1} />
								{/each}
							</div>
						{/if}
					</li>
				{/each}
			</ul>
		{/if}
	</div>
{:else}
	<div class="ref missing">Gelöschtes Feld</div>
{/if}

<style>
	.ref {
		font-size: 13px;
	}
	.head {
		display: flex;
		align-items: center;
		gap: 2px;
	}
	.toggle {
		display: inline-flex;
		align-items: center;
		justify-content: center;
		width: 26px;
		height: 30px;
		padding: 0;
		border: none;
		background: transparent;
		color: var(--muted);
	}
	.name {
		border: none;
		background: transparent;
		padding: 4px 2px;
		color: var(--accent);
		font-weight: 500;
	}
	.name:hover {
		text-decoration: underline;
	}
	.val {
		margin-left: auto;
		font-weight: 600;
	}
	.steps {
		list-style: none;
		margin: 0 0 4px 12px;
		padding: 0 0 0 12px;
		border-left: 1px dashed var(--border-strong);
	}
	.steps li {
		display: flex;
		flex-wrap: wrap;
		gap: 4px 8px;
		align-items: baseline;
		padding: 2px 0;
	}
	.steps li.overridden {
		opacity: 0.5;
	}
	.eff {
		min-width: 3em;
		font-weight: 600;
	}
	.desc {
		color: var(--muted);
	}
	.nested {
		flex-basis: 100%;
	}
	.missing {
		color: var(--danger);
	}
</style>
