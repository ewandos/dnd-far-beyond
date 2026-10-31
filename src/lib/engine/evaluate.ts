// Berechnungs-Engine: Basiswert → Setzen → Addieren → Multiplizieren/Teilen.
// Deterministisch, ohne D&D-Regelwissen, ohne UI-Abhängigkeit.

import { addDice, average, emptyDice, evalDiceTerms, formatDice, parseDiceExpr, parseListText, type DiceLookup, type DiceParse, type DiceValue } from './dice';
import { evalAst, parseExpr, type Node } from './formula';
import type { Character, Field, FieldType, Id, Modifier, Operation, ProficiencyLevel, Rounding } from './types';

export type Stage = 'set' | 'add' | 'mul';

export const STAGE_OF: Record<Operation, Stage> = {
	set: 'set',
	add: 'add',
	multiply: 'mul',
	divide: 'mul'
};

export const PROFICIENCY_FACTORS: ProficiencyLevel[] = [0, 0.5, 1, 2];

export interface Step {
	modifierId: Id;
	op: Operation;
	stage: Stage;
	/** Aufgelöster Wert des Ausdrucks (bei Übung bereits mit Faktor verrechnet). */
	value: number;
	/** Rohwert des Ausdrucks vor Übungsfaktor. */
	rawValue: number;
	/** Übungsfaktor, falls die Quelle eine Übung ist. */
	factor?: number;
	before: number;
	after: number;
	refs: Id[];
	/** Setzen-Modifikator, der im Konflikt unterlegen ist. */
	overridden?: boolean;
	/** Bei Würfel- und Listenfeldern: Beitrag, Stand davor und danach als Text. */
	text?: string;
	beforeText?: string;
	afterText?: string;
}

export type IssueKind = 'parse' | 'missingRef' | 'cycle' | 'math';

export interface Issue {
	modifierId: Id;
	kind: IssueKind;
	message: string;
	/** Bei Zyklen: die Kette der beteiligten Felder, beginnend und endend beim Zielfeld. */
	chain?: Id[];
}

export interface InactiveEntry {
	modifierId: Id;
	reason: string;
}

export interface FieldResult {
	fieldId: Id;
	kind: FieldType;
	/** Anzeige bei Würfel- und Listenfeldern („1d8 + 3“, „Elfisch, Zwergisch“). */
	text?: string;
	dice?: DiceValue;
	list?: string[];
	base: number;
	/** Erklärung, falls der Basiswert gezählt statt eingegeben wird. */
	baseNote?: string;
	value: number;
	steps: Step[];
	inactive: InactiveEntry[];
	issues: Issue[];
	conflict?: { modifierIds: Id[]; winnerId: Id };
	deps: Id[];
	/** Fingerabdruck der Eingaben – für die inkrementelle Neuberechnung. */
	fingerprint: string;
}

export type ModifierState = 'applied' | 'overridden' | 'inactive' | 'error' | 'unassigned';

export interface ModifierStatus {
	state: ModifierState;
	reason?: string;
	value?: number;
	text?: string;
	issue?: Issue;
}

export interface Evaluation {
	fields: Record<Id, FieldResult>;
	modifiers: Record<Id, ModifierStatus>;
	unassigned: Id[];
	attunement: { count: number; limit: number | null; over: boolean };
	/** Felder, die in diesem Durchlauf tatsächlich neu berechnet wurden. */
	recomputed: Id[];
}

export const ATTUNED_FIELD_ID = 'std.attuned';
export const ATTUNEMENT_LIMIT_FIELD_ID = 'std.attunement_limit';

// ---------------------------------------------------------------------------
// Quellen

export interface SourceState {
	active: boolean;
	reason?: string;
	/** Übungsfaktor bei Übungs-Quellen. */
	factor?: number;
}

export function sourceState(c: Character, m: Modifier): SourceState {
	const { kind, id } = m.source;
	switch (kind) {
		case 'field':
			return { active: true };
		case 'item': {
			const item = c.items[id];
			if (!item) return { active: false, reason: 'Quelle fehlt' };
			const container = c.containers[item.containerId];
			if (container?.equipped) return { active: true };
			return {
				active: false,
				reason: container ? `nicht ausgerüstet (in „${container.name}“)` : 'nicht ausgerüstet'
			};
		}
		case 'ability': {
			const a = c.abilities[id];
			if (!a) return { active: false, reason: 'Quelle fehlt' };
			if (a.active) return { active: true };
			return { active: false, reason: a.kind === 'condition' ? 'Zustand aus' : 'Fähigkeit aus' };
		}
		case 'proficiency': {
			const p = c.proficiencies[id];
			if (!p) return { active: false, reason: 'Quelle fehlt' };
			if (!p.level) return { active: false, reason: 'Übung: keine', factor: 0 };
			return { active: true, factor: p.level };
		}
	}
	return { active: false, reason: 'Unbekannte Quelle' };
}

