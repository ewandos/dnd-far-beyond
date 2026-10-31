import { describe, expect, it } from 'vitest';
import { evaluate } from '../engine/evaluate';
import type { Character } from '../engine/types';
import { createDefaultCharacter, STD } from './defaults';
import { exportContent, planImport, readContentFile, ContentError, type ContentEntry } from './content';

let n = 0;
const ids = () => `neu${n++}`;

function sl(): Character {
	// Spielleitung: Mantel mit RK +2, eine Volksfähigkeit auf ein eigenes Feld, ein Zauber.
	const c = createDefaultCharacter('SL');
	c.fields.ruhm = { id: 'ruhm', name: 'Ruhm', type: 'number', base: 0, order: 999, group: 'Eigene Felder' };
	c.items.mantel = { id: 'mantel', name: 'Mantel der Macht', description: 'Glänzt.', quantity: 1, requiresAttunement: true, containerId: STD.equipped, order: 0, counterId: 'k' };
	c.counters.k = { id: 'k', name: 'Nutzungen: Mantel', max: 2, checked: 1, order: 50, group: 'Nutzungen' };
	c.modifiers.m1 = { id: 'm1', targetFieldId: STD.ac, op: 'add', expr: '2', description: 'Mantel', source: { kind: 'item', id: 'mantel' }, order: 900 };
	c.abilities.held = { id: 'held', kind: 'ability', name: 'Held von Hammerfall', origin: 'Story', description: '', active: true, order: 0 };
	c.modifiers.m2 = { id: 'm2', targetFieldId: 'ruhm', op: 'add', expr: `1 + @[${STD.attrMod('cha')}]`, description: 'Ruhm', source: { kind: 'ability', id: 'held' }, order: 901 };
	c.spells.fb = { id: 'fb', name: 'Feuerball', level: 3, description: 'Bumm.', tags: ['Feuer'] };
	return c;
}

