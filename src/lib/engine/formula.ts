// Kleiner Formelparser (Tokenizer + Pratt-Parser) für Modifikator-Ausdrücke.
//
// Gespeicherte Form:  13 + @[std.dex_mod]
// Anzeigeform:        13 + @GES-Mod     (bzw. @{Name mit Sonderzeichen})
//
// Erlaubt sind Zahlen, + − × /, Klammern, Referenzen und floor, ceil, round, min, max.

import type { Id } from './types';

export type Node =
	| { k: 'num'; v: number }
	| { k: 'ref'; id: Id }
	| { k: 'neg'; e: Node }
	| { k: 'bin'; op: '+' | '-' | '*' | '/'; l: Node; r: Node }
	| { k: 'call'; fn: FunctionName; args: Node[] };

export type FunctionName = 'floor' | 'ceil' | 'round' | 'min' | 'max';
const FUNCTIONS: Record<FunctionName, { min: number; max: number }> = {
	floor: { min: 1, max: 1 },
	ceil: { min: 1, max: 1 },
	round: { min: 1, max: 1 },
	min: { min: 1, max: Infinity },
	max: { min: 1, max: Infinity }
};

type Token =
	| { t: 'num'; v: number; pos: number }
	| { t: 'ref'; id: Id; pos: number }
	| { t: 'unresolved'; name: string; pos: number }
	| { t: 'op'; v: '+' | '-' | '*' | '/'; pos: number }
	| { t: 'lp'; pos: number }
	| { t: 'rp'; pos: number }
	| { t: 'comma'; pos: number }
	| { t: 'ident'; v: string; pos: number }
	| { t: 'end'; pos: number };

export type ParseResult =
	| { ok: true; ast: Node; refs: Id[] }
	| { ok: false; error: string; pos?: number };

export class FormulaError extends Error {
	constructor(
		message: string,
		public pos?: number
	) {
		super(message);
	}
}

const OP_CHARS: Record<string, '+' | '-' | '*' | '/'> = {
	'+': '+',
	'-': '-',
	'−': '-',
	'–': '-',
	'*': '*',
	'×': '*',
	'·': '*',
	'/': '/',
	':': '/',
	'÷': '/'
};

function tokenize(src: string): Token[] {
	const tokens: Token[] = [];
	let i = 0;
	while (i < src.length) {
		const c = src[i];
		if (/\s/.test(c)) {
			i++;
			continue;
		}
		if (/[0-9.]/.test(c)) {
			const m = /^(\d+(\.\d*)?|\.\d+)/.exec(src.slice(i));
			if (!m) throw new FormulaError(`Ungültige Zahl bei „${c}“`, i);
			tokens.push({ t: 'num', v: parseFloat(m[0]), pos: i });
			i += m[0].length;
			continue;
		}
		if (c === '@') {
			const open = src[i + 1];
			if (open === '[' || open === '{') {
				const close = open === '[' ? ']' : '}';
				const end = src.indexOf(close, i + 2);
				if (end < 0) throw new FormulaError('Referenz nicht geschlossen', i);
				const inner = src.slice(i + 2, end).trim();
				if (!inner) throw new FormulaError('Leere Referenz', i);
				if (open === '[') tokens.push({ t: 'ref', id: inner, pos: i });
				else tokens.push({ t: 'unresolved', name: inner, pos: i });
				i = end + 1;
				continue;
			}
			const m = /^[\p{L}\p{N}_-]+/u.exec(src.slice(i + 1));
			if (!m) throw new FormulaError('Feldname nach @ fehlt', i);
			tokens.push({ t: 'unresolved', name: m[0], pos: i });
			i += 1 + m[0].length;
			continue;
		}
		if (OP_CHARS[c]) {
			tokens.push({ t: 'op', v: OP_CHARS[c], pos: i });
			i++;
			continue;
		}
		if (c === '(') {
			tokens.push({ t: 'lp', pos: i });
			i++;
			continue;
		}
		if (c === ')') {
			tokens.push({ t: 'rp', pos: i });
			i++;
			continue;
		}
		if (c === ',' || c === ';') {
			tokens.push({ t: 'comma', pos: i });
			i++;
			continue;
		}
		const id = /^[\p{L}_][\p{L}\p{N}_]*/u.exec(src.slice(i));
		if (id) {
			tokens.push({ t: 'ident', v: id[0], pos: i });
			i += id[0].length;
			continue;
		}
		throw new FormulaError(`Unerwartetes Zeichen „${c}“`, i);
	}
	tokens.push({ t: 'end', pos: src.length });
	return tokens;
}

const BINARY_POWER: Record<string, number> = { '+': 10, '-': 10, '*': 20, '/': 20 };
const UNARY_POWER = 30;