export function countAttunedItems(c: Character): number {
	let n = 0;
	for (const item of Object.values(c.items)) {
		if (item.requiresAttunement && c.containers[item.containerId]?.equipped) n++;
	}
	return n;
}

// ---------------------------------------------------------------------------
// Auswertung

interface Candidate {
	mod: Modifier;
	/** Zahlenfelder */
	ast?: Node;
	/** Würfelfelder */
	dice?: Extract<DiceParse, { ok: true }>['terms'];
	/** Listenfelder */
	list?: string[];
	refs: Id[];
	factor?: number;
}

const kindOf = (f: Field | undefined): FieldType => f?.type ?? 'number';

function byOrder(a: { order: number; id: Id }, b: { order: number; id: Id }) {
	return a.order - b.order || (a.id < b.id ? -1 : a.id > b.id ? 1 : 0);
}

function applyRounding(v: number, r: Rounding | undefined): number {
	switch (r ?? 'floor') {
		case 'floor':
			return Math.floor(v + 1e-9);
		case 'ceil':
			return Math.ceil(v - 1e-9);
		case 'round':
			return Math.round(v);
		case 'none':
			return v;
	}
}

/**
 * Berechnet alle Felder eines Charakters.
 *
 * Wird ein vorheriges Ergebnis übergeben, werden nur Felder neu berechnet, deren
 * eigene Eingaben sich geändert haben oder deren Abhängigkeiten einen neuen Endwert haben.
 */
