import { describe, expect, it } from 'vitest';
import { evaluate } from './evaluate';
import type { Character, Modifier } from './types';
import { createDefaultCharacter, STD, ref } from '../model/defaults';
import { toDisplayExpr } from './formula';

let n = 0;
function addMod(c: Character, m: Partial<Modifier> & Pick<Modifier, 'targetFieldId' | 'op' | 'expr'>): Modifier {
	n++;
	const id = m.id ?? `m${n}`;
	const mod: Modifier = {
		id,
		description: m.description ?? id,
		source: m.source ?? { kind: 'field', id: m.targetFieldId ?? '' },
		order: 1000 + n,
		...m
	};
	c.modifiers[id] = mod;
	return mod;
}
function addItem(c: Character, id: string, containerId: string = STD.equipped, requiresAttunement = false) {
	c.items[id] = { id, name: id, description: '', quantity: 1, requiresAttunement, containerId, order: 0 };
}
function addAbility(c: Character, id: string, kind: 'ability' | 'condition' = 'ability', active = true) {
	c.abilities[id] = { id, kind, name: id, description: '', active, order: 0 };
}
const val = (c: Character, id: string) => evaluate(c).fields[id].value;

describe('RK-Beispiel aus dem Design Document', () => {
	function setup() {
		const c = createDefaultCharacter();
		c.fields[STD.attrMod('dex')].base = 3;
		addAbility(c, 'magierruestung');
		addMod(c, { id: 'mr', targetFieldId: STD.ac, op: 'set', expr: `13 + ${ref(STD.attrMod('dex'))}`, source: { kind: 'ability', id: 'magierruestung' } });
		addItem(c, 'schild');
		addMod(c, { id: 'schild+2', targetFieldId: STD.ac, op: 'add', expr: '2', source: { kind: 'item', id: 'schild' } });
		addItem(c, 'mantel', STD.equipped, true);
		addMod(c, { id: 'mantel+2', targetFieldId: STD.ac, op: 'add', expr: '2', description: 'Mantel der Macht', source: { kind: 'item', id: 'mantel' } });
		return c;
	}

	it('ergibt 20 und ist Schritt für Schritt nachvollziehbar', () => {
		const c = setup();
		const r = evaluate(c).fields[STD.ac];
		expect(r.base).toBe(10);
		expect(r.value).toBe(20);
		expect(r.steps.map((s) => [s.modifierId, s.before, s.after])).toEqual([
			['mr', 10, 16],
			['schild+2', 16, 18],
			['mantel+2', 18, 20]
		]);
		expect(r.steps[0].refs).toEqual([STD.attrMod('dex')]);
	});

	it('Ablegen des Mantels senkt die RK sofort und zeigt den Grund', () => {
		const c = setup();
		c.items.mantel.containerId = STD.backpack;
		const e = evaluate(c);
		expect(e.fields[STD.ac].value).toBe(18);
		expect(e.fields[STD.ac].inactive).toEqual([{ modifierId: 'mantel+2', reason: 'nicht ausgerüstet (in „Rucksack“)' }]);
		expect(e.modifiers['mantel+2'].state).toBe('inactive');
	});

	it('Items in einem Beutel im ausgerüsteten Container wirken nicht', () => {
		const c = setup();
		c.containers.beutel = { id: 'beutel', name: 'Beutel', parentId: STD.equipped, equipped: false, order: 3 };
		c.items.mantel.containerId = 'beutel';
		expect(val(c, STD.ac)).toBe(18);
	});

	it('gelöschte Quelle macht den Modifikator wirkungslos', () => {
		const c = setup();
		delete c.items.schild;
		expect(val(c, STD.ac)).toBe(18);
		expect(evaluate(c).modifiers['schild+2']).toMatchObject({ state: 'inactive', reason: 'Quelle fehlt' });
	});
});

