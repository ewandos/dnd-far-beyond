// Aktionsübersicht: sammelt Aktionen, Bonusaktionen, Reaktionen und Sonstiges aus freien
// Einträgen, Items, Fähigkeiten und Zaubern und löst Angriff, Schaden und SG auf.
// Keine Regeln: Werte stehen nur da, wo der Spieler eine Formel eingetragen hat.

import { evalDiceTerms, formatDice, parseDiceExpr } from './dice';
import type { Evaluation } from './evaluate';
import { evalAst, parseExpr } from './formula';
import type { ActionKind, ActionStats, Character, Id } from './types';

export const ACTION_KINDS: ActionKind[] = ['action', 'bonus', 'reaction', 'other'];

export const ACTION_KIND_LABEL: Record<ActionKind, string> = {
	action: 'Aktionen',
	bonus: 'Bonusaktionen',
	reaction: 'Reaktionen',
	other: 'Sonstiges'
};

export const ACTION_KIND_SINGULAR: Record<ActionKind, string> = {
	action: 'Aktion',
	bonus: 'Bonusaktion',
	reaction: 'Reaktion',
	other: 'Sonstiges'
};

/** Leitet die Art aus dem Zeitaufwand eines Zaubers ab („1 Aktion“, „1 bonus action“, „1 Reaktion …“). */
export function economyFromCastingTime(text: string | undefined): ActionKind {
	const t = (text ?? '').toLowerCase();
	if (/bonus/.test(t)) return 'bonus';
	if (/reakt|reaction/.test(t)) return 'reaction';
	if (/^\s*1\s*(aktion|action)\b/.test(t) || /^\s*(aktion|action)\b/.test(t)) return 'action';
	return 'other';
}

export interface ResolvedValue {
	text: string;
	error?: string;
}

export interface ActionView {
	/** Eindeutiger Schlüssel: Aktions-ID bzw. „spell:<id>“. */
	key: string;
	kind: ActionKind;
	name: string;
	/** Wo die Aktion herkommt. */
	origin: { kind: 'action' | 'item' | 'ability' | 'spell'; id: Id; name?: string };
	/** ID der Aktion (bei Zaubern undefined). */
	actionId?: Id;
	spellId?: Id;
	spellLevel?: number;
	active: boolean;
	inactiveReason?: string;
	standard: boolean;
	attack?: ResolvedValue;
	damage?: ResolvedValue;
	damageType?: string;
	save?: ResolvedValue;
	range?: string;
	trigger?: string;
	counterId?: Id;
	description: string;
	concentration?: boolean;
}

type Lookup = (id: Id) => number | undefined;

function numberLookup(c: Character, ev: Evaluation): Lookup {
	return (id) => {
		const f = c.fields[id];
		if (!f || (f.type ?? 'number') !== 'number') return undefined;
		return ev.fields[id]?.value;
	};
}

function resolveNumber(expr: string | undefined, lookup: Lookup): { value?: number; error?: string } | undefined {
	if (!expr?.trim()) return undefined;
	const p = parseExpr(expr);
	if (!p.ok) return { error: p.error };
	const r = evalAst(p.ast, lookup);
	return r.ok ? { value: r.value } : { error: r.error };
}

const signed = (v: number) => (v < 0 ? `−${Math.abs(v)}` : `+${v}`).replace('.', ',');