export function evaluate(c: Character, previous?: Evaluation): Evaluation {
	const fields = c.fields;
	const modifiers = Object.values(c.modifiers).sort(byOrder);
	const statuses: Record<Id, ModifierStatus> = {};
	const unassigned: Id[] = [];

	const inactiveByField = new Map<Id, InactiveEntry[]>();
	const issuesByField = new Map<Id, Issue[]>();
	const candidatesByField = new Map<Id, Candidate[]>();
	const pushTo = <T>(map: Map<Id, T[]>, key: Id, v: T) => {
		const list = map.get(key);
		if (list) list.push(v);
		else map.set(key, [v]);
	};
	const fail = (target: Id, issue: Issue) => {
		pushTo(issuesByField, target, issue);
		statuses[issue.modifierId] = { state: 'error', issue, reason: issue.message };
	};

	// 1. Quellen prüfen, Ausdrücke parsen, Referenzen prüfen.
	for (const m of modifiers) {
		const target = m.targetFieldId;
		if (!target || !fields[target]) {
			unassigned.push(m.id);
			statuses[m.id] = {
				state: 'unassigned',
				reason: target ? 'Zielfeld gelöscht' : 'nicht zugeordnet'
			};
			continue;
		}
		const src = sourceState(c, m);
		if (!src.active) {
			pushTo(inactiveByField, target, { modifierId: m.id, reason: src.reason ?? 'inaktiv' });
			statuses[m.id] = { state: 'inactive', reason: src.reason };
			continue;
		}
		const targetKind = kindOf(fields[target]);
		if (targetKind !== 'number' && (m.op === 'multiply' || m.op === 'divide')) {
			fail(target, { modifierId: m.id, kind: 'parse', message: 'Bei Würfel- und Listenfeldern nur Setzen und Addieren' });
			continue;
		}
		if (targetKind !== 'number' && src.factor !== undefined) {
			fail(target, { modifierId: m.id, kind: 'parse', message: 'Übung wirkt nur auf Zahlenfelder' });
			continue;
		}
		if (targetKind === 'list') {
			pushTo(candidatesByField, target, { mod: m, list: parseListText(m.expr), refs: [] });
			continue;
		}
		const parsed = targetKind === 'dice' ? parseDiceExpr(m.expr) : parseExpr(m.expr);
		if (!parsed.ok) {
			fail(target, { modifierId: m.id, kind: 'parse', message: parsed.error });
			continue;
		}
		const missing = parsed.refs.filter((r) => !fields[r]);
		if (missing.length) {
			fail(target, {
				modifierId: m.id,
				kind: 'missingRef',
				message: 'Referenz auf gelöschtes Feld'
			});
			continue;
		}
		// Zahlenformeln brauchen Zahlenfelder; Würfelausdrücke dürfen auch Würfelfelder enthalten.
		const wrong = parsed.refs.find((r) => {
			const k = kindOf(fields[r]);
			return k === 'list' || (k === 'dice' && targetKind === 'number');
		});
		if (wrong) {
			fail(target, { modifierId: m.id, kind: 'parse', message: `„${fields[wrong].name}“ ist kein Zahlenfeld` });
			continue;
		}
		if ('ast' in parsed) pushTo(candidatesByField, target, { mod: m, ast: parsed.ast, refs: parsed.refs, factor: src.factor });
		else pushTo(candidatesByField, target, { mod: m, dice: parsed.terms, refs: parsed.refs });
	}

	// 2. Abhängigkeitsgraph und Zyklen (Tarjan).
	const fieldIds = Object.values(fields).sort(byOrder).map((f) => f.id);
	const edges = new Map<Id, Set<Id>>();
	for (const id of fieldIds) {
		const set = new Set<Id>();
		for (const cand of candidatesByField.get(id) ?? []) for (const r of cand.refs) set.add(r);
		edges.set(id, set);
	}
	const sccOf = stronglyConnected(fieldIds, edges);

	for (const id of fieldIds) {
		const cands = candidatesByField.get(id);
		if (!cands) continue;
		const kept: Candidate[] = [];
		for (const cand of cands) {
			const cyclicRef = cand.refs.find((r) => sccOf.get(r) === sccOf.get(id));
			if (cyclicRef === undefined) {
				kept.push(cand);
				continue;
			}
			const chain = [id, ...(findPath(cyclicRef, id, edges, sccOf) ?? [cyclicRef, id])];
			fail(id, { modifierId: cand.mod.id, kind: 'cycle', message: 'Zirkelbezug', chain });
		}
		candidatesByField.set(id, kept);
	}

	// 3. Topologische Reihenfolge über die bereinigten Kanten.
	const deps = new Map<Id, Id[]>();
	for (const id of fieldIds) {
		const set = new Set<Id>();
		for (const cand of candidatesByField.get(id) ?? []) for (const r of cand.refs) set.add(r);
		deps.set(id, [...set]);
	}
	const order = topoOrder(fieldIds, deps);

	// 4. Felder auswerten (inkrementell).
	const attunedCount = countAttunedItems(c);
	const results: Record<Id, FieldResult> = {};
	const recomputed: Id[] = [];
	const changed = new Set<Id>();

	for (const id of order) {
		const field = fields[id];
		const cands = candidatesByField.get(id) ?? [];
		const inactive = inactiveByField.get(id) ?? [];
		const issues = issuesByField.get(id) ?? [];
		const base = field.computed === 'attunedItems' ? attunedCount : Number(field.base) || 0;
		const fieldDeps = deps.get(id) ?? [];
		const fingerprint = JSON.stringify([
			base,
			field.type ?? 'number',
			field.diceBase ?? '',
			field.listBase ?? [],
			field.computed ?? '',
			cands.map((x) => [x.mod.id, x.mod.op, x.mod.expr, x.mod.rounding ?? '', x.factor ?? '']),
			inactive,
			issues.map((x) => [x.modifierId, x.kind, x.message, x.chain ?? ''])
		]);

		const prev = previous?.fields[id];
		if (prev && prev.fingerprint === fingerprint && !fieldDeps.some((d) => changed.has(d))) {
			results[id] = prev;
			continue;
		}

		const kind = kindOf(field);
		const result =
			kind === 'dice'
				? evaluateDiceField(field, cands, inactive, issues, fieldDeps, fingerprint, (ref) => {
						const r = results[ref];
						if (!r) return undefined;
						return r.kind === 'dice' ? { kind: 'dice', value: r.dice ?? emptyDice() } : { kind: 'number', value: r.value };
					})
				: kind === 'list'
					? evaluateListField(field, cands, inactive, issues, fingerprint)
					: evaluateField(field, base, cands, inactive, issues, fieldDeps, fingerprint, (ref) => results[ref]?.value);
		if (field.computed === 'attunedItems') {
			result.baseNote = `gezählt: ${attunedCount} ausgerüstete${attunedCount === 1 ? 's' : ''} Item${attunedCount === 1 ? '' : 's'} mit Einstimmung`;
		}
		// Auswertungsfehler (z. B. Division durch 0) in die Statusliste übernehmen.
		for (const issue of result.issues) {
			if (!statuses[issue.modifierId]) statuses[issue.modifierId] = { state: 'error', issue, reason: issue.message };
		}
		results[id] = result;
		recomputed.push(id);
		if (!prev || prev.value !== result.value || prev.text !== result.text) changed.add(id);
	}

	// 5. Status der angewendeten Modifikatoren (auch für wiederverwendete Ergebnisse).
	for (const r of Object.values(results)) {
		for (const s of r.steps) {
			statuses[s.modifierId] = { state: s.overridden ? 'overridden' : 'applied', value: s.value, ...(s.text !== undefined ? { text: s.text } : {}) };
			if (s.overridden) statuses[s.modifierId].reason = 'Konflikt: höherer Setzen-Wert gilt';
		}
		for (const issue of r.issues) {
			statuses[issue.modifierId] = { state: 'error', issue, reason: issue.message };
		}
	}

	const limitResult = results[ATTUNEMENT_LIMIT_FIELD_ID];
	const countResult = results[ATTUNED_FIELD_ID];
	const limit = limitResult ? limitResult.value : null;
	const count = countResult ? countResult.value : attunedCount;

	return {
		fields: results,
		modifiers: statuses,
		unassigned,
		attunement: { count, limit, over: limit !== null && count > limit },
		recomputed
	};
}

