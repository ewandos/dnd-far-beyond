import { describe, expect, it } from 'vitest';
import { average, evalDiceTerms, formatDice, parseDiceExpr, parseListText, type DiceLookup } from './dice';
import { evaluate } from './evaluate';
import { createDefaultCharacter, STD } from '../model/defaults';
import type { Character, Field, Modifier } from './types';

const lookup: DiceLookup = (id) =>
	id === 'mod' ? { kind: 'number', value: 3 } : id === 'w' ? { kind: 'dice', value: { dice: { 6: 1 }, flat: 0 } } : undefined;
const ev = (s: string) => {
	const p = parseDiceExpr(s);
	if (!p.ok) return p.error;
	const r = evalDiceTerms(p.terms, lookup);
	return r.ok ? formatDice(r.value) : r.error;
};

describe('Würfelausdrücke', () => {
	it('summiert Würfel und Zahlen, auch mit W statt d', () => {
		expect(ev('1d8')).toBe('1d8');
		expect(ev('d20 + 5')).toBe('1d20 + 5');
		expect(ev('1d8 + 1W8 + 2d6 - 1')).toBe('2d8 + 2d6 − 1');
		expect(ev('2d6 - 2d6 + 4')).toBe('4');
		expect(ev('- 1d4')).toBe('−1d4');
		expect(ev('0')).toBe('0');
	});

	it('löst Referenzen auf Zahl- und Würfelfelder auf', () => {
		expect(ev('1d8 + @[mod]')).toBe('1d8 + 3');
		expect(ev('1d8 + @[w] + floor(@[mod] / 2)')).toBe('1d8 + 1d6 + 1');
		expect(ev('2 * @[w]')).toBe('Würfelfelder nur als eigener Summand verwenden');
	});

	it('meldet Fehler', () => {
		expect(ev('1d8 +')).toBe('Ausdruck ist unvollständig');
		expect(ev('2 * 1d6')).toBe('Würfel nur als Summand, z. B. „2d6 + 3“');
		expect(ev('1d0')).toBe('Ungültiger Würfel „1d0“');
		expect(ev('(1d6')).toBe('Ausdruck ist unvollständig');
		expect(ev('@[gibtsnicht]')).toBe('Referenz auf unbekanntes Feld');
	});

	it('Durchschnitt für Vergleiche', () => {
		expect(average({ dice: { 8: 1 }, flat: 3 })).toBe(7.5);
	});

	it('Listen trennen an Komma, Semikolon und Zeilenumbruch', () => {
		expect(parseListText('Elfisch, Zwergisch;Gemeinsprache\n  ')).toEqual(['Elfisch', 'Zwergisch', 'Gemeinsprache']);
	});
});

function withFields(): Character {
	const c = createDefaultCharacter();
	c.fields.dmg = { id: 'dmg', name: 'Langschwert', type: 'dice', base: 0, diceBase: '1d8', order: 900 } as Field;
	c.fields.lang = { id: 'lang', name: 'Sprachen', type: 'list', base: 0, listBase: ['Gemeinsprache'], order: 901 } as Field;
	return c;
}
let n = 0;
const mod = (c: Character, m: Partial<Modifier> & Pick<Modifier, 'targetFieldId' | 'op' | 'expr'>) => {
	const id = m.id ?? `m${n++}`;
	c.modifiers[id] = { id, description: id, source: { kind: 'field', id: m.targetFieldId! }, order: 1000 + n, ...m };
	return id;
};

