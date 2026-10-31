import type { Character, Field } from '$lib/engine/types';
import { GROUPS } from '$lib/model/defaults';

export interface FieldGroup {
	name: string;
	fields: Field[];
}

const GROUP_ORDER: string[] = Object.values(GROUPS);

export function sortedFields(c: Character, opts: { includeHidden?: boolean; group?: string } = {}): Field[] {
	return Object.values(c.fields)
		.filter((f) => (opts.includeHidden || !f.hidden) && (opts.group === undefined || (f.group ?? GROUPS.custom) === opts.group))
		.sort((a, b) => a.order - b.order || a.name.localeCompare(b.name, 'de'));
}

/** Felder nach Gruppe, Standardgruppen in fester Reihenfolge, eigene Gruppen danach alphabetisch. */
export function groupedFields(c: Character, opts: { includeHidden?: boolean } = {}): FieldGroup[] {
	const map = new Map<string, Field[]>();
	for (const f of sortedFields(c, opts)) {
		const g = f.group?.trim() || GROUPS.custom;
		const list = map.get(g);
		if (list) list.push(f);
		else map.set(g, [f]);
	}
	// Standardgruppen in fester Reihenfolge, dann eigene Gruppen alphabetisch, „Eigene Felder“ zuletzt.
	const rank = (g: string) => (g === GROUPS.custom ? 1000 : GROUP_ORDER.includes(g) ? GROUP_ORDER.indexOf(g) : 500);
	return [...map.entries()]
		.sort(([a], [b]) => rank(a) - rank(b) || a.localeCompare(b, 'de'))
		.map(([name, fields]) => ({ name, fields }));
}

/** Alle Gruppennamen für die Auswahl beim Anlegen. */
export function groupNames(c: Character): string[] {
	const set = new Set<string>(GROUP_ORDER);
	for (const f of Object.values(c.fields)) if (f.group) set.add(f.group);
	return [...set];
}

/** Übungs-Quelle eines Feldes (falls vorhanden). */
export function proficiencyFor(c: Character, fieldId: string) {
	return Object.values(c.proficiencies).find((p) => p.fieldId === fieldId);
}

/** Felder, deren Modifikatoren auf `fieldId` verweisen. */
export function referencedBy(c: Character, fieldId: string, deps: Record<string, { deps: string[] }>): Field[] {
	return Object.values(c.fields)
		.filter((f) => deps[f.id]?.deps.includes(fieldId))
		.sort((a, b) => a.order - b.order);
}