function evaluateField(
	field: Field,
	base: number,
	cands: Candidate[],
	inactive: InactiveEntry[],
	knownIssues: Issue[],
	deps: Id[],
	fingerprint: string,
	lookup: (id: Id) => number | undefined
): FieldResult {
	const issues = [...knownIssues];
	const steps: Step[] = [];
	const evaluated: { cand: Candidate; raw: number; value: number }[] = [];

	for (const cand of cands) {
		const r = evalAst(cand.ast!, lookup);
		if (!r.ok) {
			issues.push({ modifierId: cand.mod.id, kind: 'math', message: r.error });
			continue;
		}
		const value = cand.factor !== undefined ? applyRounding(r.value * cand.factor, 'floor') : r.value;
		evaluated.push({ cand, raw: r.value, value });
	}

	const stage = (s: Stage) => evaluated.filter((e) => STAGE_OF[e.cand.mod.op] === s);
	let v = base;

	// Setzen: höchster Wert gilt, mehrere aktive = Konflikt.
	const sets = stage('set');
	let conflict: FieldResult['conflict'];
	if (sets.length) {
		let winner = sets[0];
		for (const e of sets) if (e.value > winner.value) winner = e;
		// Gewinner zuerst, die unterlegenen danach ohne Wirkung.
		for (const e of [winner, ...sets.filter((x) => x !== winner)]) {
			const isWinner = e === winner;
			steps.push({
				modifierId: e.cand.mod.id,
				op: 'set',
				stage: 'set',
				value: e.value,
				rawValue: e.raw,
				factor: e.cand.factor,
				before: isWinner ? v : winner.value,
				after: winner.value,
				refs: e.cand.refs,
				overridden: !isWinner || undefined
			});
		}
		v = winner.value;
		if (sets.length > 1) {
			conflict = { modifierIds: sets.map((e) => e.cand.mod.id), winnerId: winner.cand.mod.id };
		}
	}

	for (const e of stage('add')) {
		const before = v;
		v = before + e.value;
		steps.push({
			modifierId: e.cand.mod.id,
			op: 'add',
			stage: 'add',
			value: e.value,
			rawValue: e.raw,
			factor: e.cand.factor,
			before,
			after: v,
			refs: e.cand.refs
		});
	}

	for (const e of stage('mul')) {
		const op = e.cand.mod.op;
		if (op === 'divide' && e.value === 0) {
			issues.push({ modifierId: e.cand.mod.id, kind: 'math', message: 'Division durch 0' });
			continue;
		}
		const before = v;
		v = applyRounding(op === 'multiply' ? before * e.value : before / e.value, e.cand.mod.rounding);
		steps.push({
			modifierId: e.cand.mod.id,
			op,
			stage: 'mul',
			value: e.value,
			rawValue: e.raw,
			factor: e.cand.factor,
			before,
			after: v,
			refs: e.cand.refs
		});
	}

	return {
		fieldId: field.id,
		kind: 'number',
		base,
		value: cleanNumber(v),
		steps,
		inactive,
		issues,
		conflict,
		deps,
		fingerprint
	};
}

