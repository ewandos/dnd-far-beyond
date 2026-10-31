<script lang="ts">
	import { addText, deleteText, updateText } from '$lib/store/actions';
	import { sheet } from '$lib/store/sheet.svelte';
	import Icon from '../components/Icon.svelte';
	import MarkdownEditor from '../components/MarkdownEditor.svelte';

	const c = $derived(sheet.character!);
	const texts = $derived(Object.values(c.texts).sort((a, b) => a.order - b.order));
	let confirm = $state<string | null>(null);
</script>

<div class="notes">
	{#each texts as t (t.id)}
		<section class="card pad">
			<div class="head">
				<input class="input inline title" value={t.title} aria-label="Titel" oninput={(e) => updateText(t.id, 'title', (e.currentTarget as HTMLInputElement).value)} />
				{#if confirm === t.id}
					<button type="button" class="btn danger small" onclick={() => { deleteText(t.id); confirm = null; }}>Löschen</button>
					<button type="button" class="btn ghost small" onclick={() => (confirm = null)}>Abbrechen</button>
				{:else}
					<button type="button" class="btn ghost small icon" aria-label="Notiz löschen" onclick={() => (confirm = t.id)}><Icon name="trash" size={16} /></button>
				{/if}
			</div>
			<MarkdownEditor value={t.content} onchange={(v) => updateText(t.id, 'content', v)} placeholder="Noch leer." rows={8} />
		</section>
	{/each}
	<button type="button" class="btn add" onclick={() => addText('Neue Notiz')}><Icon name="plus" size={18} /> Notiz</button>
</div>

<style>
	.notes {
		display: grid;
		grid-template-columns: repeat(auto-fill, minmax(420px, 1fr));
		gap: 14px;
		align-items: start;
	}
	.pad {
		padding: 10px 14px 12px;
	}
	.head {
		display: flex;
		gap: 6px;
		align-items: center;
	}
	.title {
		flex: 1;
		font-family: var(--font-display);
		font-size: 18px;
		font-weight: 600;
		margin-left: -6px;
	}
	.add {
		justify-self: start;
	}
</style>
