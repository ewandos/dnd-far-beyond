import { describe, expect, it } from 'vitest';
import type { HistoryEvent } from '../engine/types';
import { applyBackward, applyForward, canCoalesce, coalesce, isNoop, readPath, writePath } from './history';

const ev = (at: number, before: unknown, after: unknown, target = 'std.hp_current'): HistoryEvent => ({
	id: String(at),
	at: new Date(at).toISOString(),
	kind: 'field.base',
	target,
	title: 'TP aktuell',
	before,
	after,
	patches: [{ path: ['fields', target, 'base'], before, after }]
});

describe('Pfad-Patches', () => {
	it('liest, schreibt und entfernt Werte', () => {
		const root: Record<string, unknown> = { a: { b: 1 } };
		expect(readPath(root, ['a', 'b'])).toBe(1);
		expect(readPath(root, ['x', 'y'])).toBeUndefined();
		writePath(root, ['a', 'c'], { d: 2 });
		expect(root).toEqual({ a: { b: 1, c: { d: 2 } } });
		writePath(root, ['a', 'b'], undefined);
		expect(root).toEqual({ a: { c: { d: 2 } } });
	});

	it('kopiert geschriebene Objekte, damit Historie und Zustand nicht verkoppelt sind', () => {
		const root: Record<string, unknown> = {};
		const item = { name: 'Axt' };
		writePath(root, ['items', 'x'], item);
		item.name = 'geändert';
		expect(readPath(root, ['items', 'x', 'name'])).toBe('Axt');
	});

	it('Rückgängig und Wiederholen sind symmetrisch', () => {
		const root = { items: {} as Record<string, unknown>, mods: {} as Record<string, unknown> };
		const patches = [
			{ path: ['items', 'm'], before: undefined, after: { name: 'Mantel' } },
			{ path: ['mods', 'k'], before: undefined, after: { expr: '2' } }
		];
		applyForward(root, patches);
		expect(root).toEqual({ items: { m: { name: 'Mantel' } }, mods: { k: { expr: '2' } } });
		applyBackward(root, patches);
		expect(root).toEqual({ items: {}, mods: {} });
	});
});

describe('Zusammenfassen schneller Folgeänderungen', () => {
	it('fasst Änderungen am selben Wert im Zeitfenster zusammen', () => {
		const a = ev(0, 34, 33);
		const b = ev(1000, 33, 32);
		expect(canCoalesce(a, b)).toBe(true);
		const merged = coalesce(a, b);
		expect(merged.before).toBe(34);
		expect(merged.after).toBe(32);
		expect(merged.patches[0]).toEqual({ path: ['fields', 'std.hp_current', 'base'], before: 34, after: 32 });
	});

	it('nicht bei anderem Ziel oder nach Ablauf des Fensters', () => {
		expect(canCoalesce(ev(0, 1, 2), ev(1000, 2, 3, 'std.ac'))).toBe(false);
		expect(canCoalesce(ev(0, 1, 2), ev(10_000, 2, 3))).toBe(false);
		expect(canCoalesce(undefined, ev(0, 1, 2))).toBe(false);
	});

	it('erkennt wirkungslose Ereignisse', () => {
		expect(isNoop(coalesce(ev(0, 10, 11), ev(500, 11, 10)))).toBe(true);
		expect(isNoop(ev(0, 10, 11))).toBe(false);
	});
});
