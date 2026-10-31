import { describe, expect, it } from 'vitest';
import { collectActions, economyFromCastingTime } from './actions';
import { evaluate } from './evaluate';
import { createDefaultCharacter, STD, ref } from '../model/defaults';
import type { Character } from './types';

function sheet(): Character {
	const c = createDefaultCharacter();
	c.fields[STD.attrMod('str')].base = 3;
	c.items.schwert = { id: 'schwert', name: 'Langschwert', description: '', quantity: 1, requiresAttunement: false, containerId: STD.equipped, order: 0 };
	c.actions.hieb = {
		id: 'hieb',
		name: 'Angriff: Langschwert',
		kind: 'action',
		source: { kind: 'item', id: 'schwert' },
		description: '',
		attack: `${ref(STD.attrMod('str'))} + ${ref(STD.prof)}`,
		damage: `1d8 + ${ref(STD.attrMod('str'))}`,
		damageType: 'Hieb',
		order: 100
	};
	c.abilities.zweite = { id: 'zweite', kind: 'ability', name: 'Zweite Luft', description: '', active: true, order: 0 };
	c.actions.luft = { id: 'luft', name: 'Zweite Luft', kind: 'bonus', source: { kind: 'ability', id: 'zweite' }, description: '', damage: '1d10 + @[std.level]', order: 101 };
	c.spells.fb = { id: 'fb', name: 'Feuerball', level: 3, castingTime: '1 Aktion', description: '', tags: [], stats: { damage: '8d6', damageType: 'Feuer', saveDc: ref(STD.spellDc), saveAbility: 'GES' } };
	c.spells.schild = { id: 'schild', name: 'Schild', level: 1, castingTime: '1 reaction, which you take when you are hit', description: '', tags: [] };
	c.spells.ritual = { id: 'ritual', name: 'Magie entdecken', level: 1, castingTime: '1 Aktion', description: '', tags: [], economy: 'none' };
	c.spellLists['std.spelllist.prepared'].spellIds = ['fb', 'schild', 'ritual'];
	return c;
}

describe('Aktionsübersicht', () => {
	it('leitet die Art aus dem Zeitaufwand ab', () => {
		expect(economyFromCastingTime('1 Aktion')).toBe('action');
		expect(economyFromCastingTime('1 action')).toBe('action');
		expect(economyFromCastingTime('1 Bonusaktion')).toBe('bonus');
		expect(economyFromCastingTime('1 bonus action')).toBe('bonus');
		expect(economyFromCastingTime('1 Reaktion, wenn du getroffen wirst')).toBe('reaction');
		expect(economyFromCastingTime('1 minute')).toBe('other');
		expect(economyFromCastingTime(undefined)).toBe('other');
	});

	it('sammelt Aktionen aus Items, Fähigkeiten und Zaubern und löst Formeln auf', () => {
		const c = sheet();
		const views = collectActions(c, evaluate(c), { spellListIds: ['std.spelllist.prepared'] });
		const by = Object.fromEntries(views.map((v) => [v.key, v]));
		expect(by.hieb).toMatchObject({ kind: 'action', active: true, attack: { text: '+5' }, damage: { text: '1d8 + 3' }, damageType: 'Hieb', origin: { kind: 'item', name: 'Langschwert' } });
		expect(by.luft).toMatchObject({ kind: 'bonus', damage: { text: '1d10 + 1' } });
		expect(by['spell:fb']).toMatchObject({ kind: 'action', spellLevel: 3, damage: { text: '8d6' }, save: { text: 'SG 10 GES' } });
		expect(by['spell:schild']).toMatchObject({ kind: 'reaction' });
		expect(by['spell:ritual']).toBeUndefined();
		// Reihenfolge: nach Art, Standardaktionen hinter den eigenen
		const kinds = views.map((v) => v.kind);
		expect(kinds.indexOf('bonus')).toBeGreaterThan(kinds.lastIndexOf('action'));
		const actions = views.filter((v) => v.kind === 'action');
		expect(actions[0].standard).toBe(false);
		expect(actions[actions.length - 1].standard).toBe(true);
	});

	it('Aktionen inaktiver Quellen sind markiert, nicht verschwunden', () => {
		const c = sheet();
		c.items.schwert.containerId = STD.backpack;
		c.abilities.zweite.active = false;
		const views = collectActions(c, evaluate(c));
		expect(views.find((v) => v.key === 'hieb')).toMatchObject({ active: false, inactiveReason: 'nicht ausgerüstet (in „Rucksack“)' });
		expect(views.find((v) => v.key === 'luft')).toMatchObject({ active: false, inactiveReason: 'Fähigkeit aus' });
		expect(views.some((v) => v.key.startsWith('spell:'))).toBe(false);
	});

	it('meldet fehlerhafte Formeln, statt abzustürzen', () => {
		const c = sheet();
		c.actions.hieb.attack = '@[gibtsnicht] +';
		c.actions.hieb.damage = '2 * 1d6';
		const v = collectActions(c, evaluate(c)).find((x) => x.key === 'hieb')!;
		expect(v.attack).toMatchObject({ text: '?' });
		expect(v.damage?.error).toContain('Würfel nur als Summand');
	});
});
