// Point-Buy-Rechner. Eine Hilfe beim Erstellen, keine Regelprüfung: Überschreitungen werden
// angezeigt, aber nicht verhindert.

export const POINT_BUY_COSTS: Record<number, number> = { 8: 0, 9: 1, 10: 2, 11: 3, 12: 4, 13: 5, 14: 7, 15: 9 };
export const POINT_BUY_BUDGET = 27;
export const POINT_BUY_MIN = 8;
export const POINT_BUY_MAX = 15;

export function pointCost(score: number): number | null {
	return POINT_BUY_COSTS[score] ?? null;
}

export function totalCost(scores: number[]): { cost: number; invalid: number[] } {
	let cost = 0;
	const invalid: number[] = [];
	scores.forEach((s, i) => {
		const c = pointCost(s);
		if (c === null) invalid.push(i);
		else cost += c;
	});
	return { cost, invalid };
}

/** Übliche Formel für den Attributsmodifikator – nur als Vorschlag beim Übernehmen. */
export function abilityModifier(score: number): number {
	return Math.floor((score - 10) / 2);
}

export function clampPointBuy(score: number): number {
	return Math.max(POINT_BUY_MIN, Math.min(POINT_BUY_MAX, Math.round(score)));
}
