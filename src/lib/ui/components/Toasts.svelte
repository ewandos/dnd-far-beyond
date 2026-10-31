<script lang="ts">
	import { ui } from '$lib/store/ui.svelte';
	import Icon from './Icon.svelte';
</script>

<div class="toasts" role="status" aria-live="polite">
	{#each ui.toasts as t (t.id)}
		<div class="toast">
			<span>{t.text}</span>
			{#if t.action}
				<button
					type="button"
					class="action"
					onclick={() => {
						t.action?.run();
						ui.dismiss(t.id);
					}}>{t.action.label}</button
				>
			{/if}
			<button type="button" class="close" aria-label="Schließen" onclick={() => ui.dismiss(t.id)}><Icon name="x" size={16} /></button>
		</div>
	{/each}
</div>

<style>
	.toasts {
		position: fixed;
		z-index: 60;
		left: 50%;
		bottom: max(20px, env(safe-area-inset-bottom));
		transform: translateX(-50%);
		display: flex;
		flex-direction: column;
		gap: 8px;
		align-items: center;
		pointer-events: none;
	}
	.toast {
		pointer-events: auto;
		display: flex;
		align-items: center;
		gap: 12px;
		padding: 6px 6px 6px 16px;
		background: var(--text);
		color: var(--bg);
		border-radius: var(--radius);
		box-shadow: var(--shadow-lg);
		font-size: 14px;
		animation: pop 0.18s ease-out;
	}
	@keyframes pop {
		from {
			transform: translateY(8px);
			opacity: 0;
		}
	}
	.action {
		border: none;
		background: none;
		color: var(--accent-soft);
		font-weight: 600;
		min-height: 36px;
		padding: 0 6px;
	}
	.close {
		display: inline-flex;
		align-items: center;
		justify-content: center;
		width: 36px;
		height: 36px;
		border: none;
		background: none;
		color: inherit;
		opacity: 0.7;
	}
</style>
