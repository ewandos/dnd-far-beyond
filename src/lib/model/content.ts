// Austauschformat für einzelne Inhalte (Items, Fähigkeiten, Zustände, Zauber).
// Das Format ist das interne Datenmodell – kein 5eTools. Import erzeugt immer Kopien mit neuer ID.

import type { Ability, Character, Counter, Id, Item, Modifier, Spell } from '../engine/types';
import { parseExpr } from '../engine/formula';

export const CONTENT_FILE_KIND = 'dnd-charakterbogen/content';
export const CONTENT_SCHEMA_VERSION = 1;

export type ContentEntry =
	| {
			type: 'item';
			item: Omit<Item, 'containerId' | 'order'>;
			modifiers: Modifier[];
			counter?: Counter;
			/** Namen der Felder, auf die Modifikatoren zielen oder verweisen – zur Orientierung beim Zuordnen. */
			fieldNames: Record<Id, string>;
	  }
	| {
			type: 'ability';
			ability: Omit<Ability, 'order'>;
			modifiers: Modifier[];
			counter?: Counter;
			fieldNames: Record<Id, string>;
	  }
	| { type: 'spell'; spell: Spell };

export interface ContentFile {
	kind: typeof CONTENT_FILE_KIND;
	schemaVersion: number;
	exportedAt: string;
	entries: ContentEntry[];
}

export type ContentRef = { type: 'item' | 'ability' | 'spell'; id: Id };

export function entryName(e: ContentEntry): string {
	return e.type === 'item' ? e.item.name : e.type === 'ability' ? e.ability.name : e.spell.name;
}

export function entryLabel(e: ContentEntry): string {
	if (e.type === 'item') return 'Item';
	if (e.type === 'spell') return 'Zauber';
	return e.ability.kind === 'condition' ? 'Zustand' : e.ability.origin === 'Talent' ? 'Talent' : 'Fähigkeit';
}

const clone = <T>(v: T): T => JSON.parse(JSON.stringify(v)) as T;

// ---------------------------------------------------------------------------
// Export

function modifiersOf(c: Character, kind: 'item' | 'ability', id: Id): Modifier[] {
	return Object.values(c.modifiers)
		.filter((m) => m.source.kind === kind && m.source.id === id)
		.sort((a, b) => a.order - b.order)
		.map(clone);
}

function namesFor(c: Character, mods: Modifier[]): Record<Id, string> {
	const names: Record<Id, string> = {};
	for (const m of mods) {
		if (m.targetFieldId && c.fields[m.targetFieldId]) names[m.targetFieldId] = c.fields[m.targetFieldId].name;
		const p = parseExpr(m.expr);
		if (p.ok) for (const r of p.refs) if (c.fields[r]) names[r] = c.fields[r].name;
	}
	return names;
}

export function exportContent(c: Character, refs: ContentRef[]): ContentFile {
	const entries: ContentEntry[] = [];
	for (const ref of refs) {
		if (ref.type === 'item' && c.items[ref.id]) {
			const { containerId: _c, order: _o, ...item } = clone(c.items[ref.id]);
			const modifiers = modifiersOf(c, 'item', ref.id);
			const counter = item.counterId ? clone(c.counters[item.counterId]) : undefined;
			entries.push({ type: 'item', item, modifiers, ...(counter ? { counter } : {}), fieldNames: namesFor(c, modifiers) });
		} else if (ref.type === 'ability' && c.abilities[ref.id]) {
			const { order: _o, ...ability } = clone(c.abilities[ref.id]);
			const modifiers = modifiersOf(c, 'ability', ref.id);
			const counter = ability.counterId ? clone(c.counters[ability.counterId]) : undefined;
			entries.push({ type: 'ability', ability, modifiers, ...(counter ? { counter } : {}), fieldNames: namesFor(c, modifiers) });
		} else if (ref.type === 'spell' && c.spells[ref.id]) {
			entries.push({ type: 'spell', spell: clone(c.spells[ref.id]) });
		}
	}
	return { kind: CONTENT_FILE_KIND, schemaVersion: CONTENT_SCHEMA_VERSION, exportedAt: new Date().toISOString(), entries };
}

export function contentFileName(file: ContentFile): string {
	const base =
		file.entries.length === 1
			? entryName(file.entries[0])
			: `inhalte-${file.entries.length}`;
	const slug =
		base
			.normalize('NFKD')
			.replace(/[̀-ͯ]/g, '')
			.replace(/ß/g, 'ss')
			.replace(/[^a-zA-Z0-9]+/g, '-')
			.replace(/^-|-$/g, '')
			.toLowerCase() || 'inhalt';
	return `${slug}.json`;
}

// ---------------------------------------------------------------------------
// Einlesen

export class ContentError extends Error {}

