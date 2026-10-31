// Raster-Logik für das freie Layout: 12 Spalten, feste Zeilenhöhe, keine Überlappung.
// Wird ein Baustein verschoben oder vergrößert, rutschen überdeckte Bausteine nach unten –
// alles andere bleibt, wo der Spieler es hingelegt hat (kein automatisches Hochrücken).

import type { Block } from '../engine/types';

export const GRID_COLUMNS = 12;
export const ROW_HEIGHT = 40;
export const GRID_GAP = 12;

export interface Rect {
	x: number;
	y: number;
	w: number;
	h: number;
}

export function overlaps(a: Rect, b: Rect): boolean {
	return a.x < b.x + b.w && b.x < a.x + a.w && a.y < b.y + b.h && b.y < a.y + a.h;
}

/** Hält einen Baustein im Raster: Mindestgröße 1×1, innerhalb der 12 Spalten, y ≥ 0. */
export function clampRect(r: Rect): Rect {
	const w = Math.max(1, Math.min(GRID_COLUMNS, Math.round(r.w)));
	const h = Math.max(1, Math.round(r.h));
	const x = Math.max(0, Math.min(GRID_COLUMNS - w, Math.round(r.x)));
	const y = Math.max(0, Math.round(r.y));
	return { x, y, w, h };
}

/**
 * Setzt Baustein `id` auf `rect` und schiebt überlappende Bausteine nach unten.
 * Gibt eine neue Liste zurück; die Eingabe bleibt unverändert.
 */
export function placeBlock(blocks: Block[], id: string, rect: Rect): Block[] {
	const target = clampRect(rect);
	const out = blocks.map((b) => (b.id === id ? { ...b, ...target } : { ...b }));
	const fixed = out.find((b) => b.id === id);
	if (!fixed) return out;

	// Von oben nach unten auflösen: jeder Baustein weicht allen bereits platzierten aus.
	const placed: Block[] = [fixed];
	const rest = out.filter((b) => b.id !== id).sort((a, b) => a.y - b.y || a.x - b.x);
	for (const b of rest) {
		let moved = true;
		while (moved) {
			moved = false;
			for (const p of placed) {
				if (overlaps(b, p)) {
					b.y = p.y + p.h;
					moved = true;
				}
			}
		}
		placed.push(b);
	}
	// Ursprüngliche Reihenfolge beibehalten (stabile IDs, ruhige Historie).
	const byId = new Map(placed.map((b) => [b.id, b]));
	return out.map((b) => byId.get(b.id)!);
}

/** Unterste belegte Zeile. */
export function bottom(blocks: Rect[]): number {
	return blocks.reduce((m, b) => Math.max(m, b.y + b.h), 0);
}

/** Erste freie Stelle (von oben links) für einen neuen Baustein der Größe w×h. */
export function findFreeSpot(blocks: Rect[], w: number, h: number): Rect {
	const width = Math.min(GRID_COLUMNS, Math.max(1, w));
	const maxY = bottom(blocks);
	for (let y = 0; y <= maxY; y++) {
		for (let x = 0; x + width <= GRID_COLUMNS; x++) {
			const r = { x, y, w: width, h };
			if (!blocks.some((b) => overlaps(b, r))) return r;
		}
	}
	return { x: 0, y: maxY, w: width, h };
}

/** Pixel → Rasterzellen, für Ziehen und Größenänderung. */
export function cellSize(gridWidth: number): { col: number; row: number } {
	return { col: (gridWidth + GRID_GAP) / GRID_COLUMNS, row: ROW_HEIGHT + GRID_GAP };
}
