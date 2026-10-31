<script lang="ts">
	// Aktionsübersicht: was habe ich als Aktion, Bonusaktion, Reaktion oder sonst?
	import { ACTION_KIND_LABEL, ACTION_KIND_SINGULAR, ACTION_KINDS, collectActions } from '$lib/engine/actions';
	import type { ActionKind, ActionsBlockConfig } from '$lib/engine/types';
	import { addAction } from '$lib/store/actions';
	import { sheet } from '$lib/store/sheet.svelte';
	import { ui } from '$lib/store/ui.svelte';
	import ActionEntry from '../components/ActionEntry.svelte';
	import Icon from '../components/Icon.svelte';

	let { config }: { config: ActionsBlockConfig } = $props();
	const c = $derived(sheet.character!);
	const kinds = $derived(config.kinds?.length ? ACTION_KINDS.filter((k) => config.kinds!.includes(k)) : ACTION_KINDS);
	const views = $derived(sheet.evaluation ? collectActions(c, sheet.evaluation, { spellListIds: config.spellListIds ?? [] }) : []);
	const visible = $derived(views.filter((v) => (config.showStandard !== false || !v.standard) && (!config.hideInactive || v.active)));

	let name = $state('');
	let kind = $state<ActionKind>('action');
	$effect.pre(() => {
		if (!kinds.includes(kind)) kind = kinds[0];
	});

	function create() {
		if (!name.trim()) return;
		const id = addAction({ name, kind });
		ui.toast(`${ACTION_KIND_SINGULAR[kind]} angelegt: ${name.trim()}`, { label: 'Öffnen', run: () => ui.open({ kind: 'action', id }) });
		name = '';
	}
</script>

<div class="actions-block">
	<div class="columns" style:--cols={Math.min(kinds.length, 4)}>
		{#each kinds as k (k)}
			{@const own = visible.filter((v) => v.kind === k && !v.standard)}
			{@const std = visible.filter((v) => v.kind === k && v.standard)}
			<section class="col" data-kind={k}>
				<h3 class="kind">{ACTION_KIND_LABEL[k]} <span class="count">{own.length}</span></h3>
				{#each own as v (v.key)}<ActionEntry view={v} />{/each}
				{#if !own.length}<p class="empty">Keine eigenen.</p>{/if}
				{#if std.length}
					<div class="std" aria-label="Allgemeine {ACTION_KIND_LABEL[k]}">
						{#each std as v (v.key)}
							<button type="button" class="chip" class:off={!v.active} title={v.description} onclick={() => v.actionId && ui.open({ kind: 'action', id: v.actionId })}>{v.name}</button>
						{/each}
					</div>
				{/if}
			</section>
		{/each}
	</div>
	<form
		class="quick"
		onsubmit={(e) => {
			e.preventDefault();
			create();
		}}
	>
		<input class="input" placeholder="Aktion anlegen, z. B. Angriff: Langschwert" aria-label="Name der Aktion" bind:value={name} />
		<select class="select" bind:value={kind} aria-label="Art der Aktion">
			{#each kinds as k (k)}<option value={k}>{ACTION_KIND_SINGULAR[k]}</option>{/each}
		</select>
		<button type="submit" class="btn primary" disabled={!name.trim()}><Icon name="plus" size={18} /> Anlegen</button>
	</form>
</div>

<style>
	.actions-block {
		display: flex;
		flex-direction: column;
		gap: 12px;
		padding-top: 4px;
	}
	.columns {
		display: grid;
		grid-template-columns: repeat(var(--cols), minmax(0, 1fr));
		gap: 16px;
	}
	.col {
		min-width: 0;
	}
	.kind {
		font-size: 16px;
		padding-bottom: 4px;
		margin-bottom: 4px;
		border-bottom: 2px solid var(--accent);
	}
	.count {
		font-family: var(--font-ui);
		font-size: 12px;
		font-weight: 500;
		color: var(--muted);
	}
	.empty {
		margin: 0;
		padding: 6px 0;
		font-size: 13px;
	}
	.std {
		display: flex;
		flex-wrap: wrap;
		gap: 4px;
		margin-top: 8px;
	}
	.chip {
		min-height: 30px;
		padding: 0 10px;
		border: 1px solid var(--border);
		border-radius: 15px;
		background: var(--surface);
		font-size: 12.5px;
		color: var(--muted);
	}
	.chip:hover {
		color: var(--accent);
		border-color: var(--accent);
	}
	.chip.off {
		opacity: 0.5;
	}
	.quick {
		display: flex;
		gap: 8px;
	}
	.quick .input {
		flex: 1;
	}
	.quick .select {
		width: 170px;
	}
</style>
