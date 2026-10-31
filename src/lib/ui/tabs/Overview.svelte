<script lang="ts">
	// Feste Standardansicht für den Spieltisch.
	import { ATTRIBUTES, GROUPS, SKILLS, STD } from '$lib/model/defaults';
	import { setFieldBase } from '$lib/store/actions';
	import { sheet } from '$lib/store/sheet.svelte';
	import { ui } from '$lib/store/ui.svelte';
	import { sortedFields } from '../fields';
	import { formatNumber, parseNumberInput } from '../format';
	import AbilityCard from '../components/AbilityCard.svelte';
	import CounterBoxes from '../components/CounterBoxes.svelte';
	import FieldRow from '../components/FieldRow.svelte';
	import FieldValue from '../components/FieldValue.svelte';
	import Icon from '../components/Icon.svelte';
	import ItemRow from '../components/ItemRow.svelte';
	import QuickCreate from '../components/QuickCreate.svelte';
	import StatTile from '../components/StatTile.svelte';

	const c = $derived(sheet.character!);
	const ev = $derived(sheet.evaluation!);

	const SKILL_ATTR = new Map(SKILLS.map((s) => [STD.skill(s.key), ATTRIBUTES.find((a) => a.key === s.attr)!.name]));
	const special = new Set<string>([
		STD.level,
		STD.prof,
		STD.hpMax,
		STD.hpCurrent,
		STD.hpTemp,
		STD.attuned,
		STD.attunementLimit,
		...ATTRIBUTES.flatMap((a) => [STD.attr(a.key), STD.attrMod(a.key)])
	]);
	const visible = (group: string) => sortedFields(c, { group });
	const extra = (group: string) => visible(group).filter((f) => !special.has(f.id));

	const combat = $derived(visible(GROUPS.combat));
	const customGroups = $derived.by(() => {
		const known = new Set<string>(Object.values(GROUPS));
		const names = new Set<string>();
		for (const f of Object.values(c.fields)) {
			const g = f.group?.trim() || GROUPS.custom;
			if (!f.hidden && (!known.has(g) || g === GROUPS.custom)) names.add(g);
		}
		return [...names].sort((a, b) => (a === GROUPS.custom ? 1 : b === GROUPS.custom ? -1 : a.localeCompare(b, 'de')));
	});

	const conditions = $derived(Object.values(c.abilities).filter((a) => a.kind === 'condition').sort((a, b) => a.order - b.order));
	const abilities = $derived(
		Object.values(c.abilities)
			.filter((a) => a.kind === 'ability' && (a.counterId || Object.values(c.modifiers).some((m) => m.source.kind === 'ability' && m.source.id === a.id)))
			.sort((a, b) => a.order - b.order)
	);
	const equippedContainers = $derived(Object.values(c.containers).filter((x) => x.equipped).sort((a, b) => a.order - b.order));
	const equippedItems = $derived(
		Object.values(c.items)
			.filter((i) => c.containers[i.containerId]?.equipped)
			.sort((a, b) => a.order - b.order)
	);
	const spellSlots = $derived(
		Object.values(c.counters)
			.filter((x) => x.group === 'Zauberplätze')
			.sort((a, b) => a.order - b.order)
	);
	const otherCounters = $derived(
		Object.values(c.counters)
			.filter((x) => x.group !== 'Zauberplätze' && x.group !== 'Nutzungen')
			.sort((a, b) => a.order - b.order)
	);
	let editSlots = $state(false);
	let quickContainer = $state<string | undefined>(undefined);
	$effect.pre(() => {
		if (!quickContainer || !c.containers[quickContainer]) quickContainer = equippedContainers[0]?.id;
	});

	let hpAmount = $state('');
	function hp(delta: 1 | -1) {
		const f = c.fields[STD.hpCurrent];
		if (!f) return;
		const n = parseNumberInput(hpAmount) ?? 1;
		setFieldBase(STD.hpCurrent, f.base + delta * Math.abs(n));
		hpAmount = '';
	}
</script>

