<script lang="ts">
	// Schnellanlage: Name eingeben, optional direkt einen Modifikator (Feld + Operation + Wert), fertig.
	import type { Operation } from '$lib/engine/types';
	import { addAbility, addItem, KIND_LABEL, type QuickModifier } from '$lib/store/actions';
	import { sheet } from '$lib/store/sheet.svelte';
	import { ui } from '$lib/store/ui.svelte';
	import { OP_SYMBOL } from '../format';
	import FieldSelect from './FieldSelect.svelte';
	import FormulaInput from './FormulaInput.svelte';
	import Icon from './Icon.svelte';

	let {
		kind,
		containerId = $bindable(),
		chooseContainer = false
	}: { kind: 'item' | 'ability' | 'condition'; containerId?: string; chooseContainer?: boolean } = $props();

	let name = $state('');
	let fieldId = $state<string | null>(null);
	let op = $state<Operation>('add');
	let expr = $state('');
	let attunement = $state(false);
	let nameInput: HTMLInputElement | undefined = $state();
	let formKey = $state(0);

	const containers = $derived(
		Object.values(sheet.character?.containers ?? {}).sort((a, b) => Number(b.equipped) - Number(a.equipped) || a.order - b.order)
	);
	const noun = $derived(kind === 'item' ? 'Item' : KIND_LABEL[kind]);

	function submit() {
		if (!name.trim()) {
			nameInput?.focus();
			return;
		}
		const quick: QuickModifier | undefined = fieldId && expr.trim() ? { targetFieldId: fieldId, op, expr } : undefined;
		let id: string;
		if (kind === 'item') {
			const target = containerId ?? containers[0]?.id;
			if (!target) return;
			id = addItem({ name, containerId: target, requiresAttunement: attunement }, quick);
		} else {
			id = addAbility({ kind, name }, quick);
		}
		const created = name.trim();
		ui.toast(`${noun} angelegt: ${created}`, {
			label: 'Öffnen',
			run: () => ui.open({ kind: kind === 'item' ? 'item' : 'ability', id })
		});
		name = '';
		expr = '';
		attunement = false;
		formKey++;
		nameInput?.focus();
	}
</script>

<form
	class="quick"
	onsubmit={(e) => {
		e.preventDefault();
		submit();
	}}
>
	<input
		bind:this={nameInput}
		bind:value={name}
		class="input name"
		type="text"
		placeholder="{noun} anlegen …"
		aria-label="Name"
		enterkeyhint="done"
	/>
	<FieldSelect value={fieldId} onchange={(v) => (fieldId = v)} allowNone noneLabel="ohne Modifikator" label="Zielfeld" className="field" />
	{#if fieldId}
		<select class="select op" aria-label="Operation" bind:value={op}>
			{#each ['add', 'set', 'multiply', 'divide'] as const as o (o)}
				<option value={o}>{OP_SYMBOL[o]}</option>
			{/each}
		</select>
		{#key formKey}
			<FormulaInput value={expr} onchange={(v) => (expr = v)} onenter={submit} live preview={false} placeholder="Wert" className="expr" />
		{/key}
	{/if}
	{#if kind === 'item'}
		{#if chooseContainer}
			<select class="select container" aria-label="Container" bind:value={containerId}>
				{#each containers as ct (ct.id)}
					<option value={ct.id}>{ct.name}{ct.equipped ? ' ✓' : ''}</option>
				{/each}
			</select>
		{/if}
		<label class="check" title="Erfordert Einstimmung">
			<input type="checkbox" bind:checked={attunement} />
			<span>Einstimmung</span>
		</label>
	{/if}
	<button type="submit" class="btn primary" disabled={!name.trim()}>
		<Icon name="plus" size={18} />
		Anlegen
	</button>
</form>

<style>
	.quick {
		display: flex;
		gap: 8px;
		align-items: center;
		flex-wrap: wrap;
	}
	.name {
		flex: 2 1 180px;
	}
	.quick :global(.field) {
		flex: 1 1 150px;
		width: auto;
	}
	.op {
		width: 62px;
		flex: 0 0 62px;
		font-weight: 600;
		text-align: center;
	}
	.quick :global(.expr) {
		flex: 1 1 110px;
	}
	.container {
		flex: 0 1 160px;
		width: auto;
	}
	.check {
		font-size: 14px;
		padding: 0 4px;
	}
</style>
