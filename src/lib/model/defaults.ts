// Standardcharakter: vollständiger 5e-Bogen mit festen Feld-IDs, damit SL-Inhalte
// bei allen Spielern dieselben Felder treffen.

import {
	SCHEMA_VERSION,
	type Block,
	type Character,
	type Container,
	type Counter,
	type Field,
	type Modifier,
	type Proficiency,
	type Tab,
	type TextNote
} from '../engine/types';
import { newId } from './ids';

export const GROUPS = {
	basics: 'Grundwerte',
	attributes: 'Attribute',
	attributeMods: 'Attributsmodifikatoren',
	saves: 'Rettungswürfe',
	skills: 'Fertigkeiten',
	passive: 'Passive Werte',
	combat: 'Kampf',
	hp: 'Trefferpunkte',
	magic: 'Magie',
	attunement: 'Einstimmung',
	currency: 'Währung',
	custom: 'Eigene Felder'
} as const;

export const ATTRIBUTES = [
	{ key: 'str', name: 'STR', long: 'Stärke' },
	{ key: 'dex', name: 'GES', long: 'Geschicklichkeit' },
	{ key: 'con', name: 'KON', long: 'Konstitution' },
	{ key: 'int', name: 'INT', long: 'Intelligenz' },
	{ key: 'wis', name: 'WEI', long: 'Weisheit' },
	{ key: 'cha', name: 'CHA', long: 'Charisma' }
] as const;

export type AttributeKey = (typeof ATTRIBUTES)[number]['key'];

export const SKILLS: { key: string; name: string; attr: AttributeKey }[] = [
	{ key: 'acrobatics', name: 'Akrobatik', attr: 'dex' },
	{ key: 'arcana', name: 'Arkane Kunde', attr: 'int' },
	{ key: 'athletics', name: 'Athletik', attr: 'str' },
	{ key: 'performance', name: 'Auftreten', attr: 'cha' },
	{ key: 'intimidation', name: 'Einschüchtern', attr: 'cha' },
	{ key: 'sleight_of_hand', name: 'Fingerfertigkeit', attr: 'dex' },
	{ key: 'history', name: 'Geschichte', attr: 'int' },
	{ key: 'medicine', name: 'Heilkunde', attr: 'wis' },
	{ key: 'stealth', name: 'Heimlichkeit', attr: 'dex' },
	{ key: 'animal_handling', name: 'Mit Tieren umgehen', attr: 'wis' },
	{ key: 'insight', name: 'Motiv erkennen', attr: 'wis' },
	{ key: 'investigation', name: 'Nachforschungen', attr: 'int' },
	{ key: 'nature', name: 'Naturkunde', attr: 'int' },
	{ key: 'religion', name: 'Religion', attr: 'int' },
	{ key: 'deception', name: 'Täuschen', attr: 'cha' },
	{ key: 'survival', name: 'Überlebenskunst', attr: 'wis' },
	{ key: 'persuasion', name: 'Überzeugen', attr: 'cha' },
	{ key: 'perception', name: 'Wahrnehmung', attr: 'wis' }
];

/** Feste IDs der Standardfelder. */
export const STD = {
	level: 'std.level',
	prof: 'std.prof',
	attr: (k: AttributeKey) => `std.${k}`,
	attrMod: (k: AttributeKey) => `std.${k}_mod`,
	save: (k: AttributeKey) => `std.save_${k}`,
	skill: (k: string) => `std.skill_${k}`,
	passivePerception: 'std.passive_perception',
	ac: 'std.ac',
	initiative: 'std.initiative',
	speed: 'std.speed',
	hpMax: 'std.hp_max',
	hpCurrent: 'std.hp_current',
	hpTemp: 'std.hp_temp',
	spellAttack: 'std.spell_attack',
	spellDc: 'std.spell_dc',
	attuned: 'std.attuned',
	attunementLimit: 'std.attunement_limit',
	currency: ['std.cp', 'std.sp', 'std.ep', 'std.gp', 'std.pp'],
	equipped: 'std.container.equipped',
	backpack: 'std.container.backpack',
	counter: {
		hitDice: 'std.counter.hit_dice',
		deathSuccess: 'std.counter.death_success',
		deathFailure: 'std.counter.death_failure',
		inspiration: 'std.counter.inspiration',
		spellSlot: (n: number) => `std.counter.spell_slot_${n}`
	}
} as const;