export function resolveStats(c: Character, ev: Evaluation, s: ActionStats) {
	const lookup = numberLookup(c, ev);
	const out: Pick<ActionView, 'attack' | 'damage' | 'save' | 'damageType'> = {};

	const atk = resolveNumber(s.attack, lookup);
	if (atk) out.attack = atk.error ? { text: '?', error: atk.error } : { text: signed(atk.value!) };

	if (s.damage?.trim()) {
		const d = parseDiceExpr(s.damage);
		if (!d.ok) out.damage = { text: '?', error: d.error };
		else {
			const r = evalDiceTerms(d.terms, (id) => {
				const f = c.fields[id];
				const res = ev.fields[id];
				if (!f || !res) return undefined;
				if (res.kind === 'dice') return { kind: 'dice', value: res.dice ?? { dice: {}, flat: 0 } };
				if (res.kind === 'number') return { kind: 'number', value: res.value };
				return undefined;
			});
			out.damage = r.ok ? { text: formatDice(r.value) } : { text: '?', error: r.error };
		}
	}
	if (s.damageType?.trim()) out.damageType = s.damageType.trim();

	const dc = resolveNumber(s.saveDc, lookup);
	const ability = s.saveAbility?.trim();
	if (dc) out.save = dc.error ? { text: '?', error: dc.error } : { text: `SG ${String(dc.value).replace('.', ',')}${ability ? ` ${ability}` : ''}` };
	else if (ability) out.save = { text: `RW ${ability}` };
	return out;
}

export interface CollectOptions {
	/** Zauber aus diesen Listen aufnehmen. */
	spellListIds?: Id[];
}

/** Alle Einträge der Aktionsübersicht, sortiert nach Art und Reihenfolge. */
export function collectActions(c: Character, ev: Evaluation, opts: CollectOptions = {}): ActionView[] {
	const views: ActionView[] = [];
	const actions = Object.values(c.actions ?? {}).sort((a, b) => a.order - b.order || a.name.localeCompare(b.name, 'de'));
	for (const a of actions) {
		let active = true;
		let inactiveReason: string | undefined;
		let origin: ActionView['origin'] = { kind: 'action', id: a.id };
		if (a.source?.kind === 'item') {
			const item = c.items[a.source.id];
			const container = item ? c.containers[item.containerId] : undefined;
			origin = { kind: 'item', id: a.source.id, name: item?.name };
			if (!item) [active, inactiveReason] = [false, 'Quelle fehlt'];
			else if (!container?.equipped) [active, inactiveReason] = [false, container ? `nicht ausgerüstet (in „${container.name}“)` : 'nicht ausgerüstet'];
		} else if (a.source?.kind === 'ability') {
			const ab = c.abilities[a.source.id];
			origin = { kind: 'ability', id: a.source.id, name: ab?.name };
			if (!ab) [active, inactiveReason] = [false, 'Quelle fehlt'];
			else if (!ab.active) [active, inactiveReason] = [false, ab.kind === 'condition' ? 'Zustand aus' : 'Fähigkeit aus'];
		}
		views.push({
			key: a.id,
			kind: a.kind,
			name: a.name,
			origin,
			actionId: a.id,
			active,
			inactiveReason,
			standard: !!a.standard,
			...resolveStats(c, ev, a),
			range: a.range,
			trigger: a.trigger,
			counterId: a.counterId,
			description: a.description
		});
	}

	const seen = new Set<Id>();
	for (const listId of opts.spellListIds ?? []) {
		const list = c.spellLists[listId];
		if (!list) continue;
		for (const spellId of list.spellIds) {
			const s = c.spells[spellId];
			if (!s || seen.has(spellId) || s.economy === 'none') continue;
			seen.add(spellId);
			views.push({
				key: `spell:${s.id}`,
				kind: s.economy ?? economyFromCastingTime(s.castingTime),
				name: s.name,
				origin: { kind: 'spell', id: s.id, name: list.name },
				spellId: s.id,
				spellLevel: s.level,
				active: true,
				standard: false,
				...resolveStats(c, ev, s.stats ?? {}),
				range: s.range,
				description: s.description,
				concentration: s.concentration
			});
		}
	}

	const rank = (v: ActionView) => ACTION_KINDS.indexOf(v.kind);
	return views
		.map((v, i) => ({ v, i }))
		.sort((a, b) => rank(a.v) - rank(b.v) || Number(a.v.standard) - Number(b.v.standard) || a.i - b.i)
		.map((x) => x.v);
}
