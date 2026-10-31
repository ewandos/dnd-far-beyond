<script lang="ts">
	// „Woher kommt dieser Wert?“ – Endwert, Basiswert und alle Modifikatoren in Auswertungsreihenfolge.
	import type { Stage } from '$lib/engine/evaluate';
	import { STD } from '$lib/model/defaults';
	import { addProficiency, deleteField, PROFICIENCY_LABEL, setFieldBase, setProficiency, updateField } from '$lib/store/actions';
	import { sheet } from '$lib/store/sheet.svelte';
	import { ui } from '$lib/store/ui.svelte';
	import type { ProficiencyLevel } from '$lib/engine/types';
	import { formatNumber, formatValue } from '../format';
	import { proficiencyFor, referencedBy } from '../fields';
	import Icon from '../components/Icon.svelte';
	import NumberInput from '../components/NumberInput.svelte';
	import ModifierForm from './ModifierForm.svelte';
	import ModifierRow from './ModifierRow.svelte';

	let { id }: { id: string } = $props();

	const c = $derived(sheet.character!);
	const field = $derived(c.fields[id]);
	const r = $derived(sheet.evaluation?.fields[id]);
	const prof = $derived(proficiencyFor(c, id));
	const usedBy = $derived(sheet.evaluation ? referencedBy(c, id, sheet.evaluation.fields) : []);
	const isStd = $derived(id.startsWith('std.'));
	let adding = $state(false);
	let confirmDelete = $state(false);

	$effect(() => {
		// Beim Wechsel des Feldes Formulare schließen.
		void id;
		adding = false;
		confirmDelete = false;
	});

	const STAGES: { stage: Stage; label: string }[] = [
		{ stage: 'set', label: 'Setzen' },
		{ stage: 'add', label: 'Addieren' },
		{ stage: 'mul', label: 'Multiplizieren / Teilen' }
	];
	const LEVELS: ProficiencyLevel[] = [0, 0.5, 1, 2];
</script>

