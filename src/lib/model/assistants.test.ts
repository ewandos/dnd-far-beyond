import { describe, expect, it } from 'vitest';
import { abilityModifier, totalCost } from './pointbuy';
import { parseEquipmentLine, planBackground, type BackgroundInput } from './background';
import { createDefaultCharacter, STD } from './defaults';
import { evaluate } from '../engine/evaluate';

describe('Point-Buy', () => {
	it('berechnet Kosten und markiert Werte außerhalb der Tabelle', () => {
		expect(totalCost([15, 15, 15, 8, 8, 8])).toEqual({ cost: 27, invalid: [] });
		expect(totalCost([15, 14, 13, 12, 10, 8])).toEqual({ cost: 27, invalid: [] });
		expect(totalCost([16, 8, 8, 8, 8, 7])).toEqual({ cost: 0, invalid: [0, 5] });
	});
	it('Modifikator-Vorschlag', () => {
		expect([8, 9, 10, 11, 15, 17, 20].map(abilityModifier)).toEqual([-1, -1, 0, 0, 2, 3, 5]);
	});
});

describe('Hintergrund-Assistent', () => {
	let n = 0;
	const ids = () => `bg${n++}`;
	const input = (patch: Partial<BackgroundInput> = {}): BackgroundInput => ({
		name: 'Akolyth',
		skills: [STD.skill('insight'), STD.skill('religion')],
		tools: '',
		languages: 'Celestisch, Infernalisch',
		increases: [
			{ attr: 'wis', amount: 2 },
			{ attr: 'int', amount: 1 }
		],
		feature: { name: 'Magie-Eingeweihter', description: 'Zwei Zaubertricks.', isFeat: true },
		equipment: 'Heiliges Symbol\n2x Kerze\n- Gebetbuch\nWeihrauch x5\n\n',
		gold: 15,
		story: 'Aufgewachsen im Tempel.',
		...patch
	});

	it('legt Fähigkeiten, Modifikatoren, Übungen, Items und Gold an', () => {
		const c = createDefaultCharacter();
		c.proficiencies['std.prof.skill_religion'].level = 2;
		const plan = planBackground(c, input(), STD.backpack, ids);
		expect(plan.abilities.map((a) => [a.name, a.origin])).toEqual([
			['Akolyth', 'Hintergrund'],
			['Magie-Eingeweihter', 'Talent']
		]);
		expect(plan.abilities[0].description).toContain('**Sprachen:** Celestisch, Infernalisch');
		expect(plan.abilities[0].description).toContain('Motiv erkennen, Religion');
		expect(plan.modifiers.map((m) => [m.targetFieldId, m.expr, m.source.id])).toEqual([
			[STD.attr('wis'), '2', plan.abilities[0].id],
			[STD.attr('int'), '1', plan.abilities[0].id]
		]);
		// Expertise in Religion bleibt erhalten
		expect(plan.proficiencyLevels).toEqual([{ id: 'std.prof.skill_insight', level: 1 }]);
		expect(plan.items.map((i) => [i.name, i.quantity])).toEqual([
			['Heiliges Symbol', 1],
			['Kerze', 2],
			['Gebetbuch', 1],
			['Weihrauch', 5]
		]);
		expect(plan.goldDelta).toBe(15);
		expect(plan.notesAppend?.content).toBe('## Akolyth\n\nAufgewachsen im Tempel.');

		// Eingespielt sind die Erhöhungen nachvollziehbar und abschaltbar
		for (const a of plan.abilities) c.abilities[a.id] = a;
		for (const m of plan.modifiers) c.modifiers[m.id] = m;
		expect(evaluate(c).fields[STD.attr('wis')].value).toBe(12);
		c.abilities[plan.abilities[0].id].active = false;
		expect(evaluate(c).fields[STD.attr('wis')].value).toBe(10);
	});

	it('kommt mit leeren Angaben zurecht', () => {
		const plan = planBackground(createDefaultCharacter(), input({ name: '', skills: [], languages: '', increases: [], feature: { name: '', description: '', isFeat: false }, equipment: '', gold: NaN, story: '' }), STD.backpack, ids);
		expect(plan.abilities).toHaveLength(1);
		expect(plan.abilities[0].name).toBe('Hintergrund');
		expect(plan.items).toEqual([]);
		expect(plan.goldDelta).toBe(0);
		expect(plan.notesAppend).toBeUndefined();
	});

	it('liest Mengenangaben', () => {
		expect(parseEquipmentLine('10 Fackeln')).toEqual({ name: 'Fackeln', quantity: 10 });
		expect(parseEquipmentLine('Seil (15 m)')).toEqual({ name: 'Seil (15 m)', quantity: 1 });
		expect(parseEquipmentLine('3×Pfeil')).toEqual({ name: 'Pfeil', quantity: 3 });
		expect(parseEquipmentLine('   ')).toBeNull();
	});
});
