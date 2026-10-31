import { describe, expect, it } from 'vitest';
import type { Block } from '../engine/types';
import { clampRect, findFreeSpot, overlaps, placeBlock } from './layout';
import { createDefaultCharacter } from './defaults';

const b = (id: string, x: number, y: number, w: number, h: number): Block => ({ id, type: 'text', x, y, w, h, config: {} });
const pos = (blocks: Block[]) => Object.fromEntries(blocks.map((x) => [x.id, [x.x, x.y, x.w, x.h]]));

describe('Raster', () => {
	it('hält Bausteine im Raster', () => {
		expect(clampRect({ x: -2, y: -1, w: 3, h: 0 })).toEqual({ x: 0, y: 0, w: 3, h: 1 });
		expect(clampRect({ x: 11, y: 0, w: 4, h: 2 })).toEqual({ x: 8, y: 0, w: 4, h: 2 });
		expect(clampRect({ x: 0, y: 0, w: 20, h: 2 })).toEqual({ x: 0, y: 0, w: 12, h: 2 });
	});

	it('erkennt Überlappung, aber nicht bloßes Berühren', () => {
		expect(overlaps({ x: 0, y: 0, w: 2, h: 2 }, { x: 1, y: 1, w: 2, h: 2 })).toBe(true);
		expect(overlaps({ x: 0, y: 0, w: 2, h: 2 }, { x: 2, y: 0, w: 2, h: 2 })).toBe(false);
		expect(overlaps({ x: 0, y: 0, w: 2, h: 2 }, { x: 0, y: 2, w: 2, h: 2 })).toBe(false);
	});

	it('überdeckte Bausteine rutschen nach unten, Kettenreaktion inklusive', () => {
		const blocks = [b('a', 0, 0, 4, 2), b('b', 0, 2, 4, 2), b('c', 0, 4, 4, 2), b('d', 6, 0, 2, 2)];
		const out = placeBlock(blocks, 'a', { x: 0, y: 1, w: 4, h: 3 });
		expect(pos(out)).toEqual({ a: [0, 1, 4, 3], b: [0, 4, 4, 2], c: [0, 6, 4, 2], d: [6, 0, 2, 2] });
		// Eingabe unverändert
		expect(blocks[1].y).toBe(2);
	});

	it('nichts rückt automatisch nach oben', () => {
		const blocks = [b('a', 0, 0, 4, 2), b('b', 0, 5, 4, 2)];
		expect(pos(placeBlock(blocks, 'a', { x: 6, y: 0, w: 4, h: 2 }))).toEqual({ a: [6, 0, 4, 2], b: [0, 5, 4, 2] });
	});

	it('Größe ändern schiebt Nachbarn darunter weg', () => {
		const blocks = [b('a', 0, 0, 6, 2), b('b', 6, 0, 6, 2)];
		const out = placeBlock(blocks, 'a', { x: 0, y: 0, w: 8, h: 2 });
		expect(pos(out)).toEqual({ a: [0, 0, 8, 2], b: [6, 2, 6, 2] });
	});

	it('findet die erste freie Stelle', () => {
		const blocks = [b('a', 0, 0, 6, 2), b('b', 6, 0, 3, 4)];
		expect(findFreeSpot(blocks, 3, 2)).toEqual({ x: 9, y: 0, w: 3, h: 2 });
		expect(findFreeSpot(blocks, 6, 2)).toEqual({ x: 0, y: 2, w: 6, h: 2 });
		expect(findFreeSpot([], 20, 1)).toEqual({ x: 0, y: 0, w: 12, h: 1 });
	});

	it('Startlayout hat keine Überlappungen und nur gültige Verweise', () => {
		const c = createDefaultCharacter();
		for (const tab of c.layout.tabs) {
			for (const x of tab.blocks) {
				expect(x.x + x.w, `${tab.name}/${x.id}`).toBeLessThanOrEqual(12);
				for (const y of tab.blocks) if (x !== y) expect(overlaps(x, y), `${tab.name}: ${x.id} / ${y.id}`).toBe(false);
				const cfg = x.config as Record<string, string | string[] | undefined>;
				if (typeof cfg.fieldId === 'string') expect(c.fields[cfg.fieldId]).toBeDefined();
				for (const id of (cfg.fieldIds as string[] | undefined) ?? []) expect(c.fields[id]).toBeDefined();
				for (const id of (cfg.counterIds as string[] | undefined) ?? []) expect(c.counters[id]).toBeDefined();
				if (typeof cfg.containerId === 'string') expect(c.containers[cfg.containerId]).toBeDefined();
				if (typeof cfg.textId === 'string') expect(c.texts[cfg.textId]).toBeDefined();
				if (typeof cfg.spellListId === 'string') expect(c.spellLists[cfg.spellListId]).toBeDefined();
			}
		}
	});
});
