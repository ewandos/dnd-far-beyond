<script lang="ts">
	// Formel-Eingabe mit Autovervollständigung nach „@“ und Live-Vorschau des Ergebnisses.
	import { evalDiceTerms, formatDice, parseDiceExpr, parseListText } from '$lib/engine/dice';
	import { displayRefName, evalAst, parseExpr, toDisplayExpr, toStoredExpr } from '$lib/engine/formula';
	import type { FieldType } from '$lib/engine/types';
	import { sheet } from '$lib/store/sheet.svelte';
	import { formatNumber } from '../format';

	let {
		value,
		onchange,
		onenter,
		label = 'Wert oder Formel',
		placeholder = 'z. B. 2 oder 13 + @GES-Mod',
		live = false,
		preview = true,
		autofocus = false,
		className = '',
		kind = 'number'
	}: {
		value: string;
		onchange: (stored: string) => void;
		onenter?: () => void;
		label?: string;
		placeholder?: string;
		/** Änderungen bei jeder Eingabe melden (für Formulare) statt erst beim Verlassen. */
		live?: boolean;
		preview?: boolean;
		autofocus?: boolean;
		className?: string;
		/** Art des Zielfelds: bestimmt Vorschau und Autovervollständigung. */
		kind?: FieldType;
	} = $props();

	const fields = $derived(sheet.character ? Object.values(sheet.character.fields) : []);
	let text = $state('');
	let focused = $state(false);
	let input: HTMLInputElement | undefined = $state();

	$effect(() => {
		if (!focused) text = toDisplayExpr(value, fields);
	});
	$effect(() => {
		if (autofocus) input?.focus();
	});

	// Autovervollständigung --------------------------------------------------
	let query = $state<{ at: number; q: string } | null>(null);
	let active = $state(0);

	const suggestions = $derived.by(() => {
		if (!query) return [];
		const q = query.q.toLowerCase().trim();
		return fields
			.filter((f) => !q || f.name.toLowerCase().includes(q))
			.sort((a, b) => {
				const sa = a.name.toLowerCase().startsWith(q) ? 0 : 1;
				const sb = b.name.toLowerCase().startsWith(q) ? 0 : 1;
				return sa - sb || a.order - b.order;
			})
			.slice(0, 8);
	});

	function updateQuery() {
		if (!input || kind === 'list') return;
		const caret = input.selectionStart ?? text.length;
		const before = text.slice(0, caret);
		const at = before.lastIndexOf('@');
		if (at < 0) return (query = null);
		const seg = before.slice(at + 1);
		if (seg.length > 40 || /[[\]{}()+*/×÷,;@]/.test(seg)) return (query = null);
		query = { at, q: seg };
		active = 0;
	}

	function choose(id: string) {
		const f = fields.find((x) => x.id === id);
		if (!f || !query || !input) return;
		const caret = input.selectionStart ?? text.length;
		const insert = '@' + displayRefName(f, fields) + ' ';
		text = text.slice(0, query.at) + insert + text.slice(caret);
		const pos = query.at + insert.length;
		query = null;
		if (live) onchange(toStoredExpr(text, fields));
		requestAnimationFrame(() => {
			input?.focus();
			input?.setSelectionRange(pos, pos);
		});
	}

	// Vorschau ----------------------------------------------------------------
	const result = $derived.by(() => {
		if (!text.trim()) return null;
		if (kind === 'list') {
			const items = parseListText(text);
			return { ok: true as const, text: `${items.length} Eintr${items.length === 1 ? 'ag' : 'äge'}: ${items.join(' · ')}` };
		}
		const stored = toStoredExpr(text, fields);
		const ev = sheet.evaluation;
		if (kind === 'dice') {
			const d = parseDiceExpr(stored);
			if (!d.ok) return { ok: false as const, text: d.error };
			const r = evalDiceTerms(d.terms, (id) => {
				const f = ev?.fields[id];
				if (!f) return undefined;
				return f.kind === 'dice' ? { kind: 'dice', value: f.dice ?? { dice: {}, flat: 0 } } : { kind: 'number', value: f.value };
			});
			return r.ok ? { ok: true as const, text: '= ' + formatDice(r.value) } : { ok: false as const, text: r.error };
		}
		const p = parseExpr(stored);
		if (!p.ok) return { ok: false as const, text: p.error };
		const r = evalAst(p.ast, (id) => ev?.fields[id]?.value);
		return r.ok ? { ok: true as const, text: '= ' + formatNumber(r.value) } : { ok: false as const, text: r.error };
	});

	function commit() {
		const stored = kind === 'list' ? text : toStoredExpr(text, fields);
		if (stored !== value) onchange(stored);
	}
