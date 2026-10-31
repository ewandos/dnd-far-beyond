// Würfelausdrücke wie „1d8 + @STR-Mod + 1W6“. Summen aus Würfeln und Zahlen; jeder Summand,
// der kein Würfel ist, wird mit dem normalen Formelparser ausgewertet. Würfeln tut die App nie.

import { evalAst, parseExpr, type Node } from './formula';
import type { Id } from './types';

export interface DiceValue {
	/** Seitenzahl → Anzahl Würfel (negativ möglich, z. B. „− 1d4“). */
	dice: Record<number, number>;
	flat: number;
}

type Term =
	| { sign: 1 | -1; kind: 'dice'; count: number; sides: number }
	| { sign: 1 | -1; kind: 'ref'; id: Id }
	| { sign: 1 | -1; kind: 'num'; ast: Node; refs: Id[] };

export type DiceParse = { ok: true; terms: Term[]; refs: Id[] } | { ok: false; error: string };

const DIE = /^(\d*)\s*[dDwW]\s*(\d+)$/;

/** Zerlegt an „+“ und „−“ auf oberster Ebene (nicht in Klammern oder Referenzen). */
function splitTerms(src: string): { sign: 1 | -1; text: string }[] | null {
	const out: { sign: 1 | -1; text: string }[] = [];
	let depth = 0;
	let inRef: string | null = null;
	let sign: 1 | -1 = 1;
	let buf = '';
	for (let i = 0; i < src.length; i++) {
		const c = src[i];
		if (inRef) {
			buf += c;
			if (c === inRef) inRef = null;
			continue;
		}
		if (c === '@' && (src[i + 1] === '[' || src[i + 1] === '{')) {
			inRef = src[i + 1] === '[' ? ']' : '}';
			buf += c;
			continue;
		}
		if (c === '(') depth++;
		if (c === ')') depth--;
		if (depth < 0) return null;
		const isPlus = c === '+';
		const isMinus = c === '-' || c === '−' || c === '–';
		if (depth === 0 && (isPlus || isMinus)) {
			if (buf.trim()) {
				out.push({ sign, text: buf.trim() });
				buf = '';
				sign = 1;
			}
			if (isMinus) sign = sign === 1 ? -1 : 1;
			continue;
		}
		buf += c;
	}
	if (depth !== 0) return null;
	if (buf.trim()) out.push({ sign, text: buf.trim() });
	else if (out.length || src.trim()) return null; // endet mit Operator
	return out;
}

const cache = new Map<string, DiceParse>();

export function parseDiceExpr(expr: string): DiceParse {
	const hit = cache.get(expr);
	if (hit) return hit;
	let result: DiceParse;
	const parts = splitTerms(expr);
	if (!parts || !parts.length) {
		result = { ok: false, error: parts ? 'Leerer Ausdruck' : 'Ausdruck ist unvollständig' };
	} else {
		const terms: Term[] = [];
		const refs = new Set<Id>();
		let error = '';
		for (const p of parts) {
			const die = DIE.exec(p.text);
			if (die) {
				const sides = Number(die[2]);
				if (sides < 1) {
					error = `Ungültiger Würfel „${p.text}“`;
					break;
				}
				terms.push({ sign: p.sign, kind: 'dice', count: die[1] ? Number(die[1]) : 1, sides });
				continue;
			}
			const ref = /^@\[([^\]]+)\]$/.exec(p.text);
			if (ref) {
				terms.push({ sign: p.sign, kind: 'ref', id: ref[1].trim() });
				refs.add(ref[1].trim());
				continue;
			}
			const parsed = parseExpr(p.text);
			if (!parsed.ok) {
				error = /(^|[^\p{L}])\d*\s*[dDwW]\s*\d/u.test(p.text) ? `Würfel nur als Summand, z. B. „2d6 + 3“` : parsed.error;
				break;
			}
			for (const r of parsed.refs) refs.add(r);
			terms.push({ sign: p.sign, kind: 'num', ast: parsed.ast, refs: parsed.refs });
		}
		result = error ? { ok: false, error } : { ok: true, terms, refs: [...refs] };
	}
	if (cache.size > 2000) cache.clear();
	cache.set(expr, result);
	return result;
}

export type DiceLookup = (id: Id) => { kind: 'number'; value: number } | { kind: 'dice'; value: DiceValue } | undefined;

export function evalDiceTerms(terms: Term[], lookup: DiceLookup): { ok: true; value: DiceValue } | { ok: false; error: string } {
	const v: DiceValue = { dice: {}, flat: 0 };
	for (const t of terms) {
		if (t.kind === 'dice') {
			v.dice[t.sides] = (v.dice[t.sides] ?? 0) + t.sign * t.count;
		} else if (t.kind === 'ref') {
			const r = lookup(t.id);
			if (!r) return { ok: false, error: 'Referenz auf unbekanntes Feld' };
			if (r.kind === 'number') v.flat += t.sign * r.value;
			else addDice(v, r.value, t.sign);
		} else {
			const r = evalAst(t.ast, (id) => {
				const x = lookup(id);
				return x?.kind === 'number' ? x.value : undefined;
			});
			if (!r.ok) {
				const diceRef = t.refs.find((id) => lookup(id)?.kind === 'dice');
				return { ok: false, error: diceRef ? 'Würfelfelder nur als eigener Summand verwenden' : r.error };
			}
			v.flat += t.sign * r.value;
		}
	}
	return { ok: true, value: normalize(v) };
}

/** Addiert b (mit Vorzeichen) zu a und gibt a zurück. */
export function addDice(a: DiceValue, b: DiceValue, sign: 1 | -1 = 1): DiceValue {
	for (const [s, n] of Object.entries(b.dice)) a.dice[Number(s)] = (a.dice[Number(s)] ?? 0) + sign * n;
	a.flat += sign * b.flat;
	return a;
}

export function normalize(v: DiceValue): DiceValue {
	const dice: Record<number, number> = {};
	for (const [s, n] of Object.entries(v.dice)) if (n !== 0) dice[Number(s)] = n;
	return { dice, flat: Math.round(v.flat * 1e9) / 1e9 };
}

export const emptyDice = (): DiceValue => ({ dice: {}, flat: 0 });

/** Durchschnitt – nur zum Vergleichen bei mehreren Setzen-Modifikatoren. */
export function average(v: DiceValue): number {
	return Object.entries(v.dice).reduce((sum, [s, n]) => sum + n * ((Number(s) + 1) / 2), v.flat);
}

export function formatDice(v: DiceValue): string {
	const parts: string[] = [];
	const sides = Object.keys(v.dice)
		.map(Number)
		.sort((a, b) => b - a);
	for (const s of sides) {
		const n = v.dice[s];
		parts.push(`${parts.length ? (n < 0 ? '− ' : '+ ') : n < 0 ? '−' : ''}${Math.abs(n)}d${s}`);
	}
	const f = v.flat;
	if (f !== 0 || !parts.length) {
		const num = String(Math.abs(f)).replace('.', ',');
		parts.push(parts.length ? `${f < 0 ? '− ' : '+ '}${num}` : `${f < 0 ? '−' : ''}${num}`);
	}
	return parts.join(' ');
}

/** Einträge einer Liste: getrennt durch Komma, Semikolon oder Zeilenumbruch. */
export function parseListText(text: string): string[] {
	return text
		.split(/[,;\n]/)
		.map((s) => s.trim())
		.filter(Boolean);
}
