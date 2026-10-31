<script lang="ts">
	// Anlegen oder Bearbeiten eines Modifikators. Beim Bearbeiten wirkt jede Änderung sofort.
	import type { Modifier, Operation, Rounding } from '$lib/engine/types';
	import { addModifier, deleteModifier, updateModifier, KIND_LABEL } from '$lib/store/actions';
	import { sheet } from '$lib/store/sheet.svelte';
	import { OP_LABEL, OP_SYMBOL } from '../format';
	import FieldSelect from '../components/FieldSelect.svelte';
	import FormulaInput from '../components/FormulaInput.svelte';
	import Icon from '../components/Icon.svelte';

	let {
		modifier,
		fixedTarget,
		fixedSource,
		ondone
	}: {
		/** Vorhandener Modifikator → Bearbeiten. Sonst Neuanlage. */
		modifier?: Modifier;
		/** Neuanlage am Feld: Zielfeld steht fest, Quelle wählbar. */
		fixedTarget?: string;
		/** Neuanlage an einer Quelle: Quelle steht fest, Zielfeld wählbar. */
		fixedSource?: Modifier['source'];
		ondone?: () => void;
	} = $props();

	const c = $derived(sheet.character!);
	const editing = $derived(!!modifier);

	// Zustand für die Neuanlage
	let target = $state<string | null>(null);
	let op = $state<Operation>('add');
	let expr = $state('');
	let description = $state('');
	let rounding = $state<Rounding>('floor');
	let sourceKey = $state('field');

	$effect.pre(() => {
		if (!modifier) target = fixedTarget ?? null;
	});

	const sourceOptions = $derived.by(() => {
		const opts: { key: string; label: string; group: string }[] = [];
		for (const i of Object.values(c.items).sort((a, b) => a.name.localeCompare(b.name, 'de')))
			opts.push({ key: `item:${i.id}`, label: i.name, group: 'Items' });
		for (const a of Object.values(c.abilities).sort((a, b) => a.name.localeCompare(b.name, 'de')))
			opts.push({ key: `ability:${a.id}`, label: a.name, group: a.kind === 'condition' ? 'Zustände' : 'Fähigkeiten' });
		return opts;
	});

	function create() {
		const tgt = fixedTarget ?? target;
		if (!expr.trim()) return;
		let source: Modifier['source'];
		if (fixedSource) source = fixedSource;
		else if (sourceKey === 'field') source = { kind: 'field', id: tgt ?? '' };
		else {
			const [kind, id] = sourceKey.split(':') as ['item' | 'ability', string];
			source = { kind, id };
		}
		addModifier({
			targetFieldId: tgt,
			op,
			expr,
			description: description || (source.kind === 'field' ? '' : sourceLabel(source)),
			source,
			rounding: op === 'multiply' || op === 'divide' ? rounding : undefined
		});
		expr = '';
		description = '';
		ondone?.();
	}

	function sourceLabel(s: Modifier['source']): string {
		if (s.kind === 'item') return c.items[s.id]?.name ?? '';
		if (s.kind === 'ability') return c.abilities[s.id]?.name ?? '';
		return '';
	}

	const curOp = $derived(modifier ? modifier.op : op);
	const targetId = $derived(modifier ? modifier.targetFieldId : (fixedTarget ?? target));
	const targetKind = $derived((targetId && c.fields[targetId]?.type) || 'number');
	const ops = $derived(targetKind === 'number' ? (['add', 'set', 'multiply', 'divide'] as const) : (['add', 'set'] as const));
</script>

