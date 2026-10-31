// Änderungen als Pfad-Patches: Grundlage für Historie, Rückgängig und Wiederholen.

import type { HistoryEvent, Patch } from '../engine/types';

export const HISTORY_LIMIT = 2000;
/** Schnelle Folgeänderungen am selben Wert innerhalb dieses Fensters werden zusammengefasst. */
export const COALESCE_MS = 3000;

type Obj = Record<string, unknown>;

export function clone<T>(v: T): T {
	return v === undefined ? v : (JSON.parse(JSON.stringify(v)) as T);
}

export function readPath(root: unknown, path: string[]): unknown {
	let cur: unknown = root;
	for (const key of path) {
		if (cur === null || typeof cur !== 'object') return undefined;
		cur = (cur as Obj)[key];
	}
	return cur;
}

/** Schreibt einen Wert; `undefined` entfernt den Eintrag. Fehlende Zwischenobjekte werden angelegt. */
export function writePath(root: unknown, path: string[], value: unknown): void {
	let cur = root as Obj;
	for (let i = 0; i < path.length - 1; i++) {
		const key = path[i];
		if (cur[key] === null || typeof cur[key] !== 'object') {
			if (value === undefined) return;
			cur[key] = {};
		}
		cur = cur[key] as Obj;
	}
	const last = path[path.length - 1];
	if (value === undefined) {
		if (Array.isArray(cur)) cur.splice(Number(last), 1);
		else delete cur[last];
	} else {
		cur[last] = clone(value);
	}
}

export function applyForward(root: unknown, patches: Patch[]): void {
	for (const p of patches) writePath(root, p.path, p.after);
}

export function applyBackward(root: unknown, patches: Patch[]): void {
	for (let i = patches.length - 1; i >= 0; i--) writePath(root, patches[i].path, patches[i].before);
}

const samePaths = (a: Patch[], b: Patch[]) =>
	a.length === b.length && a.every((p, i) => p.path.join('\u0000') === b[i].path.join('\u0000'));

/**
 * Darf `next` mit dem letzten Ereignis zusammengefasst werden?
 * Gleiche Art, gleiches Ziel, gleiche Pfade und innerhalb des Zeitfensters.
 */
export function canCoalesce(last: HistoryEvent | undefined, next: HistoryEvent): last is HistoryEvent {
	if (!last) return false;
	if (last.kind !== next.kind || last.target !== next.target) return false;
	if (!samePaths(last.patches, next.patches)) return false;
	return Date.parse(next.at) - Date.parse(last.at) <= COALESCE_MS;
}

/** Fasst zusammen: ursprüngliches „vorher“ bleibt, „nachher“ und Zeitpunkt werden übernommen. */
export function coalesce(last: HistoryEvent, next: HistoryEvent): HistoryEvent {
	return {
		...last,
		at: next.at,
		title: next.title,
		after: next.after,
		patches: last.patches.map((p, i) => ({ path: p.path, before: p.before, after: next.patches[i].after }))
	};
}

/** Hat das Ereignis überhaupt eine Wirkung? (z. B. Rückkehr zum Ausgangswert nach Zusammenfassen) */
export function isNoop(e: HistoryEvent): boolean {
	return e.patches.every((p) => JSON.stringify(p.before) === JSON.stringify(p.after));
}