describe('Operationen und Reihenfolge', () => {
	it('wendet Setzen → Addieren → Multiplizieren/Teilen an, unabhängig von der Anlagereihenfolge', () => {
		const c = createDefaultCharacter();
		const f = STD.speed; // Basis 9
		addMod(c, { targetFieldId: f, op: 'multiply', expr: '2' });
		addMod(c, { targetFieldId: f, op: 'add', expr: '3' });
		addMod(c, { targetFieldId: f, op: 'set', expr: '6' });
		const r = evaluate(c).fields[f];
		expect(r.steps.map((s) => s.stage)).toEqual(['set', 'add', 'mul']);
		expect(r.value).toBe(18); // (6 + 3) * 2
	});

	it('rundet beim Teilen standardmäßig ab, wahlweise auf oder kaufmännisch', () => {
		const c = createDefaultCharacter();
		c.fields[STD.speed].base = 9;
		const m = addMod(c, { targetFieldId: STD.speed, op: 'divide', expr: '2' });
		expect(val(c, STD.speed)).toBe(4);
		m.rounding = 'ceil';
		expect(val(c, STD.speed)).toBe(5);
		m.rounding = 'none';
		expect(val(c, STD.speed)).toBe(4.5);
		c.fields[STD.speed].base = -9;
		m.rounding = 'floor';
		expect(val(c, STD.speed)).toBe(-5);
	});

	it('Multiplizieren rundet ebenfalls', () => {
		const c = createDefaultCharacter();
		c.fields[STD.speed].base = 9;
		addMod(c, { targetFieldId: STD.speed, op: 'multiply', expr: '0.5' });
		expect(val(c, STD.speed)).toBe(4);
	});

	it('Division durch 0 wird markiert, das Feld rechnet ohne ihn weiter', () => {
		const c = createDefaultCharacter();
		const m = addMod(c, { targetFieldId: STD.speed, op: 'divide', expr: '0' });
		const e = evaluate(c);
		expect(e.fields[STD.speed].value).toBe(9);
		expect(e.modifiers[m.id]).toMatchObject({ state: 'error', issue: { kind: 'math' } });
	});

	it('glättet Fließkomma-Artefakte', () => {
		const c = createDefaultCharacter();
		c.fields[STD.speed].base = 0.1;
		addMod(c, { targetFieldId: STD.speed, op: 'add', expr: '0.2' });
		expect(val(c, STD.speed)).toBe(0.3);
	});
});

describe('Konflikte', () => {
	it('mehrere Setzen: der höchste gilt, Konflikt wird gemeldet', () => {
		const c = createDefaultCharacter();
		c.fields[STD.attrMod('dex')].base = 3;
		c.fields[STD.attrMod('con')].base = 4;
		addAbility(c, 'mr');
		addAbility(c, 'rv');
		addMod(c, { id: 'magier', targetFieldId: STD.ac, op: 'set', expr: `13 + ${ref(STD.attrMod('dex'))}`, source: { kind: 'ability', id: 'mr' } });
		addMod(c, { id: 'rueVert', targetFieldId: STD.ac, op: 'set', expr: `10 + ${ref(STD.attrMod('dex'))} + ${ref(STD.attrMod('con'))}`, source: { kind: 'ability', id: 'rv' } });
		const e = evaluate(c);
		const r = e.fields[STD.ac];
		expect(r.value).toBe(17);
		expect(r.conflict).toEqual({ modifierIds: ['magier', 'rueVert'], winnerId: 'rueVert' });
		expect(e.modifiers.magier.state).toBe('overridden');
		expect(r.steps[0].modifierId).toBe('rueVert');

		// Spieler löst den Konflikt, indem er eine Quelle abschaltet.
		c.abilities.rv.active = false;
		const e2 = evaluate(c);
		expect(e2.fields[STD.ac].value).toBe(16);
		expect(e2.fields[STD.ac].conflict).toBeUndefined();
	});
});

describe('Übung', () => {
	it('Athletik folgt STR-Mod und Übungsbonus; Expertise verdoppelt, halb rundet ab', () => {
		const c = createDefaultCharacter();
		const athl = STD.skill('athletics');
		const prof = c.proficiencies['std.prof.skill_athletics'];
		c.fields[STD.attrMod('str')].base = 3;
		c.fields[STD.prof].base = 3;
		expect(val(c, athl)).toBe(3);
		expect(evaluate(c).fields[athl].inactive).toEqual([{ modifierId: 'std.mod.prof.skill_athletics', reason: 'Übung: keine' }]);
		prof.level = 1;
		expect(val(c, athl)).toBe(6);
		prof.level = 2;
		expect(val(c, athl)).toBe(9);
		prof.level = 0.5;
		expect(val(c, athl)).toBe(4);
		c.fields[STD.attrMod('str')].base = 4;
		c.fields[STD.prof].base = 4;
		prof.level = 2;
		expect(val(c, athl)).toBe(12);
		const step = evaluate(c).fields[athl].steps.find((s) => s.modifierId === 'std.mod.prof.skill_athletics')!;
		expect(step).toMatchObject({ rawValue: 4, factor: 2, value: 8 });
	});

	it('Passive Wahrnehmung folgt der Referenzkette', () => {
		const c = createDefaultCharacter();
		c.fields[STD.attrMod('wis')].base = 2;
		c.proficiencies['std.prof.skill_perception'].level = 1;
		expect(val(c, STD.passivePerception)).toBe(14);
		expect(val(c, STD.spellDc)).toBe(10);
	});
});