<div class="form" class:editing>
	<div class="row">
		{#if !fixedTarget || editing}
			<FieldSelect
				value={modifier ? modifier.targetFieldId : target}
				onchange={(v) => (modifier ? updateModifier(modifier.id, { targetFieldId: v }) : (target = v))}
				allowNone
				noneLabel="— nicht zugeordnet —"
				label="Zielfeld"
				className="target"
			/>
		{/if}
		<select
			class="select op"
			aria-label="Operation"
			title={OP_LABEL[curOp]}
			value={curOp}
			onchange={(e) => {
				const v = (e.currentTarget as HTMLSelectElement).value as Operation;
				if (modifier) updateModifier(modifier.id, { op: v });
				else op = v;
			}}
		>
			{#each ops as o (o)}
				<option value={o}>{OP_SYMBOL[o]} {OP_LABEL[o]}</option>
			{/each}
		</select>
	</div>
	<div class="row">
		<FormulaInput
			value={modifier ? modifier.expr : expr}
			onchange={(v) => (modifier ? updateModifier(modifier.id, { expr: v }) : (expr = v))}
			onenter={modifier ? undefined : create}
			live={!modifier}
			autofocus={!modifier}
			kind={targetKind}
			placeholder={targetKind === 'list' ? 'Einträge, durch Komma getrennt' : targetKind === 'dice' ? 'z. B. 1d6 oder @STR-Mod' : undefined}
		/>
		{#if curOp === 'multiply' || curOp === 'divide'}
			<select
				class="select rounding"
				aria-label="Rundung"
				value={modifier ? (modifier.rounding ?? 'floor') : rounding}
				onchange={(e) => {
					const v = (e.currentTarget as HTMLSelectElement).value as Rounding;
					if (modifier) updateModifier(modifier.id, { rounding: v });
					else rounding = v;
				}}
			>
				<option value="floor">abrunden</option>
				<option value="ceil">aufrunden</option>
				<option value="round">runden</option>
				<option value="none">nicht runden</option>
			</select>
		{/if}
	</div>
	<input
		class="input"
		type="text"
		placeholder="Beschreibung, z. B. „Mantel der Macht“"
		aria-label="Beschreibung"
		value={modifier ? modifier.description : description}
		oninput={(e) => {
			const v = (e.currentTarget as HTMLInputElement).value;
			if (modifier) updateModifier(modifier.id, { description: v });
			else description = v;
		}}
	/>
	{#if !modifier && !fixedSource}
		<label class="src">
			<span class="eyebrow">Quelle</span>
			<select class="select" bind:value={sourceKey} aria-label="Quelle">
				<option value="field">Feldeigen (immer aktiv)</option>
				{#each ['Items', 'Fähigkeiten', 'Zustände'] as g (g)}
					{@const opts = sourceOptions.filter((o) => o.group === g)}
					{#if opts.length}
						<optgroup label={g}>
							{#each opts as o (o.key)}<option value={o.key}>{o.label}</option>{/each}
						</optgroup>
					{/if}
				{/each}
			</select>
		</label>
	{/if}
	<div class="actions">
		{#if modifier}
			<button type="button" class="btn danger small" onclick={() => { deleteModifier(modifier.id); ondone?.(); }}>
				<Icon name="trash" size={16} /> Löschen
			</button>
			<span class="spacer"></span>
			<button type="button" class="btn small" onclick={() => ondone?.()}>Fertig</button>
		{:else}
			<span class="spacer"></span>
			<button type="button" class="btn ghost small" onclick={() => ondone?.()}>Abbrechen</button>
			<button type="button" class="btn primary small" disabled={!expr.trim()} onclick={create}>
				<Icon name="plus" size={16} /> Hinzufügen
			</button>
		{/if}
	</div>
	{#if fixedSource}
		{@const ab = fixedSource.kind === 'ability' ? c.abilities[fixedSource.id] : undefined}
		<p class="hint muted">Quelle: {ab ? KIND_LABEL[ab.kind] : 'Item'} „{sourceLabel(fixedSource)}“</p>
	{/if}
</div>

<style>
	.form {
		display: flex;
		flex-direction: column;
		gap: 8px;
		padding: 12px;
		border: 1px solid var(--border);
		border-radius: var(--radius);
		background: var(--surface-2);
	}
	.row {
		display: flex;
		gap: 8px;
		align-items: flex-start;
	}
	.row :global(.target) {
		flex: 1;
	}
	.op {
		width: auto;
		flex: 0 0 168px;
	}
	.rounding {
		width: 140px;
		flex: 0 0 140px;
	}
	.src {
		display: flex;
		flex-direction: column;
		gap: 4px;
	}
	.actions {
		display: flex;
		gap: 8px;
		align-items: center;
	}
	.spacer {
		flex: 1;
	}
	.hint {
		margin: 0;
		font-size: 12.5px;
	}
</style>