<div class="overview">
	<!-- Spalte 1: Attribute und Rettungswürfe -->
	<div class="col">
		<section class="card pad">
			<h2 class="section-title">Attribute</h2>
			<div class="attrs">
				{#each ATTRIBUTES as a (a.key)}
					{@const f = c.fields[STD.attr(a.key)]}
					{@const mod = c.fields[STD.attrMod(a.key)]}
					{#if (f && !f.hidden) || (mod && !mod.hidden)}
						<div class="attr">
							<span class="label" title={a.long}>{f?.name ?? a.name}</span>
							{#if f && !f.hidden}<FieldValue id={f.id} size="lg" />{/if}
							{#if mod && !mod.hidden}
								<span class="mod"><FieldValue id={mod.id} size="sm" label={mod.name} /></span>
							{/if}
						</div>
					{/if}
				{/each}
			</div>
			{#each extra(GROUPS.attributes) as f (f.id)}<FieldRow id={f.id} showProf={false} />{/each}
		</section>

		<section class="card pad">
			<h2 class="section-title">Rettungswürfe</h2>
			<div>
				{#each visible(GROUPS.saves) as f (f.id)}<FieldRow id={f.id} />{/each}
			</div>
		</section>

		{#if visible(GROUPS.passive).length}
			<section class="card pad">
				<h2 class="section-title">Passive Werte</h2>
				{#each visible(GROUPS.passive) as f (f.id)}<FieldRow id={f.id} showProf={false} />{/each}
			</section>
		{/if}
	</div>

	<!-- Spalte 2: Fertigkeiten -->
	<div class="col">
		<section class="card pad">
			<h2 class="section-title">Fertigkeiten</h2>
			<div>
				{#each visible(GROUPS.skills) as f (f.id)}<FieldRow id={f.id} hint={SKILL_ATTR.get(f.id)} />{/each}
			</div>
		</section>
	</div>

	<!-- Spalte 3: Kampf, TP, Zähler, Zustände, Ausrüstung -->
	<div class="col">
		<div class="tiles">
			{#each combat as f (f.id)}<StatTile id={f.id} />{/each}
			<StatTile id={STD.prof} />
		</div>

		<section class="card pad hp">
			<div class="hp-main">
				{#if c.fields[STD.hpCurrent] && !c.fields[STD.hpCurrent].hidden}
					<div class="hp-cur">
						<span class="eyebrow">{c.fields[STD.hpCurrent].name}</span>
						<FieldValue id={STD.hpCurrent} size="xl" />
					</div>
				{/if}
				{#if c.fields[STD.hpMax] && !c.fields[STD.hpMax].hidden}
					<div class="hp-max">
						<span class="eyebrow">{c.fields[STD.hpMax].name}</span>
						<FieldValue id={STD.hpMax} size="lg" />
					</div>
				{/if}
				{#if c.fields[STD.hpTemp] && !c.fields[STD.hpTemp].hidden}
					<div class="hp-max">
						<span class="eyebrow">{c.fields[STD.hpTemp].name}</span>
						<FieldValue id={STD.hpTemp} size="lg" />
					</div>
				{/if}
			</div>
			{#if c.fields[STD.hpCurrent]}
				<div class="hp-adjust">
					<button type="button" class="btn" aria-label="TP verringern" onclick={() => hp(-1)}><Icon name="minus" /></button>
					<input class="input num" type="text" inputmode="numeric" placeholder="1" aria-label="Betrag" bind:value={hpAmount} style="width: 70px"
						onkeydown={(e) => { if (e.key === 'Enter') hp(e.shiftKey ? 1 : -1); }} />
					<button type="button" class="btn" aria-label="TP erhöhen" onclick={() => hp(1)}><Icon name="plus" /></button>
				</div>
			{/if}
			{#each extra(GROUPS.hp) as f (f.id)}<FieldRow id={f.id} showProf={false} />{/each}
		</section>

		<section class="card pad">
			{#each otherCounters as ct (ct.id)}
				<CounterBoxes id={ct.id} label={ct.group === 'Todesrettungswürfe' ? ct.name.replace('Todesrettungswürfe – ', 'Todesrettung: ') : ct.name} editable={ct.id === STD.counter.hitDice} />
			{/each}
			{#if !otherCounters.length}<p class="empty">Keine Zähler.</p>{/if}
		</section>

		{#if visible(GROUPS.magic).length || spellSlots.some((s) => s.max > 0) || editSlots}
			<section class="card pad">
				<div class="head-row">
					<h2 class="section-title">Magie</h2>
					<button type="button" class="btn ghost small" onclick={() => (editSlots = !editSlots)}>{editSlots ? 'Fertig' : 'Zauberplätze'}</button>
				</div>
				{#each visible(GROUPS.magic) as f (f.id)}<FieldRow id={f.id} showProf={false} />{/each}
				{#each spellSlots.filter((s) => editSlots || s.max > 0) as s (s.id)}
					<CounterBoxes id={s.id} label={s.name.replace('Zauberplätze ', '')} editable={editSlots} />
				{/each}
			</section>
		{/if}

		<section class="card pad">
			<h2 class="section-title">Zustände</h2>
			{#each conditions as a (a.id)}<AbilityCard id={a.id} />{/each}
			{#if !conditions.length}<p class="empty">Keine Zustände.</p>{/if}
			<QuickCreate kind="condition" />
			{#if abilities.length}
				<h2 class="section-title sub">Fähigkeiten mit Wirkung</h2>
				{#each abilities as a (a.id)}<AbilityCard id={a.id} />{/each}
			{/if}
		</section>

		<section class="card pad">
			<div class="head-row">
				<h2 class="section-title">Ausgerüstet</h2>
				{#if ev.attunement.limit !== null}
					<button
						type="button"
						class="attune"
						class:over={ev.attunement.over}
						title={ev.attunement.over ? 'Mehr eingestimmte Items als erlaubt – nur ein Hinweis' : 'Eingestimmte Items / Limit'}
						onclick={() => ui.open({ kind: 'field', id: STD.attuned })}
					>
						{#if ev.attunement.over}<Icon name="alert" size={14} />{/if}
						Einstimmung {formatNumber(ev.attunement.count)}/{formatNumber(ev.attunement.limit)}
					</button>
				{/if}
			</div>
			{#each equippedItems as i (i.id)}<ItemRow id={i.id} draggableRow={false} />{/each}
			{#if !equippedItems.length}<p class="empty">Nichts ausgerüstet.</p>{/if}
			{#if equippedContainers.length}
				<QuickCreate kind="item" bind:containerId={quickContainer} chooseContainer={equippedContainers.length > 1} />
			{/if}
		</section>

		{#each customGroups as g (g)}
			<section class="card pad">
				<h2 class="section-title">{g}</h2>
				{#each visible(g) as f (f.id)}<FieldRow id={f.id} />{/each}
			</section>
		{/each}
		{#if extra(GROUPS.basics).length}
			<section class="card pad">
				<h2 class="section-title">{GROUPS.basics}</h2>
				{#each extra(GROUPS.basics) as f (f.id)}<FieldRow id={f.id} />{/each}
			</section>
		{/if}
	</div>
</div>

<style>
	.overview {
		display: grid;
		grid-template-columns: 270px 290px minmax(0, 1fr);
		gap: 14px;
		align-items: start;
	}
	.col {
		display: flex;
		flex-direction: column;
		gap: 14px;
		min-width: 0;
	}
	.pad {
		padding: 12px 14px;
	}
	.pad > .section-title {
		margin-bottom: 6px;
	}
	.section-title.sub {
		margin-top: 14px;
	}
	.head-row {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 8px;
		margin-bottom: 4px;
	}
	.attrs {
		display: grid;
		grid-template-columns: 1fr 1fr;
		gap: 8px;
	}
	.attr {
		display: flex;
		flex-direction: column;
		align-items: center;
		padding: 8px 4px 6px;
		border: 1px solid var(--border);
		border-radius: var(--radius);
		background: var(--surface-2);
	}
	.attr .label {
		font-size: 12px;
		font-weight: 650;
		letter-spacing: 0.08em;
		color: var(--muted);
	}
	.mod {
		margin-top: 2px;
		border-radius: 18px;
		background: var(--surface);
		border: 1px solid var(--border);
	}
	.mod :global(.value) {
		min-height: 32px;
		padding: 0 10px;
	}
	.tiles {
		display: grid;
		grid-template-columns: repeat(auto-fill, minmax(96px, 1fr));
		gap: 10px;
	}
	.hp-main {
		display: flex;
		align-items: flex-end;
		gap: 18px;
	}
	.hp-cur,
	.hp-max {
		display: flex;
		flex-direction: column;
	}
	.hp-cur {
		flex: 1;
	}
	.hp-cur :global(.value) {
		font-size: 42px;
		justify-content: flex-start;
	}
	.hp-adjust {
		display: flex;
		gap: 6px;
		margin-top: 8px;
	}
	.attune {
		display: inline-flex;
		align-items: center;
		gap: 4px;
		min-height: 32px;
		padding: 0 10px;
		border: 1px solid var(--border);
		border-radius: 16px;
		background: var(--surface-2);
		font-size: 12.5px;
		font-variant-numeric: tabular-nums;
	}
	.attune.over {
		color: var(--danger);
		border-color: var(--danger);
		background: var(--danger-soft);
	}
	section :global(.quick) {
		margin-top: 10px;
	}
</style>