describe('Zustände und Fähigkeiten', () => {
	it('Krankheit mit KON −2 und STR −4 lässt sich an- und ausschalten', () => {
		const c = createDefaultCharacter();
		addAbility(c, 'krankheit', 'condition');
		addMod(c, { id: 'k1', targetFieldId: STD.attr('con'), op: 'add', expr: '-2', source: { kind: 'ability', id: 'krankheit' } });
		addMod(c, { id: 'k2', targetFieldId: STD.attr('str'), op: 'add', expr: '-4', source: { kind: 'ability', id: 'krankheit' } });
		let e = evaluate(c);
		expect(e.fields[STD.attr('con')].value).toBe(8);
		expect(e.fields[STD.attr('str')].value).toBe(6);
		c.abilities.krankheit.active = false;
		e = evaluate(c);
		expect(e.fields[STD.attr('con')].value).toBe(10);
		expect(e.fields[STD.attr('str')].inactive[0]).toEqual({ modifierId: 'k2', reason: 'Zustand aus' });
	});
});

describe('Fehler und Zyklen', () => {
	it('erkennt Zirkelbezüge, markiert die Kette und rechnet den Rest weiter', () => {
		const c = createDefaultCharacter();
		c.fields.a = { id: 'a', name: 'A', type: 'number', base: 1, order: 900 };
		c.fields.b = { id: 'b', name: 'B', type: 'number', base: 2, order: 901 };
		addMod(c, { id: 'ab', targetFieldId: 'a', op: 'add', expr: '@[b]' });
		addMod(c, { id: 'ba', targetFieldId: 'b', op: 'add', expr: '@[a] + 1' });
		addMod(c, { id: 'ok', targetFieldId: 'a', op: 'add', expr: '10' });
		const e = evaluate(c);
		expect(e.modifiers.ab).toMatchObject({ state: 'error', issue: { kind: 'cycle', chain: ['a', 'b', 'a'] } });
		expect(e.modifiers.ba).toMatchObject({ state: 'error', issue: { kind: 'cycle', chain: ['b', 'a', 'b'] } });
		expect(e.fields.a.value).toBe(11);
		expect(e.fields.b.value).toBe(2);
	});

	it('erkennt Selbstbezüge und längere Ketten', () => {
		const c = createDefaultCharacter();
		addMod(c, { id: 'self', targetFieldId: STD.ac, op: 'add', expr: `${ref(STD.ac)} + 1` });
		addMod(c, { id: 'x1', targetFieldId: STD.attrMod('str'), op: 'add', expr: ref(STD.skill('athletics')) });
		const e = evaluate(c);
		expect(e.modifiers.self).toMatchObject({ state: 'error', issue: { kind: 'cycle', chain: [STD.ac, STD.ac] } });
		expect(e.modifiers.x1.issue?.chain).toEqual([STD.attrMod('str'), STD.skill('athletics'), STD.attrMod('str')]);
		// Rettungswurf STR hängt vom STR-Mod ab, ist aber selbst nicht im Zyklus.
		expect(e.fields[STD.save('str')].issues).toEqual([]);
	});

	it('inaktive Modifikatoren erzeugen keinen Zyklus', () => {
		const c = createDefaultCharacter();
		addAbility(c, 'aus', 'ability', false);
		addMod(c, { id: 'self', targetFieldId: STD.ac, op: 'add', expr: ref(STD.ac), source: { kind: 'ability', id: 'aus' } });
		expect(evaluate(c).modifiers.self.state).toBe('inactive');
	});

	it('ungültige Formel und gelöschte Referenz zählen als wirkungslos', () => {
		const c = createDefaultCharacter();
		addMod(c, { id: 'bad', targetFieldId: STD.ac, op: 'add', expr: '2 +' });
		addMod(c, { id: 'gone', targetFieldId: STD.ac, op: 'add', expr: '@[geloescht]' });
		const e = evaluate(c);
		expect(e.fields[STD.ac].value).toBe(10);
		expect(e.modifiers.bad).toMatchObject({ state: 'error', issue: { kind: 'parse' } });
		expect(e.modifiers.gone).toMatchObject({ state: 'error', issue: { kind: 'missingRef' } });
	});

	it('nicht zugeordnete Modifikatoren werden gesammelt', () => {
		const c = createDefaultCharacter();
		addMod(c, { id: 'u1', targetFieldId: null, op: 'add', expr: '1' });
		addMod(c, { id: 'u2', targetFieldId: 'gibtsnicht', op: 'add', expr: '1' });
		const e = evaluate(c);
		expect(e.unassigned).toEqual(['u1', 'u2']);
		expect(e.modifiers.u2.reason).toBe('Zielfeld gelöscht');
	});

	it('übersteht lange Referenzketten ohne Stack-Overflow', () => {
		const c = createDefaultCharacter();
		const N = 5000;
		for (let i = 0; i < N; i++) {
			c.fields[`k${i}`] = { id: `k${i}`, name: `K${i}`, type: 'number', base: 0, order: 2000 + i };
			if (i > 0) addMod(c, { targetFieldId: `k${i}`, op: 'add', expr: `@[k${i - 1}] + 1` });
		}
		expect(evaluate(c).fields[`k${N - 1}`].value).toBe(N - 1);
	});
});

