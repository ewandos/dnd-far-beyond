<script lang="ts">
	import type { Snippet } from 'svelte';
	import Icon from '../components/Icon.svelte';

	let { title, onclose, width = 560, children, footer }: { title: string; onclose: () => void; width?: number; children: Snippet; footer?: Snippet } = $props();
	const titleId = `modal-${Math.random().toString(36).slice(2)}`;
</script>

<svelte:window onkeydown={(e) => e.key === 'Escape' && onclose()} />

<div class="backdrop" role="presentation" onclick={(e) => e.target === e.currentTarget && onclose()}>
	<div class="dialog card" role="dialog" aria-modal="true" aria-labelledby={titleId} style:width="{width}px">
		<header>
			<h2 id={titleId} class="section-title">{title}</h2>
			<button type="button" class="btn ghost icon" aria-label="Schließen" onclick={onclose}><Icon name="x" /></button>
		</header>
		<div class="body">{@render children()}</div>
		{#if footer}<footer>{@render footer()}</footer>{/if}
	</div>
</div>

<style>
	.backdrop {
		position: fixed;
		inset: 0;
		z-index: 70;
		display: flex;
		align-items: center;
		justify-content: center;
		background: rgb(20 16 12 / 0.4);
		padding: 24px;
	}
	.dialog {
		max-width: 100%;
		max-height: calc(100vh - 48px);
		display: flex;
		flex-direction: column;
		box-shadow: var(--shadow-lg);
	}
	header,
	footer {
		display: flex;
		align-items: center;
		gap: 8px;
		padding: 10px 12px 10px 18px;
	}
	header {
		justify-content: space-between;
		border-bottom: 1px solid var(--border);
	}
	footer {
		border-top: 1px solid var(--border);
	}
	.body {
		padding: 16px 18px;
		overflow-y: auto;
		display: flex;
		flex-direction: column;
		gap: 12px;
	}
</style>