describe('Feldtyp Würfelausdruck', () => {
	it('Basis plus Modifikatoren, Referenzen inklusive', () => {
		const c = withFields();
		c.fields[STD.attrMod('str')].base = 3;
		mod(c, { targetFieldId: 'dmg', op: 'add', expr: `@[${STD.attrMod('str')}]` });
		c.abilities.hex = { id: 'hex', kind: 'condition', name: 'Hexenfluch', description: '', active: true, order: 0 };
		mod(c, { targetFieldId: 'dmg', op: 'add', expr: '1d6', source: { kind: 'ability', id: 'hex' } });
		let r = evaluate(c).fields.dmg;
		expect(r.kind).toBe('dice');
		expect(r.text).toBe('1d8 + 1d6 + 3');
		expect(r.steps.map((s) => [s.text, s.beforeText, s.afterText])).toEqual([
			['+ 3', '1d8', '1d8 + 3'],
			['+ 1d6', '1d8 + 3', '1d8 + 1d6 + 3']
		]);
		c.abilities.hex.active = false;
		r = evaluate(c).fields.dmg;
		expect(r.text).toBe('1d8 + 3');
	});

	it('Setzen: höchster Durchschnitt gilt, Konflikt wird gemeldet; Multiplizieren ist ein Fehler', () => {
		const c = withFields();
		const a = mod(c, { targetFieldId: 'dmg', op: 'set', expr: '1d10' });
		mod(c, { targetFieldId: 'dmg', op: 'set', expr: '2d4' });
		const x = mod(c, { targetFieldId: 'dmg', op: 'multiply', expr: '2' });
		const e = evaluate(c);
		expect(e.fields.dmg.text).toBe('1d10');
		expect(e.fields.dmg.conflict?.winnerId).toBe(a);
		expect(e.modifiers[x]).toMatchObject({ state: 'error', reason: 'Bei Würfel- und Listenfeldern nur Setzen und Addieren' });
	});

	it('Würfelfelder können andere Würfelfelder enthalten, Zahlenfelder nicht', () => {
		const c = withFields();
		c.fields.crit = { id: 'crit', name: 'Krit', type: 'dice', base: 0, diceBase: '0', order: 902 } as Field;
		mod(c, { targetFieldId: 'crit', op: 'add', expr: '@[dmg] + @[dmg]' });
		const bad = mod(c, { targetFieldId: STD.ac, op: 'add', expr: '@[dmg]' });
		const e = evaluate(c);
		expect(e.fields.crit.text).toBe('2d8');
		expect(e.modifiers[bad]).toMatchObject({ state: 'error', reason: '„Langschwert“ ist kein Zahlenfeld' });
		expect(e.fields[STD.ac].value).toBe(10);
	});

	it('ungültiger Basiswert wird gemeldet statt abzustürzen', () => {
		const c = withFields();
		c.fields.dmg.diceBase = '1d8 + @[x]';
		expect(evaluate(c).fields.dmg).toMatchObject({ text: '0', baseNote: expect.stringContaining('ungültig') });
	});

	it('inkrementell: abhängige Würfelfelder werden neu berechnet', () => {
		const c = withFields();
		mod(c, { targetFieldId: 'dmg', op: 'add', expr: `@[${STD.attrMod('str')}]` });
		const a = evaluate(c);
		c.fields[STD.attrMod('str')].base = 2;
		const b = evaluate(c, a);
		expect(b.recomputed).toContain('dmg');
		expect(b.fields.dmg.text).toBe('1d8 + 2');
		expect(evaluate(c, b).recomputed).toEqual([]);
	});
});

describe('Feldtyp Liste', () => {
	it('Hinzufügen ohne Dubletten, Setzen ersetzt, Quelle schaltet', () => {
		const c = withFields();
		c.items.helm = { id: 'helm', name: 'Helm der Sprachen', description: '', quantity: 1, requiresAttunement: false, containerId: STD.equipped, order: 0 };
		mod(c, { targetFieldId: 'lang', op: 'add', expr: 'Elfisch, gemeinsprache', source: { kind: 'item', id: 'helm' } });
		let r = evaluate(c).fields.lang;
		expect(r).toMatchObject({ kind: 'list', list: ['Gemeinsprache', 'Elfisch'], text: 'Gemeinsprache, Elfisch', value: 2 });
		c.items.helm.containerId = STD.backpack;
		expect(evaluate(c).fields.lang.list).toEqual(['Gemeinsprache']);
		mod(c, { targetFieldId: 'lang', op: 'set', expr: 'Telepathie' });
		r = evaluate(c).fields.lang;
		expect(r.list).toEqual(['Telepathie']);
	});

	it('Listenfelder sind in Formeln nicht referenzierbar', () => {
		const c = withFields();
		const bad = mod(c, { targetFieldId: STD.ac, op: 'add', expr: '@[lang]' });
		expect(evaluate(c).modifiers[bad].reason).toBe('„Sprachen“ ist kein Zahlenfeld');
	});
});
