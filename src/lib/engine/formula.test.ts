import { describe, expect, it } from 'vitest';
import { evaluateExpr, parseExpr, toDisplayExpr, toStoredExpr, isPlainNumber } from './formula';

const vals: Record<string, number> = { a: 3, b: 4, 'std.dex_mod': 3 };
const look = (id: string) => vals[id];
const ev = (s: string) => evaluateExpr(s, look);

describe('Formelparser', () => {
	it('rechnet mit Punkt vor Strich und Klammern', () => {
		expect(ev('1 + 2 * 3')).toEqual({ ok: true, value: 7 });
		expect(ev('(1 + 2) * 3')).toEqual({ ok: true, value: 9 });
		expect(ev('10 - 4 - 3')).toEqual({ ok: true, value: 3 });
		expect(ev('12 / 3 / 2')).toEqual({ ok: true, value: 2 });
	});

	it('kennt unäres Minus und typografische Operatoren', () => {
		expect(ev('-3 + 5')).toEqual({ ok: true, value: 2 });
		expect(ev('2 × −3')).toEqual({ ok: true, value: -6 });
		expect(ev('9 ÷ 3')).toEqual({ ok: true, value: 3 });
		expect(ev('--2')).toEqual({ ok: true, value: 2 });
	});

	it('löst Referenzen auf', () => {
		expect(ev('13 + @[std.dex_mod]')).toEqual({ ok: true, value: 16 });
		expect(parseExpr('@[a] * @[b] + @[a]')).toMatchObject({ ok: true, refs: ['a', 'b'] });
	});

	it('kennt floor, ceil, round, min, max', () => {
		expect(ev('floor(7 / 2)')).toEqual({ ok: true, value: 3 });
		expect(ev('ceil(7 / 2)')).toEqual({ ok: true, value: 4 });
		expect(ev('round(2.5)')).toEqual({ ok: true, value: 3 });
		expect(ev('min(@[a], @[b], 1)')).toEqual({ ok: true, value: 1 });
		expect(ev('MAX(@[a]; @[b])')).toEqual({ ok: true, value: 4 });
	});

	it('meldet Fehler statt abzustürzen', () => {
		for (const bad of ['', '1 +', '(1', '1)', 'foo(1)', 'floor(1, 2)', '1 $ 2', '@', '@[', '@{Unbekannt}', '@Unbekannt', 'min()']) {
			const r = ev(bad);
			expect(r.ok, bad).toBe(false);
		}
		expect(ev('1 / 0')).toEqual({ ok: false, error: 'Division durch 0' });
		expect(ev('@[gibtsnicht]')).toMatchObject({ ok: false });
	});

	it('erkennt reine Zahlen', () => {
		expect(isPlainNumber(' 2 ')).toBe(true);
		expect(isPlainNumber('-1.5')).toBe(true);
		expect(isPlainNumber('1 + 1')).toBe(false);
	});
});

describe('Anzeige- und Speicherform', () => {
	const fields = [
		{ id: 'std.str', name: 'STR' },
		{ id: 'std.str_mod', name: 'STR-Mod' },
		{ id: 'std.dex_mod', name: 'GES-Mod' },
		{ id: 'std.passive', name: 'Passive Wahrnehmung' },
		{ id: 'std.perc', name: 'Wahrnehmung' },
		{ id: 'x', name: 'Krankheits{fort}schritt' }
	];

	it('ordnet Namen mit Bindestrich und Leerzeichen über die längste Übereinstimmung zu', () => {
		expect(toStoredExpr('13 + @GES-Mod', fields)).toBe('13 + @[std.dex_mod]');
		expect(toStoredExpr('@STR-Mod-1', fields)).toBe('@[std.str_mod]-1');
		expect(toStoredExpr('@STR - 10', fields)).toBe('@[std.str] - 10');
		expect(toStoredExpr('@passive wahrnehmung + 1', fields)).toBe('@[std.passive] + 1');
		expect(toStoredExpr('@{Wahrnehmung}*2', fields)).toBe('@[std.perc]*2');
	});

	it('lässt unbekannte Namen als Fehler stehen', () => {
		const stored = toStoredExpr('@Foo + 1', fields);
		expect(stored).toBe('@{Foo} + 1');
		expect(parseExpr(stored)).toMatchObject({ ok: false, error: 'Unbekanntes Feld „Foo“' });
	});

	it('zeigt aktuelle Namen an – Umbenennen bricht keine Formel', () => {
		const stored = '13 + @[std.dex_mod]';
		expect(toDisplayExpr(stored, fields)).toBe('13 + @GES-Mod');
		const renamed = fields.map((f) => (f.id === 'std.dex_mod' ? { ...f, name: 'Geschick Mod' } : f));
		expect(toDisplayExpr(stored, renamed)).toBe('13 + @Geschick Mod');
		expect(toStoredExpr(toDisplayExpr(stored, renamed), renamed)).toBe(stored);
	});

	it('klammert Namen, die nicht eindeutig zurückgelesen würden', () => {
		const tricky = [...fields, { id: 'y', name: 'STR-Mod 2' }, { id: 'z', name: '2. Angriff' }];
		for (const f of tricky) {
			const shown = toDisplayExpr(`@[${f.id}] + 1`, tricky);
			expect(toStoredExpr(shown, tricky), shown).toBe(`@[${f.id}] + 1`);
		}
	});

	it('lässt gelöschte Felder als ID stehen', () => {
		expect(toDisplayExpr('@[weg] + 1', fields)).toBe('@[weg] + 1');
	});
});
