<script lang="ts">
	// Einzelnes Feld als große Kachel, optional mit −/+ für schnelle Änderungen am Tisch.
	import type { FieldBlockConfig } from '$lib/engine/types';
	import { setFieldBase } from '$lib/store/actions';
	import { sheet } from '$lib/store/sheet.svelte';
	import { parseNumberInput } from '../format';
	import FieldValue from '../components/FieldValue.svelte';
	import Icon from '../components/Icon.svelte';
	import Missing from './Missing.svelte';

	let { config, title }: { config: FieldBlockConfig; title?: string } = $props();
	const field = $derived(sheet.character?.fields[config.fieldId]);
	let amount = $state('');

	function step(dir: 1 | -1) {
		if (!field) return;
		const n = parseNumberInput(amount) ?? 1;
		setFieldBase(field.id, field.base + dir * Math.abs(n));
		amount = '';
	}
</script>

{#if field}
	<div class="tile" class:stepper={config.stepper}>
		<span class="label">{title || field.name}</span>
		<FieldValue id={field.id} size="xl" />
		{#if config.stepper && (field.type ?? 'number') === 'number'}
			<div class="steps">
				<button type="button" class="btn" aria-label="{field.name} verringern" onclick={() => step(-1)}><Icon name="minus" /></button>
				<input
					class="input num"
					type="text"
					inputmode="numeric"
					placeholder="1"
					aria-label="Betrag"
					bind:value={amount}
					onkeydown={(e) => {
						if (e.key === 'Enter') step(e.shiftKey ? 1 : -1);
					}}
				/>
				<button type="button" class="btn" aria-label="{field.name} erhöhen" onclick={() => step(1)}><Icon name="plus" /></button>
			</div>
		{/if}
	</div>
{:else}
	<Missing what="Feld" />
{/if}

<style>
	.tile {
		height: 100%;
		display: flex;
		flex-direction: column;
		align-items: center;
		justify-content: center;
		gap: 2px;
		padding: 6px;
	}
	.label {
		font-size: 11.5px;
		font-weight: 600;
		letter-spacing: 0.07em;
		text-transform: uppercase;
		color: var(--muted);
		text-align: center;
		max-width: 100%;
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
	}
	.stepper :global(.value.xl) {
		font-size: 44px;
	}
	.steps {
		display: flex;
		gap: 6px;
		margin-top: 4px;
	}
	.steps .input {
		width: 64px;
	}
</style>
