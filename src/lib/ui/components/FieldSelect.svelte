<script lang="ts">
	// Feldauswahl als native Auswahlliste mit Gruppen – auf dem iPad das schnellste Bedienelement.
	import { sheet } from '$lib/store/sheet.svelte';
	import { groupedFields } from '../fields';

	let {
		value,
		onchange,
		label = 'Feld',
		allowNone = false,
		noneLabel = '— kein Feld —',
		className = ''
	}: {
		value: string | null;
		onchange: (id: string | null) => void;
		label?: string;
		allowNone?: boolean;
		noneLabel?: string;
		className?: string;
	} = $props();

	const groups = $derived(sheet.character ? groupedFields(sheet.character, { includeHidden: true }) : []);
</script>

<select
	class="select {className}"
	aria-label={label}
	value={value ?? ''}
	onchange={(e) => {
		const v = (e.currentTarget as HTMLSelectElement).value;
		onchange(v || null);
	}}
>
	{#if allowNone || !value}
		<option value="">{noneLabel}</option>
	{/if}
	{#if value && sheet.character && !sheet.character.fields[value]}
		<option value={value}>(gelöschtes Feld)</option>
	{/if}
	{#each groups as g (g.name)}
		<optgroup label={g.name}>
			{#each g.fields as f (f.id)}
				<option value={f.id}>{f.name}</option>
			{/each}
		</optgroup>
	{/each}
</select>
