<script lang="ts">
	import type { ContainerBlockConfig } from '$lib/engine/types';
	import { sheet } from '$lib/store/sheet.svelte';
	import ContainerBox from '../components/ContainerBox.svelte';
	import QuickCreate from '../components/QuickCreate.svelte';
	import Missing from './Missing.svelte';

	let { config }: { config: ContainerBlockConfig } = $props();
	const ct = $derived(sheet.character?.containers[config.containerId]);
	let containerId = $state<string | undefined>(undefined);
	$effect.pre(() => {
		containerId = config.containerId;
	});
</script>

{#if ct}
	<div class="wrap">
		<ContainerBox id={ct.id} bare />
		<QuickCreate kind="item" bind:containerId />
	</div>
{:else}
	<Missing what="Container" />
{/if}

<style>
	.wrap {
		display: flex;
		flex-direction: column;
		gap: 8px;
	}
</style>