export const ref = (fieldId: string) => `@[${fieldId}]`;

export function createDefaultCharacter(name = 'Neuer Charakter'): Character {
	const now = new Date().toISOString();
	const fields: Record<string, Field> = {};
	const modifiers: Record<string, Modifier> = {};
	const proficiencies: Record<string, Proficiency> = {};
	let order = 0;
	let modOrder = 0;

	const field = (id: string, name: string, group: string, base = 0, extra: Partial<Field> = {}) => {
		fields[id] = { id, name, type: 'number', base, group, order: order++, ...extra };
	};
	const fieldMod = (fieldId: string, op: Modifier['op'], expr: string, description: string) => {
		const id = `std.mod.${fieldId.replace(/^std\./, '')}`;
		modifiers[id] = {
			id,
			targetFieldId: fieldId,
			op,
			expr,
			description,
			source: { kind: 'field', id: fieldId },
			order: modOrder++
		};
	};
	const proficiency = (fieldId: string) => {
		const key = fieldId.replace(/^std\./, '');
		const profId = `std.prof.${key}`;
		proficiencies[profId] = { id: profId, fieldId, level: 0 };
		const modId = `std.mod.prof.${key}`;
		modifiers[modId] = {
			id: modId,
			targetFieldId: fieldId,
			op: 'add',
			expr: ref(STD.prof),
			description: 'Übung',
			source: { kind: 'proficiency', id: profId },
			order: modOrder++
		};
	};

	field(STD.level, 'Stufe', GROUPS.basics, 1);
	field(STD.prof, 'Übungsbonus', GROUPS.basics, 2, { format: 'signed' });

	for (const a of ATTRIBUTES) field(STD.attr(a.key), a.name, GROUPS.attributes, 10, { notes: a.long });
	for (const a of ATTRIBUTES) field(STD.attrMod(a.key), `${a.name}-Mod`, GROUPS.attributeMods, 0, { format: 'signed' });

	for (const a of ATTRIBUTES) {
		const id = STD.save(a.key);
		field(id, `${a.name}-Rettungswurf`, GROUPS.saves, 0, { format: 'signed' });
		fieldMod(id, 'add', ref(STD.attrMod(a.key)), 'Attributsmodifikator');
		proficiency(id);
	}

	for (const s of SKILLS) {
		const id = STD.skill(s.key);
		field(id, s.name, GROUPS.skills, 0, { format: 'signed' });
		fieldMod(id, 'add', ref(STD.attrMod(s.attr)), 'Attributsmodifikator');
		proficiency(id);
	}

	field(STD.passivePerception, 'Passive Wahrnehmung', GROUPS.passive, 10);
	fieldMod(STD.passivePerception, 'set', `10 + ${ref(STD.skill('perception'))}`, '10 + Wahrnehmung');

	field(STD.ac, 'RK', GROUPS.combat, 10, { notes: 'Rüstungsklasse' });
	field(STD.initiative, 'Initiative', GROUPS.combat, 0, { format: 'signed' });
	fieldMod(STD.initiative, 'add', ref(STD.attrMod('dex')), 'Geschicklichkeit');
	field(STD.speed, 'Bewegungsrate', GROUPS.combat, 9, { notes: 'in Metern' });

	field(STD.hpMax, 'TP max', GROUPS.hp, 10);
	field(STD.hpCurrent, 'TP aktuell', GROUPS.hp, 10);
	field(STD.hpTemp, 'Temporäre TP', GROUPS.hp, 0);

	field(STD.spellAttack, 'Zauberangriffsbonus', GROUPS.magic, 0, { format: 'signed' });
	field(STD.spellDc, 'Zauber-SG', GROUPS.magic, 0);
	fieldMod(STD.spellDc, 'set', `8 + ${ref(STD.prof)}`, '8 + Übungsbonus (Attribut selbst ergänzen)');

	field(STD.attuned, 'Eingestimmte Items', GROUPS.attunement, 0, { computed: 'attunedItems' });
	field(STD.attunementLimit, 'Einstimmungslimit', GROUPS.attunement, 3);

	const currencyNames = ['KM', 'SM', 'EM', 'GM', 'PM'];
	const currencyLong = ['Kupfermünzen', 'Silbermünzen', 'Elektrummünzen', 'Goldmünzen', 'Platinmünzen'];
	STD.currency.forEach((id, i) => field(id, currencyNames[i], GROUPS.currency, 0, { notes: currencyLong[i] }));

	const counters: Record<string, Counter> = {};
	let counterOrder = 0;
	const counter = (id: string, name: string, max: number, group?: string) => {
		counters[id] = { id, name, max, checked: 0, order: counterOrder++, group };
	};
	counter(STD.counter.hitDice, 'Trefferwürfel', 1);
	counter(STD.counter.deathSuccess, 'Todesrettungswürfe – Erfolge', 3, 'Todesrettungswürfe');
	counter(STD.counter.deathFailure, 'Todesrettungswürfe – Fehlschläge', 3, 'Todesrettungswürfe');
	counter(STD.counter.inspiration, 'Inspiration', 1);
	for (let n = 1; n <= 9; n++) counter(STD.counter.spellSlot(n), `Zauberplätze Grad ${n}`, 0, 'Zauberplätze');

	const containers: Record<string, Container> = {
		[STD.equipped]: { id: STD.equipped, name: 'Ausgerüstet', equipped: true, order: 0 },
		[STD.backpack]: { id: STD.backpack, name: 'Rucksack', equipped: false, order: 1 }
	};

	const texts: Record<string, TextNote> = {};
	['Hintergrund', 'Beziehungen', 'Notizen'].forEach((title, i) => {
		const id = newId();
		texts[id] = { id, title, content: '', order: i };
	});

	return {
		schemaVersion: SCHEMA_VERSION,
		id: newId(),
		name,
		meta: { createdAt: now, updatedAt: now },
		fields,
		modifiers,
		items: {},
		containers,
		abilities: {},
		proficiencies,
		counters,
		spells: {},
		spellLists: {},
		texts,
		layout: defaultLayout(texts),
		history: []
	};
}

