<script lang="ts">
	import { sheet } from '$lib/store/sheet.svelte';
	import { ui } from '$lib/store/ui.svelte';
	import Icon from '../components/Icon.svelte';
	import FieldInspector from './FieldInspector.svelte';
	import SourceInspector from './SourceInspector.svelte';
	import SpellInspector from './SpellInspector.svelte';

	const c = $derived(sheet.character);
	const prevLabel = $derived.by(() => {
		if (ui.stack.length < 2 || !c) return '';
		const p = ui.stack[ui.stack.length - 2];
		if (p.kind === 'field') return c.fields[p.id]?.name ?? 'Zurück';
		if (p.kind === 'item') return c.items[p.id]?.name ?? 'Zurück';
		if (p.kind === 'spell') return c.spells[p.id]?.name ?? 'Zurück';
		return c.abilities[p.id]?.name ?? 'Zurück';
	});
	let scroller: HTMLDivElement | undefined = $state();

	$effect(() => {
		void ui.panel;
		scroller?.scrollTo({ top: 0 });
	});
</script>

<svelte:window
	onkeydown={(e) => {
		if (e.key === 'Escape' && ui.panel) {
			const t = e.target as HTMLElement;
			if (t.closest('input, textarea, select')) return;
			ui.close();
		}
	}}
/>

{#if ui.panel && c}
	<aside class="drawer" aria-label="Inspektion">
		<div class="bar">
			{#if ui.stack.length > 1}
				<button type="button" class="btn ghost small back" onclick={() => ui.back()}>
					<Icon name="back" size={18} />
					<span class="label">{prevLabel}</span>
				</button>
			{/if}
			<span class="spacer"></span>
			<button type="button" class="btn ghost icon" aria-label="Schließen" title="Schließen (Esc)" onclick={() => ui.close()}>
				<Icon name="x" />
			</button>
		</div>
		<div class="content" bind:this={scroller}>
			{#key ui.panel.kind + ui.panel.id}
				{#if ui.panel.kind === 'field'}
					<FieldInspector id={ui.panel.id} />
				{:else if ui.panel.kind === 'spell'}
					<SpellInspector id={ui.panel.id} />
				{:else}
					<SourceInspector kind={ui.panel.kind} id={ui.panel.id} />
				{/if}
			{/key}
		</div>
	</aside>
{/if}

<style>
	.drawer {
		position: fixed;
		z-index: 40;
		/* unterhalb von Kopfzeile und Tabs, damit beide bedienbar bleiben */
		top: calc(var(--header-h) + var(--tabs-h));
		right: 0;
		bottom: 0;
		width: 440px;
		display: flex;
		flex-direction: column;
		background: var(--surface);
		border-left: 1px solid var(--border);
		box-shadow: var(--shadow-lg);
		animation: slide 0.16s ease-out;
	}
	@keyframes slide {
		from {
			transform: translateX(24px);
			opacity: 0.4;
		}
	}
	.bar {
		display: flex;
		align-items: center;
		gap: 4px;
		padding: 6px 8px;
		border-bottom: 1px solid var(--border);
	}
	.back {
		max-width: 300px;
		color: var(--accent);
	}
	.back .label {
		overflow: hidden;
		text-overflow: ellipsis;
	}
	.spacer {
		flex: 1;
	}
	.content {
		flex: 1;
		overflow-y: auto;
		overscroll-behavior: contain;
		padding: 16px 20px 40px;
	}
</style>
