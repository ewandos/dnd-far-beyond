<script lang="ts">
	import { addSpell, spellLevelLabel } from '$lib/store/actions';
	import { ui } from '$lib/store/ui.svelte';
	import Icon from './Icon.svelte';

	let { listId }: { listId?: string } = $props();
	let name = $state('');
	let level = $state(1);
	let input: HTMLInputElement | undefined = $state();

	function submit() {
		if (!name.trim()) return input?.focus();
		const id = addSpell({ name, level }, listId);
		ui.toast(`Zauber angelegt: ${name.trim()}`, { label: 'Öffnen', run: () => ui.open({ kind: 'spell', id }) });
		name = '';
		input?.focus();
	}
</script>

<form
	class="quick"
	onsubmit={(e) => {
		e.preventDefault();
		submit();
	}}
>
	<input bind:this={input} bind:value={name} class="input" type="text" placeholder="Zauber anlegen …" aria-label="Zaubername" enterkeyhint="done" />
	<select class="select lvl" bind:value={level} aria-label="Grad">
		{#each [0, 1, 2, 3, 4, 5, 6, 7, 8, 9] as l (l)}<option value={l}>{spellLevelLabel(l)}</option>{/each}
	</select>
	<button type="submit" class="btn primary" disabled={!name.trim()}><Icon name="plus" size={18} /> Anlegen</button>
</form>

<style>
	.quick {
		display: flex;
		gap: 8px;
	}
	.quick .input {
		flex: 1;
	}
	.lvl {
		width: 140px;
		flex: 0 0 140px;
	}
</style>