describe('Umbenennen', () => {
	it('bricht keine Formel', () => {
		const c = createDefaultCharacter();
		c.fields[STD.attrMod('dex')].base = 2;
		const before = val(c, STD.initiative);
		c.fields[STD.attrMod('dex')].name = 'Geschicklichkeitsmodifikator';
		expect(val(c, STD.initiative)).toBe(before);
		const fields = Object.values(c.fields);
		expect(toDisplayExpr(c.modifiers['std.mod.initiative'].expr, fields)).toBe('@Geschicklichkeitsmodifikator');
	});
});

describe('Einstimmung', () => {
	it('zählt nur ausgerüstete Items mit Einstimmung und meldet Überschreitung', () => {
		const c = createDefaultCharacter();
		addItem(c, 'r1', STD.equipped, true);
		addItem(c, 'r2', STD.equipped, true);
		addItem(c, 'r3', STD.backpack, true);
		addItem(c, 'axt', STD.equipped, false);
		let e = evaluate(c);
		expect(e.fields[STD.attuned].value).toBe(2);
		expect(e.fields[STD.attuned].baseNote).toContain('2');
		expect(e.attunement).toEqual({ count: 2, limit: 3, over: false });
		c.items.r3.containerId = STD.equipped;
		addItem(c, 'r4', STD.equipped, true);
		e = evaluate(c);
		expect(e.attunement).toEqual({ count: 4, limit: 3, over: true });
	});
});

describe('Inkrementelle Neuberechnung', () => {
	it('berechnet nach einer Änderung nur abhängige Felder neu', () => {
		const c = createDefaultCharacter();
		const first = evaluate(c);
		expect(first.recomputed.length).toBe(Object.keys(c.fields).length);

		const same = evaluate(c, first);
		expect(same.recomputed).toEqual([]);
		expect(same.fields[STD.ac]).toBe(first.fields[STD.ac]);

		c.fields[STD.attrMod('str')].base = 3;
		const second = evaluate(c, same);
		expect(new Set(second.recomputed)).toEqual(
			new Set([STD.attrMod('str'), STD.save('str'), STD.skill('athletics')])
		);
		expect(second.fields[STD.skill('athletics')].value).toBe(3);

		c.fields[STD.attrMod('wis')].base = 1;
		const third = evaluate(c, second);
		expect(new Set(third.recomputed)).toEqual(
			new Set([
				STD.attrMod('wis'),
				STD.save('wis'),
				...['medicine', 'animal_handling', 'insight', 'survival', 'perception'].map(STD.skill),
				STD.passivePerception
			])
		);
		expect(third.fields[STD.passivePerception].value).toBe(11);
		// Ergebnisse sind identisch mit einer vollständigen Neuberechnung.
		const full = evaluate(c);
		for (const id of Object.keys(c.fields)) expect(third.fields[id].value).toBe(full.fields[id].value);
	});

	it('Umschalten einer Quelle berechnet das Zielfeld neu', () => {
		const c = createDefaultCharacter();
		addItem(c, 'mantel');
		addMod(c, { targetFieldId: STD.ac, op: 'add', expr: '2', source: { kind: 'item', id: 'mantel' } });
		const a = evaluate(c);
		c.items.mantel.containerId = STD.backpack;
		const b = evaluate(c, a);
		expect(b.recomputed).toEqual([STD.ac]);
		expect(b.fields[STD.ac].value).toBe(10);
	});
});