</script>

<div class="formula {className}">
	<input
		bind:this={input}
		class="input"
		type="text"
		autocomplete="off"
		autocapitalize="off"
		spellcheck="false"
		enterkeyhint="done"
		aria-label={label}
		{placeholder}
		bind:value={text}
		onfocus={() => (focused = true)}
		onblur={() => {
			focused = false;
			setTimeout(() => (query = null), 150);
			commit();
		}}
		oninput={() => {
			updateQuery();
			if (live) onchange(kind === 'list' ? text : toStoredExpr(text, fields));
		}}
		onclick={updateQuery}
		onkeydown={(e) => {
			if (query && suggestions.length) {
				if (e.key === 'ArrowDown') {
					e.preventDefault();
					active = (active + 1) % suggestions.length;
					return;
				}
				if (e.key === 'ArrowUp') {
					e.preventDefault();
					active = (active - 1 + suggestions.length) % suggestions.length;
					return;
				}
				if (e.key === 'Enter' || e.key === 'Tab') {
					e.preventDefault();
					choose(suggestions[active].id);
					return;
				}
				if (e.key === 'Escape') {
					e.preventDefault();
					e.stopPropagation();
					query = null;
					return;
				}
			}
			if (e.key === 'Enter') {
				e.preventDefault();
				commit();
				onenter?.();
			}
		}}
	/>
	{#if query && suggestions.length}
		<ul class="suggest" role="listbox" aria-label="Felder">
			{#each suggestions as f, i (f.id)}
				<li>
					<button
						type="button"
						role="option"
						aria-selected={i === active}
						class:active={i === active}
						onpointerdown={(e) => e.preventDefault()}
						onclick={() => choose(f.id)}
					>
						<span>{f.name}</span>
						<span class="g">{f.group ?? ''}</span>
						<span class="v num">{formatNumber(sheet.evaluation?.fields[f.id]?.value ?? 0)}</span>
					</button>
				</li>
			{/each}
		</ul>
	{/if}
	{#if preview && result}
		<div class="preview" class:error={!result.ok}>{result.text}</div>
	{/if}
</div>

<style>
	.formula {
		position: relative;
		flex: 1;
		min-width: 0;
	}
	.suggest {
		position: absolute;
		z-index: 30;
		left: 0;
		right: 0;
		top: calc(100% + 4px);
		margin: 0;
		padding: 4px;
		list-style: none;
		background: var(--surface);
		border: 1px solid var(--border-strong);
		border-radius: var(--radius-sm);
		box-shadow: var(--shadow-lg);
		min-width: 260px;
	}
	.suggest button {
		display: grid;
		grid-template-columns: 1fr auto auto;
		gap: 10px;
		align-items: center;
		width: 100%;
		min-height: 40px;
		padding: 0 10px;
		border: none;
		border-radius: 4px;
		background: transparent;
		text-align: left;
	}
	.suggest button.active,
	.suggest button:hover {
		background: var(--accent-soft);
	}
	.g {
		font-size: 12px;
		color: var(--muted);
	}
	.v {
		font-size: 13px;
		color: var(--muted);
		min-width: 2.5em;
		text-align: right;
	}
	.preview {
		font-size: 12.5px;
		color: var(--muted);
		padding: 3px 2px 0;
		font-variant-numeric: tabular-nums;
	}
	.preview.error {
		color: var(--danger);
	}
</style>