class Parser {
	private i = 0;
	readonly refs = new Set<Id>();
	constructor(private tokens: Token[]) {}

	private peek(): Token {
		return this.tokens[this.i];
	}
	private next(): Token {
		return this.tokens[this.i++];
	}

	parse(): Node {
		const node = this.expr(0);
		const t = this.peek();
		if (t.t !== 'end') throw new FormulaError(describeUnexpected(t), t.pos);
		return node;
	}

	private expr(minPower: number): Node {
		let left = this.prefix();
		for (;;) {
			const t = this.peek();
			if (t.t !== 'op') break;
			const power = BINARY_POWER[t.v];
			if (power <= minPower) break;
			this.next();
			const right = this.expr(power);
			left = { k: 'bin', op: t.v, l: left, r: right };
		}
		return left;
	}

	private prefix(): Node {
		const t = this.next();
		switch (t.t) {
			case 'num':
				return { k: 'num', v: t.v };
			case 'ref':
				this.refs.add(t.id);
				return { k: 'ref', id: t.id };
			case 'unresolved':
				throw new FormulaError(`Unbekanntes Feld „${t.name}“`, t.pos);
			case 'op':
				if (t.v === '-') return { k: 'neg', e: this.expr(UNARY_POWER) };
				if (t.v === '+') return this.expr(UNARY_POWER);
				throw new FormulaError(`Unerwartetes „${t.v}“`, t.pos);
			case 'lp': {
				const inner = this.expr(0);
				const close = this.next();
				if (close.t !== 'rp') throw new FormulaError('„)“ fehlt', close.pos);
				return inner;
			}
			case 'ident': {
				const fn = t.v.toLowerCase();
				if (!(fn in FUNCTIONS)) throw new FormulaError(`Unbekannte Funktion „${t.v}“`, t.pos);
				const open = this.next();
				if (open.t !== 'lp') throw new FormulaError(`„(“ nach ${t.v} fehlt`, open.pos);
				const args: Node[] = [];
				if (this.peek().t !== 'rp') {
					args.push(this.expr(0));
					while (this.peek().t === 'comma') {
						this.next();
						args.push(this.expr(0));
					}
				}
				const close = this.next();
				if (close.t !== 'rp') throw new FormulaError('„)“ fehlt', close.pos);
				const spec = FUNCTIONS[fn as FunctionName];
				if (args.length < spec.min || args.length > spec.max)
					throw new FormulaError(`Falsche Anzahl Argumente für ${fn}`, t.pos);
				return { k: 'call', fn: fn as FunctionName, args };
			}
			default:
				throw new FormulaError(describeUnexpected(t), t.pos);
		}
	}
}

function describeUnexpected(t: Token): string {
	switch (t.t) {
		case 'end':
			return 'Formel ist unvollständig';
		case 'rp':
			return 'Unerwartete „)“';
		case 'comma':
			return 'Unerwartetes Komma';
		default:
			return 'Unerwartetes Zeichen';
	}
}

const parseCache = new Map<string, ParseResult>();

/** Parst einen gespeicherten Ausdruck. Ergebnisse werden gecacht; Fehler werfen nie. */
export function parseExpr(expr: string): ParseResult {
	const cached = parseCache.get(expr);
	if (cached) return cached;
	let result: ParseResult;
	try {
		if (!expr.trim()) throw new FormulaError('Leerer Ausdruck');
		const parser = new Parser(tokenize(expr));
		const ast = parser.parse();
		result = { ok: true, ast, refs: [...parser.refs] };
	} catch (e) {
		const err = e instanceof FormulaError ? e : new FormulaError(String(e));
		result = { ok: false, error: err.message, pos: err.pos };
	}
	if (parseCache.size > 5000) parseCache.clear();
	parseCache.set(expr, result);
	return result;
}

export type EvalResult = { ok: true; value: number } | { ok: false; error: string };

/** Wertet einen AST aus. `lookup` liefert den Endwert eines Feldes. */
export function evalAst(ast: Node, lookup: (id: Id) => number | undefined): EvalResult {
	try {
		const value = evalNode(ast, lookup);
		if (!Number.isFinite(value)) return { ok: false, error: 'Ergebnis ist keine endliche Zahl' };
		return { ok: true, value };
	} catch (e) {
		return { ok: false, error: e instanceof FormulaError ? e.message : String(e) };
	}
}

