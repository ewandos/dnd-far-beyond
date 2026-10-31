<script lang="ts">
	import type { ActionsBlockConfig, Block, CardListBlockConfig, ContainerBlockConfig, CounterBlockConfig, FieldBlockConfig, FieldGroupBlockConfig, TextBlockConfig } from '$lib/engine/types';
	import { sheet } from '$lib/store/sheet.svelte';
	import { blockTitle } from './blocks';
	import CardListBlock from './CardListBlock.svelte';
	import ContainerBlock from './ContainerBlock.svelte';
	import CounterBlock from './CounterBlock.svelte';
	import FieldBlock from './FieldBlock.svelte';
	import FieldGroupBlock from './FieldGroupBlock.svelte';
	import TextBlock from './TextBlock.svelte';
	import ActionsBlock from './ActionsBlock.svelte';

	let { block }: { block: Block } = $props();
	const title = $derived(sheet.character ? blockTitle(sheet.character, block) : null);
</script>

<section class="frame card" class:tile={block.type === 'field'} data-block={block.id} data-block-type={block.type}>
	{#if title}<h2 class="section-title">{title}</h2>{/if}
	<div class="content">
		{#if block.type === 'field'}<FieldBlock config={block.config as unknown as FieldBlockConfig} title={block.title} />
		{:else if block.type === 'fieldGroup'}<FieldGroupBlock config={block.config as FieldGroupBlockConfig} />
		{:else if block.type === 'counter'}<CounterBlock config={block.config as CounterBlockConfig} />
		{:else if block.type === 'container'}<ContainerBlock config={block.config as unknown as ContainerBlockConfig} />
		{:else if block.type === 'cardList'}<CardListBlock config={block.config as unknown as CardListBlockConfig} />
		{:else if block.type === 'text'}<TextBlock config={block.config as unknown as TextBlockConfig} />
		{:else if block.type === 'actions'}<ActionsBlock config={block.config as ActionsBlockConfig} />
		{/if}
	</div>
</section>

<style>
	.frame {
		position: relative;
		height: 100%;
		display: flex;
		flex-direction: column;
		padding: 10px 14px 0;
		overflow: hidden;
	}
	.frame.tile {
		padding: 0;
	}
	.section-title {
		margin-bottom: 4px;
		flex-shrink: 0;
	}
	.content {
		flex: 1;
		min-height: 0;
		overflow-y: auto;
		overscroll-behavior: contain;
		padding-bottom: 10px;
	}
	.tile .content {
		padding-bottom: 0;
	}
</style>