describe('Austausch einzelner Inhalte', () => {
	it('exportiert Items, Fähigkeiten und Zauber samt Modifikatoren und Zählern', () => {
		const file = exportContent(sl(), [
			{ type: 'item', id: 'mantel' },
			{ type: 'ability', id: 'held' },
			{ type: 'spell', id: 'fb' }
		]);
		expect(file.entries.map((e) => e.type)).toEqual(['item', 'ability', 'spell']);
		const item = file.entries[0] as Extract<ContentEntry, { type: 'item' }>;
		expect(item.item).not.toHaveProperty('containerId');
		expect(item.modifiers).toHaveLength(1);
		expect(item.counter?.max).toBe(2);
		const ability = file.entries[1] as Extract<ContentEntry, { type: 'ability' }>;
		expect(ability.fieldNames).toEqual({ ruhm: 'Ruhm', [STD.attrMod('cha')]: 'CHA-Mod' });
	});

	it('Import erzeugt Kopien mit neuer ID; Standardfelder werden automatisch getroffen', () => {
		const file = JSON.parse(JSON.stringify(exportContent(sl(), [{ type: 'item', id: 'mantel' }, { type: 'ability', id: 'held' }, { type: 'spell', id: 'fb' }])));
		const player = createDefaultCharacter('Spieler');
		const plan = planImport(player, readContentFile(file), { containerId: STD.backpack }, ids);

		expect(plan.items[0]).toMatchObject({ name: 'Mantel der Macht', originId: 'mantel', containerId: STD.backpack, requiresAttunement: true });
		expect(plan.items[0].id).not.toBe('mantel');
		expect(plan.counters[0]).toMatchObject({ max: 2, checked: 0 });
		expect(plan.items[0].counterId).toBe(plan.counters[0].id);
		expect(plan.spells[0]).toMatchObject({ name: 'Feuerball', originId: 'fb' });

		const [acMod, ruhmMod] = plan.modifiers;
		expect(acMod).toMatchObject({ targetFieldId: STD.ac, source: { kind: 'item', id: plan.items[0].id } });
		// Eigenes Feld fehlt beim Spieler → nicht zugeordnet, die App legt kein Feld an
		expect(ruhmMod).toMatchObject({ targetFieldId: null, importHint: 'Ruhm', source: { kind: 'ability', id: plan.abilities[0].id } });
		expect(plan.unassigned).toBe(1);
		expect(player.fields.ruhm).toBeUndefined();

		// Eingespielt wirkt der Mantel, sobald er ausgerüstet ist
		for (const i of plan.items) player.items[i.id] = { ...i, containerId: STD.equipped };
		for (const m of plan.modifiers) player.modifiers[m.id] = m;
		for (const a of plan.abilities) player.abilities[a.id] = a;
		const ev = evaluate(player);
		expect(ev.fields[STD.ac].value).toBe(12);
		expect(ev.unassigned).toEqual([ruhmMod.id]);
	});

	it('Aktionen am Item reisen mit und hängen am importierten Item', () => {
		const c = sl();
		c.counters.ak = { id: 'ak', name: 'Nutzungen: Stoß', max: 1, checked: 1, order: 60 };
		c.actions.stoss = { id: 'stoss', name: 'Machtstoß', kind: 'bonus', source: { kind: 'item', id: 'mantel' }, description: 'Weg da!', damage: '1d6', counterId: 'ak', order: 0 };
		c.actions.frei = { id: 'frei', name: 'Frei', kind: 'action', description: '', order: 1 };
		const file = exportContent(c, [{ type: 'item', id: 'mantel' }]);
		const entry = file.entries[0] as Extract<ContentEntry, { type: 'item' }>;
		expect(entry.actions?.map((a) => a.action.name)).toEqual(['Machtstoß']);
		expect(entry.actions?.[0].action).not.toHaveProperty('source');

		const player = createDefaultCharacter();
		const plan = planImport(player, readContentFile(JSON.parse(JSON.stringify(file))), { containerId: STD.backpack }, ids);
		expect(plan.actions).toHaveLength(1);
		expect(plan.actions[0]).toMatchObject({ name: 'Machtstoß', kind: 'bonus', originId: 'stoss', damage: '1d6', source: { kind: 'item', id: plan.items[0].id } });
		const counter = plan.counters.find((x) => x.id === plan.actions[0].counterId);
		expect(counter).toMatchObject({ max: 1, checked: 0 });
	});

	it('erneuter Import erzeugt ein zweites Item', () => {
		const file = exportContent(sl(), [{ type: 'item', id: 'mantel' }]);
		const player = createDefaultCharacter();
		const a = planImport(player, file.entries, { containerId: STD.backpack }, ids);
		for (const i of a.items) player.items[i.id] = i;
		const b = planImport(player, file.entries, { containerId: STD.backpack }, ids);
		expect(b.items[0].id).not.toBe(a.items[0].id);
		expect(b.items[0].originId).toBe(a.items[0].originId);
		expect(b.items[0].order).toBeGreaterThan(a.items[0].order);
	});

	it('Kopie einer Kopie behält die Ursprungs-ID', () => {
		const file = exportContent(sl(), [{ type: 'spell', id: 'fb' }]);
		const p1 = createDefaultCharacter();
		const plan = planImport(p1, file.entries, { containerId: STD.backpack }, ids);
		p1.spells[plan.spells[0].id] = plan.spells[0];
		const again = exportContent(p1, [{ type: 'spell', id: plan.spells[0].id }]);
		expect(planImport(createDefaultCharacter(), again.entries, { containerId: STD.backpack }, ids).spells[0].originId).toBe('fb');
	});

	it('verwirft kaputte Einträge und meldet fremde Dateien', () => {
		expect(() => readContentFile({ foo: 1 })).toThrow(ContentError);
		expect(() => readContentFile({ kind: 'dnd-charakterbogen/content', schemaVersion: 99, entries: [] })).toThrow(/neueren/);
		const entries = readContentFile({
			kind: 'dnd-charakterbogen/content',
			entries: [null, { type: 'item' }, { type: 'spell', spell: { name: 'X', level: 1 } }, { type: 'weird' }]
		});
		expect(entries).toHaveLength(1);
		expect(entries[0]).toMatchObject({ type: 'spell', spell: { tags: [], description: '' } });
	});
});