/** Prüft grob die Struktur und verwirft unbrauchbare Einträge, statt abzustürzen. */
export function readContentFile(data: unknown): ContentEntry[] {
	const raw = data as Partial<ContentFile> | null;
	if (!raw || raw.kind !== CONTENT_FILE_KIND || !Array.isArray(raw.entries)) {
		throw new ContentError('Keine Inhalts-Datei dieser App.');
	}
	if ((raw.schemaVersion ?? 1) > CONTENT_SCHEMA_VERSION) {
		throw new ContentError('Die Datei stammt aus einer neueren App-Version. Bitte die App aktualisieren.');
	}
	const out: ContentEntry[] = [];
	for (const e of raw.entries as ContentEntry[]) {
		if (!e || typeof e !== 'object') continue;
		if (e.type === 'item' && e.item && typeof e.item.name === 'string') {
			out.push({ ...e, modifiers: Array.isArray(e.modifiers) ? e.modifiers : [], fieldNames: e.fieldNames ?? {} });
		} else if (e.type === 'ability' && e.ability && typeof e.ability.name === 'string') {
			out.push({ ...e, modifiers: Array.isArray(e.modifiers) ? e.modifiers : [], fieldNames: e.fieldNames ?? {} });
		} else if (e.type === 'spell' && e.spell && typeof e.spell.name === 'string') {
			out.push({ ...e, spell: { ...e.spell, tags: Array.isArray(e.spell.tags) ? e.spell.tags : [], description: e.spell.description ?? '' } });
		}
	}
	return out;
}

// ---------------------------------------------------------------------------
// Import-Plan

export interface ImportOptions {
	/** Ziel-Container für Items. */
	containerId: Id;
	/** Optional: Zauberliste, in die importierte Zauber kommen. */
	spellListId?: Id;
}

export interface ImportPlan {
	items: Item[];
	abilities: Ability[];
	spells: Spell[];
	modifiers: Modifier[];
	counters: Counter[];
	/** Modifikatoren ohne passendes Zielfeld beim Spieler. */
	unassigned: number;
}

const nextOrder = (rec: Record<string, { order: number }>) => Object.values(rec).reduce((m, x) => Math.max(m, x.order), -1) + 1;

/**
 * Baut aus Einträgen neue Objekte mit neuen IDs. Standardfelder haben bei allen Spielern dieselbe ID
 * und werden automatisch getroffen; fehlende Zielfelder werden „nicht zugeordnet“.
 * Die App legt dabei nie selbst Felder an.
 */
export function planImport(c: Character, entries: ContentEntry[], opts: ImportOptions, newId: () => Id): ImportPlan {
	const plan: ImportPlan = { items: [], abilities: [], spells: [], modifiers: [], counters: [], unassigned: 0 };
	let itemOrder = nextOrder(c.items);
	let abilityOrder = nextOrder(c.abilities);
	let modOrder = nextOrder(c.modifiers);
	let counterOrder = nextOrder(c.counters);

	const copyCounter = (counter: Counter | undefined): Id | undefined => {
		if (!counter) return undefined;
		const id = newId();
		plan.counters.push({ ...clone(counter), id, checked: 0, order: counterOrder++ });
		return id;
	};

	const copyModifiers = (mods: Modifier[], source: Modifier['source'], fieldNames: Record<Id, string>) => {
		for (const m of mods) {
			const exists = !!m.targetFieldId && !!c.fields[m.targetFieldId];
			const copy: Modifier = {
				id: newId(),
				targetFieldId: exists ? m.targetFieldId : null,
				op: m.op,
				expr: String(m.expr ?? '0'),
				description: m.description ?? '',
				source,
				order: modOrder++,
				...(m.rounding ? { rounding: m.rounding } : {})
			};
			if (!exists) {
				plan.unassigned++;
				const hint = (m.targetFieldId && fieldNames[m.targetFieldId]) || m.importHint;
				if (hint) copy.importHint = hint;
			}
			plan.modifiers.push(copy);
		}
	};

	for (const e of entries) {
		if (e.type === 'item') {
			const id = newId();
			const counterId = copyCounter(e.counter);
			const { counterId: _old, ...rest } = clone(e.item);
			plan.items.push({
				...rest,
				id,
				originId: e.item.originId ?? e.item.id,
				description: rest.description ?? '',
				quantity: Number.isFinite(rest.quantity) ? rest.quantity : 1,
				requiresAttunement: !!rest.requiresAttunement,
				containerId: opts.containerId,
				order: itemOrder++,
				...(counterId ? { counterId } : {})
			});
			copyModifiers(e.modifiers, { kind: 'item', id }, e.fieldNames);
		} else if (e.type === 'ability') {
			const id = newId();
			const counterId = copyCounter(e.counter);
			const { counterId: _old, ...rest } = clone(e.ability);
			plan.abilities.push({
				...rest,
				id,
				originId: e.ability.originId ?? e.ability.id,
				kind: rest.kind === 'condition' ? 'condition' : 'ability',
				description: rest.description ?? '',
				active: rest.active ?? true,
				order: abilityOrder++,
				...(counterId ? { counterId } : {})
			});
			copyModifiers(e.modifiers, { kind: 'ability', id }, e.fieldNames);
		} else {
			plan.spells.push({ ...clone(e.spell), id: newId(), originId: e.spell.originId ?? e.spell.id });
		}
	}
	return plan;
}