/** Glättet Fließkomma-Artefakte (0.1 + 0.2). */
function cleanNumber(v: number): number {
	return Math.round(v * 1e9) / 1e9;
}

function evaluateDiceField(
	field: Field,
	cands: Candidate[],
	inactive: InactiveEntry[],
	knownIssues: Issue[],
	deps: Id[],
	fingerprint: string,
	lookup: DiceLookup
): FieldResult {
	const issues = [...knownIssues];
	const steps: Step[] = [];
	let baseNote: string | undefined;
	let v: DiceValue = emptyDice();
	const baseParse = parseDiceExpr(field.diceBase?.trim() || '0');
	if (baseParse.ok && !baseParse.refs.length) {
		const r = evalDiceTerms(baseParse.terms, () => undefined);
		if (r.ok) v = r.value;
	} else {
		baseNote = 'Basiswert ungültig – nur Würfel und Zahlen, z. B. „1d8“';
	}

	const evaluated: { cand: Candidate; value: DiceValue }[] = [];
	for (const cand of cands) {
		const r = evalDiceTerms(cand.dice!, lookup);
		if (!r.ok) issues.push({ modifierId: cand.mod.id, kind: 'math', message: r.error });
		else evaluated.push({ cand, value: r.value });
	}

	const sets = evaluated.filter((e) => e.cand.mod.op === 'set');
	let conflict: FieldResult['conflict'];
	if (sets.length) {
		let winner = sets[0];
		for (const e of sets) if (average(e.value) > average(winner.value)) winner = e;
		const before = formatDice(v);
		v = { dice: { ...winner.value.dice }, flat: winner.value.flat };
		for (const e of [winner, ...sets.filter((x) => x !== winner)]) {
			const isWinner = e === winner;
			steps.push({
				modifierId: e.cand.mod.id,
				op: 'set',
				stage: 'set',
				value: average(e.value),
				rawValue: average(e.value),
				before: 0,
				after: 0,
				refs: e.cand.refs,
				text: formatDice(e.value),
				beforeText: isWinner ? before : formatDice(v),
				afterText: formatDice(v),
				overridden: !isWinner || undefined
			});
		}
		if (sets.length > 1) conflict = { modifierIds: sets.map((e) => e.cand.mod.id), winnerId: winner.cand.mod.id };
	}
	for (const e of evaluated.filter((x) => x.cand.mod.op === 'add')) {
		const beforeText = formatDice(v);
		v = addDice({ dice: { ...v.dice }, flat: v.flat }, e.value);
		const text = formatDice(e.value);
		steps.push({
			modifierId: e.cand.mod.id,
			op: 'add',
			stage: 'add',
			value: average(e.value),
			rawValue: average(e.value),
			before: 0,
			after: 0,
			refs: e.cand.refs,
			text: /^[−-]/.test(text) ? text : `+ ${text}`,
			beforeText,
			afterText: formatDice(v)
		});
	}
	const final = { dice: { ...v.dice }, flat: Math.round(v.flat * 1e9) / 1e9 };
	for (const [s, n] of Object.entries(final.dice)) if (n === 0) delete final.dice[Number(s)];
	return {
		fieldId: field.id,
		kind: 'dice',
		base: 0,
		baseNote,
		text: formatDice(final),
		dice: final,
		value: average(final),
		steps,
		inactive,
		issues,
		conflict,
		deps,
		fingerprint
	};
}