{#if field && r}
	<div class="inspector" data-inspect-field={id}>
		<header>
			<span class="eyebrow">{field.group ?? 'Feld'}</span>
			<input
				class="input inline title"
				value={field.name}
				aria-label="Feldname"
				oninput={(e) => {
					const v = (e.currentTarget as HTMLInputElement).value;
					if (v.trim()) updateField(id, 'name', v);
				}}
			/>
		</header>

		<section class="total">
			<div class="final">
				<span class="eyebrow">Endwert</span>
				<span class="big num">{formatValue(r.value, field)}</span>
			</div>
			<div class="base">
				<span class="eyebrow">Basiswert</span>
				{#if field.computed}
					<span class="num computed">{formatNumber(r.base)}</span>
				{:else}
					<NumberInput value={field.base} onchange={(v) => setFieldBase(id, v)} label="Basiswert {field.name}" width="96px" />
				{/if}
			</div>
		</section>
		{#if r.baseNote}<p class="note muted">{r.baseNote}</p>{/if}

		{#if r.conflict}
			<div class="alert warn">
				<Icon name="conflict" size={16} />
				<span>
					Konflikt: {r.conflict.modifierIds.length} Setzen-Modifikatoren sind aktiv. Der höchste Wert gilt
					({c.modifiers[r.conflict.winnerId]?.description || 'unbenannt'}). Zum Lösen eine Quelle ausschalten.
				</span>
			</div>
		{/if}
		{#if id === STD.attuned && sheet.evaluation?.attunement.over}
			<div class="alert warn">
				<Icon name="info" size={16} />
				<span>Mehr eingestimmte Items als das Einstimmungslimit ({formatNumber(sheet.evaluation.attunement.limit ?? 0)}) – nur ein Hinweis.</span>
			</div>
		{/if}

		{#if prof}
			<section class="prof">
				<span class="eyebrow">Übung</span>
				<div class="segmented" role="radiogroup" aria-label="Übung">
					{#each LEVELS as l (l)}
						<button type="button" role="radio" aria-checked={prof.level === l} class:on={prof.level === l} onclick={() => setProficiency(prof.id, l)}>
							{PROFICIENCY_LABEL[l]}
						</button>
					{/each}
				</div>
			</section>
		{/if}

		<section class="breakdown">
			<h3 class="section-title">Auswertung</h3>
			<div class="stage">
				<div class="stage-row">
					<span class="effect num">{formatNumber(r.base)}</span>
					<span>{field.computed ? 'Gezählter Basiswert' : 'Basiswert'}</span>
				</div>
			</div>
			{#each STAGES as s (s.stage)}
				{@const steps = r.steps.filter((x) => x.stage === s.stage)}
				{#if steps.length}
					<div class="stage">
						<span class="eyebrow">{s.label}</span>
						{#each steps as step (step.modifierId)}
							<ModifierRow modifierId={step.modifierId} context="field" {step} />
						{/each}
					</div>
				{/if}
			{/each}
			<div class="stage result">
				<div class="stage-row">
					<span class="effect num">{formatValue(r.value, field)}</span>
					<span>Endwert</span>
				</div>
			</div>

			{#if r.issues.length}
				<div class="stage">
					<span class="eyebrow err">Fehlerhaft – zählt nicht</span>
					{#each r.issues as issue (issue.modifierId)}
						<ModifierRow modifierId={issue.modifierId} context="field" />
					{/each}
				</div>
			{/if}
			{#if r.inactive.length}
				<div class="stage">
					<span class="eyebrow">Inaktiv</span>
					{#each r.inactive as entry (entry.modifierId)}
						<ModifierRow modifierId={entry.modifierId} context="field" />
					{/each}
				</div>
			{/if}
		</section>

		<section>
			{#if adding}
				<ModifierForm fixedTarget={id} ondone={() => (adding = false)} />
			{:else}
				<div class="add-row">
					<button type="button" class="btn" onclick={() => (adding = true)}>
						<Icon name="plus" size={18} /> Modifikator hinzufügen
					</button>
					{#if !prof && c.fields[STD.prof]}
						<button type="button" class="btn ghost" title="Übungs-Quelle mit @Übungsbonus × Stufe" onclick={() => addProficiency(id, STD.prof)}>
							Übungs-Quelle
						</button>
					{/if}
				</div>
			{/if}
		</section>

		{#if usedBy.length}
			<section>
				<span class="eyebrow">Wird verwendet von</span>
				<div class="used">
					{#each usedBy as f (f.id)}
						<button type="button" class="link" onclick={() => ui.push({ kind: 'field', id: f.id })}>{f.name}</button>
					{/each}
				</div>
			</section>
		{/if}

		<section>
			<label class="notes">
				<span class="eyebrow">Notizen</span>
				<textarea
					class="textarea"
					rows="2"
					placeholder="z. B. Vorteil auf Rettungswürfe gegen Gift"
					value={field.notes ?? ''}
					oninput={(e) => updateField(id, 'notes', (e.currentTarget as HTMLTextAreaElement).value)}
				></textarea>
			</label>
		</section>

		<footer>
			<label class="check small">
				<input type="checkbox" checked={!!field.hidden} onchange={(e) => updateField(id, 'hidden', (e.currentTarget as HTMLInputElement).checked || undefined)} />
				Ausblenden
			</label>
			<label class="check small">
				<input
					type="checkbox"
					checked={field.format === 'signed'}
					onchange={(e) => updateField(id, 'format', (e.currentTarget as HTMLInputElement).checked ? 'signed' : undefined)}
				/>
				Mit Vorzeichen
			</label>
			<button
				type="button"
				class="btn ghost small"
				onclick={() => {
					ui.historyFilter = field.name;
					ui.tab = 'history';
				}}
			>
				<Icon name="history" size={16} /> Verlauf
			</button>
			<span class="spacer"></span>
			{#if confirmDelete}
				<button type="button" class="btn danger small" onclick={() => { deleteField(id); ui.back(); }}>Wirklich löschen</button>
				<button type="button" class="btn ghost small" onclick={() => (confirmDelete = false)}>Abbrechen</button>
			{:else}
				<button type="button" class="btn ghost danger small" title={isStd ? 'Standardfeld – SL-Inhalte zielen darauf' : ''} onclick={() => (confirmDelete = true)}>
					<Icon name="trash" size={16} /> Feld löschen
				</button>
			{/if}
		</footer>
	</div>
{:else}
	<p class="empty">Dieses Feld existiert nicht mehr.</p>
{/if}

<style>
	.inspector {
		display: flex;
		flex-direction: column;
		gap: 16px;
	}
	header {
		display: flex;
		flex-direction: column;
		gap: 2px;
	}
	.title {
		font-family: var(--font-display);
		font-size: 24px;
		font-weight: 600;
		margin-left: -6px;
		width: calc(100% + 6px);
	}
	.total {
		display: flex;
		justify-content: space-between;
		align-items: flex-end;
		gap: 16px;
		padding: 14px 16px;
		background: var(--surface-2);
		border-radius: var(--radius);
	}
	.final,
	.base {
		display: flex;
		flex-direction: column;
		gap: 2px;
	}
	.base {
		align-items: flex-end;
	}
	.big {
		font-size: 44px;
		font-weight: 700;
		line-height: 1;
	}
	.computed {
		font-size: 20px;
		font-weight: 600;
		min-height: var(--tap);
		display: flex;
		align-items: center;
	}
	.note {
		margin: -8px 0 0;
		font-size: 13px;
	}
	.alert {
		display: flex;
		gap: 8px;
		align-items: flex-start;
		padding: 10px 12px;
		border-radius: var(--radius-sm);
		font-size: 13.5px;
	}
	.alert.warn {
		background: var(--accent-soft);
		color: var(--text);
	}
	.alert :global(svg) {
		margin-top: 2px;
		color: var(--accent);
	}
	.prof {
		display: flex;
		flex-direction: column;
		gap: 6px;
	}
	.segmented {
		display: flex;
		border: 1px solid var(--border);
		border-radius: var(--radius-sm);
		overflow: hidden;
	}
	.segmented button {
		flex: 1;
		min-height: 40px;
		border: none;
		border-right: 1px solid var(--border);
		background: var(--surface);
		font-size: 13.5px;
	}
	.segmented button:last-child {
		border-right: none;
	}
	.segmented button.on {
		background: var(--accent);
		color: var(--accent-text);
		font-weight: 600;
	}
	.breakdown {
		display: flex;
		flex-direction: column;
		gap: 10px;
	}
	.stage {
		display: flex;
		flex-direction: column;
	}
	.stage-row {
		display: flex;
		gap: 10px;
		align-items: baseline;
		padding: 4px 0;
	}
	.stage-row .effect {
		flex: 0 0 64px;
		font-size: 17px;
		font-weight: 650;
	}
	.stage.result {
		border-top: 2px solid var(--border-strong);
		padding-top: 4px;
	}
	.stage.result .effect {
		color: var(--accent);
	}
	.eyebrow.err {
		color: var(--danger);
	}
	.add-row {
		display: flex;
		gap: 8px;
	}
	.used {
		display: flex;
		flex-wrap: wrap;
		gap: 4px 12px;
		margin-top: 4px;
	}
	.link {
		border: none;
		background: none;
		padding: 6px 0;
		color: var(--accent);
	}
	.link:hover {
		text-decoration: underline;
	}
	.notes {
		display: flex;
		flex-direction: column;
		gap: 4px;
	}
	footer {
		display: flex;
		align-items: center;
		flex-wrap: wrap;
		gap: 4px 12px;
		padding-top: 12px;
		border-top: 1px solid var(--border);
	}
	.check.small {
		font-size: 13px;
		min-height: 36px;
	}
	.spacer {
		flex: 1;
	}
</style>
