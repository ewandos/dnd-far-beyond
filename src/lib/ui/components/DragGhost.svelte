<script lang="ts">
	import { drag } from '../dnd.svelte';
	import Icon from './Icon.svelte';
</script>

{#if drag.payload}
	<div class="ghost" style:left="{drag.x}px" style:top="{drag.y}px" aria-hidden="true">
		<Icon name={drag.payload.kind === 'container' ? 'folder' : 'box'} size={16} />
		{drag.payload.label}
	</div>
{/if}

<style>
	.ghost {
		position: fixed;
		z-index: 100;
		pointer-events: none;
		transform: translate(12px, -50%);
		display: flex;
		align-items: center;
		gap: 6px;
		padding: 8px 12px;
		border-radius: var(--radius-sm);
		background: var(--surface);
		border: 1px solid var(--accent);
		box-shadow: var(--shadow-lg);
		font-weight: 500;
		font-size: 14px;
	}
</style>
