<script lang="ts">
	import { formatNumber, parseNumberInput } from '../format';

	let {
		value,
		onchange,
		label,
		width = '80px',
		min,
		max,
		className = ''
	}: {
		value: number;
		onchange: (v: number) => void;
		label: string;
		width?: string;
		min?: number;
		max?: number;
		className?: string;
	} = $props();

	let text = $state('');
	let focused = $state(false);
	let invalid = $state(false);

	$effect(() => {
		if (!focused) text = formatNumber(value).replace('−', '-');
	});

	function commit() {
		const v = parseNumberInput(text);
		if (v === null) {
			invalid = text.trim() !== '';
			if (!invalid) text = formatNumber(value).replace('−', '-');
			return;
		}
		invalid = false;
		let n = v;
		if (min !== undefined) n = Math.max(min, n);
		if (max !== undefined) n = Math.min(max, n);
		if (n !== value) onchange(n);
	}
</script>

<input
	class="input num {className}"
	class:invalid
	style:width
	type="text"
	inputmode="decimal"
	enterkeyhint="done"
	autocomplete="off"
	aria-label={label}
	aria-invalid={invalid}
	bind:value={text}
	onfocus={(e) => {
		focused = true;
		(e.currentTarget as HTMLInputElement).select();
	}}
	onblur={() => {
		focused = false;
		commit();
		if (!invalid) text = formatNumber(value).replace('−', '-');
	}}
	onkeydown={(e) => {
		if (e.key === 'Enter') {
			commit();
			(e.currentTarget as HTMLInputElement).blur();
		}
		if (e.key === 'Escape') {
			text = formatNumber(value).replace('−', '-');
			invalid = false;
			(e.currentTarget as HTMLInputElement).blur();
		}
		if (e.key === 'ArrowUp' || e.key === 'ArrowDown') {
			e.preventDefault();
			const base = parseNumberInput(text) ?? value;
			text = String(base + (e.key === 'ArrowUp' ? 1 : -1));
			commit();
		}
	}}
/>

<style>
	.invalid {
		border-color: var(--danger) !important;
		box-shadow: 0 0 0 3px var(--danger-soft) !important;
	}
</style>
