// Standardcharakter: vollständiger 5e-Bogen mit festen Feld-IDs, damit SL-Inhalte
// bei allen Spielern dieselben Felder treffen.

import {
	SCHEMA_VERSION,
	type Block,
	type Character,
	type Container,
	type Counter,
	type Field,
	type Layout,
	type Modifier,
	type SpellList,
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

	const spellLists = defaultSpellLists();

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
		spellLists,
		texts,
		layout: defaultLayout({ texts, spellLists }),
		history: []
	};
}

/** Startlayout: frei veränderbar, gehört zum Charakter und reist mit dem Export. */
export function defaultLayout(c: Pick<Character, 'texts' | 'spellLists'>): Layout {
	let blockN = 0;
	const block = (
		type: Block['type'],
		x: number,
		y: number,
		w: number,
		h: number,
		config: Record<string, unknown>,
		title?: string
	): Block => ({ id: `std.block.${blockN++}`, type, x, y, w, h, config, ...(title ? { title } : {}) });
	const tab = (id: string, name: string, order: number, blocks: Block[]): Tab => ({ id, name, hidden: false, order, blocks });
	const C = STD.counter;
	const lists = Object.values(c.spellLists).sort((a, b) => a.order - b.order);
	const texts = Object.values(c.texts).sort((a, b) => a.order - b.order);

	return {
		tabs: [
			tab('std.tab.overview', 'Übersicht', 0, [
				block('fieldGroup', 0, 0, 3, 8, { group: GROUPS.attributes, display: 'tiles' }),
				block('fieldGroup', 0, 8, 3, 7, { group: GROUPS.saves, display: 'list' }),
				block('fieldGroup', 3, 0, 3, 17, { group: GROUPS.skills, display: 'list' }),
				block('field', 6, 0, 2, 2, { fieldId: STD.ac }),
				block('field', 8, 0, 2, 2, { fieldId: STD.initiative }),
				block('field', 10, 0, 2, 2, { fieldId: STD.speed }),
				block('field', 6, 2, 3, 4, { fieldId: STD.hpCurrent, stepper: true }),
				block('fieldGroup', 9, 2, 3, 4, { fieldIds: [STD.hpMax, STD.hpTemp], display: 'tiles' }, 'Trefferpunkte'),
				block('counter', 6, 6, 4, 5, { counterIds: [C.hitDice, C.deathSuccess, C.deathFailure, C.inspiration] }, 'Zähler'),
				block('field', 10, 6, 2, 2, { fieldId: STD.prof }),
				block('field', 10, 8, 2, 3, { fieldId: STD.passivePerception }),
				block('cardList', 6, 11, 6, 4, { kind: 'condition' }),
				block('cardList', 6, 15, 6, 5, { kind: 'equipped' })
			]),
			tab('std.tab.inventory', 'Inventar', 1, [
				block('fieldGroup', 0, 0, 8, 3, { group: GROUPS.currency, display: 'tiles' }),
				block('field', 8, 0, 2, 3, { fieldId: STD.attuned }),
				block('field', 10, 0, 2, 3, { fieldId: STD.attunementLimit }),
				block('container', 0, 3, 6, 10, { containerId: STD.equipped }),
				block('container', 6, 3, 6, 10, { containerId: STD.backpack })
			]),
			tab('std.tab.abilities', 'Fähigkeiten', 2, [
				block('cardList', 0, 0, 6, 16, { kind: 'ability', showDescriptions: true }),
				block('cardList', 6, 0, 6, 16, { kind: 'condition', showDescriptions: true })
			]),
			tab('std.tab.spells', 'Zauber', 3, [
				block('fieldGroup', 0, 0, 4, 3, { group: GROUPS.magic, display: 'tiles' }),
				block('counter', 0, 3, 4, 6, { group: 'Zauberplätze' }, 'Zauberplätze'),
				...lists.map((l, i) => block('cardList', 4, i * 8, 8, 8, { kind: 'spells', spellListId: l.id }))
			]),
			tab(
				'std.tab.notes',
				'Notizen',
				4,
				texts.map((t, i) => block('text', (i % 2) * 6, Math.floor(i / 2) * 8, 6, 8, { textId: t.id }))
			)
		]
	};
}

export function defaultSpellLists(): Record<string, SpellList> {
	return {
		'std.spelllist.prepared': { id: 'std.spelllist.prepared', name: 'Vorbereitet', spellIds: [], order: 0 },
		'std.spelllist.known': { id: 'std.spelllist.known', name: 'Bekannt', spellIds: [], order: 1 }
	};
}