function evaluateListField(field: Field, cands: Candidate[], inactive: InactiveEntry[], issues: Issue[], fingerprint: string): FieldResult {
	const steps: Step[] = [];
	let list = [...(field.listBase ?? [])];
	const fmt = (l: string[]) => (l.length ? l.join(', ') : '—');
	const sets = cands.filter((x) => x.mod.op === 'set');
	let conflict: FieldResult['conflict'];
	if (sets.length) {
		// Bei Listen gibt es kein „höher“: der erste Setzen-Modifikator gilt.
		const before = fmt(list);
		list = [...sets[0].list!];
		sets.forEach((e, i) =>
			steps.push({
				modifierId: e.mod.id,
				op: 'set',
				stage: 'set',
				value: e.list!.length,
				rawValue: e.list!.length,
				before: 0,
				after: 0,
				refs: [],
				text: fmt(e.list!),
				beforeText: i === 0 ? before : fmt(list),
				afterText: fmt(list),
				overridden: i > 0 || undefined
			})
		);
		if (sets.length > 1) conflict = { modifierIds: sets.map((e) => e.mod.id), winnerId: sets[0].mod.id };
	}
	for (const e of cands.filter((x) => x.mod.op === 'add')) {
		const beforeText = fmt(list);
		for (const entry of e.list!) if (!list.some((x) => x.toLowerCase() === entry.toLowerCase())) list.push(entry);
		steps.push({
			modifierId: e.mod.id,
			op: 'add',
			stage: 'add',
			value: e.list!.length,
			rawValue: e.list!.length,
			before: 0,
			after: 0,
			refs: [],
			text: `+ ${fmt(e.list!)}`,
			beforeText,
			afterText: fmt(list)
		});
	}
	return {
		fieldId: field.id,
		kind: 'list',
		base: 0,
		text: list.join(', '),
		list,
		value: list.length,
		steps,
		inactive,
		issues,
		conflict,
		deps: [],
		fingerprint
	};
}

// ---------------------------------------------------------------------------
// Graph-Hilfen

function stronglyConnected(nodes: Id[], edges: Map<Id, Set<Id>>): Map<Id, number> {
	let index = 0;
	let compCount = 0;
	const idx = new Map<Id, number>();
	const low = new Map<Id, number>();
	const onStack = new Set<Id>();
	const stack: Id[] = [];
	const comp = new Map<Id, number>();

	// Iterativ, damit lange Referenzketten keinen Stack-Overflow auslösen.
	for (const start of nodes) {
		if (idx.has(start)) continue;
		const work: { node: Id; iter: Iterator<Id> }[] = [];
		const visit = (n: Id) => {
			idx.set(n, index);
			low.set(n, index);
			index++;
			stack.push(n);
			onStack.add(n);
			work.push({ node: n, iter: (edges.get(n) ?? new Set<Id>()).values() });
		};
		visit(start);
		while (work.length) {
			const top = work[work.length - 1];
			const next = top.iter.next();
			if (!next.done) {
				const w = next.value;
				if (!edges.has(w)) continue;
				if (!idx.has(w)) visit(w);
				else if (onStack.has(w)) low.set(top.node, Math.min(low.get(top.node)!, idx.get(w)!));
				continue;
			}
			work.pop();
			if (work.length) {
				const parent = work[work.length - 1].node;
				low.set(parent, Math.min(low.get(parent)!, low.get(top.node)!));
			}
			if (low.get(top.node) === idx.get(top.node)) {
				let w: Id;
				do {
					w = stack.pop()!;
					onStack.delete(w);
					comp.set(w, compCount);
				} while (w !== top.node);
				compCount++;
			}
		}
	}
	return comp;
}

/** Kürzester Pfad from → to innerhalb derselben starken Zusammenhangskomponente. */
function findPath(from: Id, to: Id, edges: Map<Id, Set<Id>>, sccOf: Map<Id, number>): Id[] | null {
	const comp = sccOf.get(from);
	const prev = new Map<Id, Id | null>([[from, null]]);
	const queue = [from];
	while (queue.length) {
		const n = queue.shift()!;
		if (n === to) {
			const path: Id[] = [];
			for (let x: Id | null = n; x !== null; x = prev.get(x) ?? null) path.unshift(x);
			return path;
		}
		for (const w of edges.get(n) ?? []) {
			if (prev.has(w) || sccOf.get(w) !== comp) continue;
			prev.set(w, n);
			queue.push(w);
		}
	}
	return null;
}

function topoOrder(nodes: Id[], deps: Map<Id, Id[]>): Id[] {
	const result: Id[] = [];
	const state = new Map<Id, 1 | 2>();
	for (const start of nodes) {
		if (state.has(start)) continue;
		const work: { node: Id; i: number }[] = [{ node: start, i: 0 }];
		state.set(start, 1);
		while (work.length) {
			const top = work[work.length - 1];
			const list = deps.get(top.node) ?? [];
			if (top.i < list.length) {
				const d = list[top.i++];
				if (!state.has(d) && deps.has(d)) {
					state.set(d, 1);
					work.push({ node: d, i: 0 });
				}
				continue;
			}
			state.set(top.node, 2);
			result.push(top.node);
			work.pop();
		}
	}
	return result;
}