/** Startlayout als Daten. Phase 1 zeigt eine feste Standardansicht, das Layout reist aber schon mit. */
function defaultLayout(texts: Record<string, TextNote>): Character['layout'] {
	let blockN = 0;
	const block = (type: Block['type'], x: number, y: number, w: number, h: number, config: Record<string, unknown>): Block => ({
		id: `std.block.${blockN++}`,
		type,
		x,
		y,
		w,
		h,
		config
	});
	const tab = (id: string, name: string, order: number, blocks: Block[]): Tab => ({ id, name, hidden: false, order, blocks });
	return {
		tabs: [
			tab('std.tab.overview', 'Übersicht', 0, [
				block('fieldGroup', 0, 0, 3, 6, { group: GROUPS.attributes }),
				block('fieldGroup', 3, 0, 3, 6, { group: GROUPS.saves }),
				block('fieldGroup', 3, 6, 3, 10, { group: GROUPS.skills }),
				block('field', 6, 0, 2, 2, { fieldId: STD.ac }),
				block('field', 8, 0, 2, 2, { fieldId: STD.initiative }),
				block('field', 10, 0, 2, 2, { fieldId: STD.speed }),
				block('fieldGroup', 6, 2, 6, 2, { group: GROUPS.hp }),
				block('counter', 6, 4, 3, 2, { counterId: STD.counter.hitDice }),
				block('cardList', 6, 6, 6, 6, { kind: 'condition' })
			]),
			tab('std.tab.inventory', 'Inventar', 1, [
				block('container', 0, 0, 6, 8, { containerId: STD.equipped }),
				block('container', 6, 0, 6, 8, { containerId: STD.backpack }),
				block('fieldGroup', 0, 8, 12, 2, { group: GROUPS.currency })
			]),
			tab('std.tab.abilities', 'Fähigkeiten', 2, [
				block('cardList', 0, 0, 6, 10, { kind: 'ability' }),
				block('cardList', 6, 0, 6, 10, { kind: 'condition' })
			]),
			tab('std.tab.spells', 'Zauber', 3, [block('fieldGroup', 0, 0, 12, 2, { group: GROUPS.magic })]),
			tab(
				'std.tab.notes',
				'Notizen',
				4,
				Object.values(texts).map((t, i) => block('text', (i % 2) * 6, Math.floor(i / 2) * 6, 6, 6, { textId: t.id }))
			)
		]
	};
}