function evalNode(n: Node, lookup: (id: Id) => number | undefined): number {
	switch (n.k) {
		case 'num':
			return n.v;
		case 'ref': {
			const v = lookup(n.id);
			if (v === undefined) throw new FormulaError('Referenz auf unbekanntes Feld');
			return v;
		}
		case 'neg':
			return -evalNode(n.e, lookup);
		case 'bin': {
			const l = evalNode(n.l, lookup);
			const r = evalNode(n.r, lookup);
			switch (n.op) {
				case '+':
					return l + r;
				case '-':
					return l - r;
				case '*':
					return l * r;
				case '/':
					if (r === 0) throw new FormulaError('Division durch 0');
					return l / r;
			}
			break;
		}
		case 'call': {
			const args = n.args.map((a) => evalNode(a, lookup));
			switch (n.fn) {
				case 'floor':
					return Math.floor(args[0]);
				case 'ceil':
					return Math.ceil(args[0]);
				case 'round':
					return Math.round(args[0]);
				case 'min':
					return Math.min(...args);
				case 'max':
					return Math.max(...args);
			}
		}
	}
	throw new FormulaError('Ungültiger Ausdruck');
}

/** Bequemer Gesamtaufruf: parsen und auswerten. */
export function evaluateExpr(expr: string, lookup: (id: Id) => number | undefined): EvalResult {
	const p = parseExpr(expr);
	if (!p.ok) return { ok: false, error: p.error };
	return evalAst(p.ast, lookup);
}

// ---------------------------------------------------------------------------
// Umwandlung zwischen Anzeige- und Speicherform

export interface NamedField {
	id: Id;
	name: string;
}

const NAME_CHAR = /[\p{L}\p{N}_]/u;

/**
 * Sucht nach `@` den längsten Feldnamen, der an dieser Stelle steht.
 * Nach dem Namen darf kein Buchstabe/keine Ziffer folgen (sonst wäre es ein anderer Name).
 */
function matchName(text: string, start: number, fields: NamedField[]): NamedField | undefined {
	const rest = text.slice(start).toLowerCase();
	let best: NamedField | undefined;
	for (const f of fields) {
		const name = f.name.toLowerCase();
		if (!name || !rest.startsWith(name)) continue;
		const after = text[start + name.length];
		if (after !== undefined && NAME_CHAR.test(after)) continue;
		if (!best || name.length > best.name.length) best = f;
	}
	return best;
}

/** Anzeigeform → Speicherform. Unbekannte Namen bleiben als @{Name} stehen und werden beim Auswerten als Fehler markiert. */
export function toStoredExpr(text: string, fields: NamedField[]): string {
	let out = '';
	let i = 0;
	while (i < text.length) {
		const c = text[i];
		if (c !== '@') {
			out += c;
			i++;
			continue;
		}
		const open = text[i + 1];
		if (open === '[') {
			const end = text.indexOf(']', i);
			if (end < 0) {
				out += text.slice(i);
				break;
			}
			out += text.slice(i, end + 1);
			i = end + 1;
			continue;
		}
		if (open === '{') {
			const end = text.indexOf('}', i);
			if (end < 0) {
				out += text.slice(i);
				break;
			}
			const name = text.slice(i + 2, end).trim().toLowerCase();
			const f = fields.find((x) => x.name.trim().toLowerCase() === name);
			out += f ? `@[${f.id}]` : text.slice(i, end + 1);
			i = end + 1;
			continue;
		}
		const f = matchName(text, i + 1, fields);
		if (f) {
			out += `@[${f.id}]`;
			i += 1 + f.name.length;
			continue;
		}
		const m = /^[\p{L}\p{N}_-]+/u.exec(text.slice(i + 1));
		if (m) {
			out += `@{${m[0]}}`;
			i += 1 + m[0].length;
		} else {
			out += c;
			i++;
		}
	}
	return out;
}

/** Speicherform → Anzeigeform mit aktuellen Feldnamen. Gelöschte Felder bleiben als @[id] sichtbar. */
export function toDisplayExpr(expr: string, fields: NamedField[]): string {
	const byId = new Map(fields.map((f) => [f.id, f]));
	return expr.replace(/@\[([^\]]+)\]/g, (whole, id: string) => {
		const f = byId.get(id.trim());
		if (!f || /[{}]/.test(f.name)) return whole;
		return '@' + displayRefName(f, fields);
	});
}

/** Liefert `Name` oder `{Name}`, je nachdem ob der Name als @Name eindeutig zurückgelesen wird. */
export function displayRefName(f: NamedField, fields: NamedField[]): string {
	const probe = f.name + ' ';
	const simple = /^[\p{L}\p{N}_]/u.test(f.name) && !/[{}[\]@]/.test(f.name);
	if (simple && matchName(probe, 0, fields)?.id === f.id) return f.name;
	return `{${f.name}}`;
}

/** Ist der Ausdruck eine reine Zahl (ohne Referenzen)? Für kompakte Anzeige. */
export function isPlainNumber(expr: string): boolean {
	return /^\s*[-+−]?\s*(\d+(\.\d*)?|\.\d+)\s*$/.test(expr);
}
