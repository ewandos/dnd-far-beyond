import { describe, expect, it } from 'vitest';
import { entriesToMarkdown, isFiveToolsData, parseFiveTools, renderTags } from './fivetools';
import { renderMarkdown } from '../ui/markdown';

describe('5eTools-Tags', () => {
	it('macht Inline-Tags lesbar', () => {
		expect(renderTags('Deals {@damage 1d8} damage.')).toBe('Deals 1d8 damage.');
		expect(renderTags('Cast {@spell fireball}.')).toBe('Cast fireball.');
		expect(renderTags('{@item longsword|phb|a sword}')).toBe('a sword');
		expect(renderTags('{@atk mw} {@hit 5} to hit. {@h}{@damage 2d6 + 3}')).toBe('Melee Weapon Attack: +5 to hit. Hit: 2d6 + 3');
		expect(renderTags('a {@dc 15} save, {@chance 25} chance')).toBe('a DC 15 save, 25 % chance');
		expect(renderTags('{@b bold {@i nested}}')).toBe('**bold *nested***');
		expect(renderTags('{@scaledamage 8d6|3-9|1d6}')).toBe('1d6');
		expect(renderTags('{@condition prone|XPHB}')).toBe('prone');
	});
});

describe('5eTools-Einträge → Markdown', () => {
	it('wandelt Absätze, benannte Abschnitte, Listen und Tabellen um', () => {
		const md = entriesToMarkdown([
			'Intro {@b text}.',
			{ type: 'entries', name: 'Lightweight', entries: ['Easy to carry.', 'Second.'] },
			{ type: 'list', items: ['one', { type: 'item', name: 'Two.', entry: 'second' }] },
			{ type: 'table', caption: 'Effects', colLabels: ['d6', 'Effect'], rows: [[{ roll: { min: 1, max: 3 } }, 'Nothing'], ['4', '{@damage 1d4} fire']] },
			{ type: 'inset', name: 'Lore', entries: ['Old tale.'] }
		]);
		expect(md).toContain('Intro **text**.');
		expect(md).toContain('**Lightweight.** Easy to carry.');
		expect(md).toContain('- one\n- **Two.** second');
		expect(md).toContain('| d6 | Effect |\n|---|---|\n| 1–3 | Nothing |\n| 4 | 1d4 fire |');
		expect(md).toContain('> **Lore**');
		const html = renderMarkdown(md);
		expect(html).toContain('<table>');
		expect(html).toContain('<li><strong>Two.</strong> second</li>');
	});
});

describe('5eTools-Dateien', () => {
	it('erkennt das Format', () => {
		expect(isFiveToolsData({ spell: [] })).toBe(true);
		expect(isFiveToolsData({ kind: 'dnd-charakterbogen/content' })).toBe(false);
		expect(isFiveToolsData([])).toBe(false);
	});

	it('übersetzt Zauber', () => {
		const [e] = parseFiveTools({
			spell: [
				{
					name: 'Fireball',
					source: 'PHB',
					page: 241,
					level: 3,
					school: 'V',
					time: [{ number: 1, unit: 'action' }],
					range: { type: 'point', distance: { type: 'feet', amount: 150 } },
					components: { v: true, s: true, m: 'a tiny ball of bat guano and sulfur' },
					duration: [{ type: 'instant' }],
					entries: ['A bright streak... {@damage 8d6} fire damage.'],
					entriesHigherLevel: [{ type: 'entries', name: 'At Higher Levels', entries: ['+{@scaledamage 8d6|3-9|1d6} per slot level.'] }]
				},
				{
					name: 'Bless',
					source: 'PHB',
					level: 1,
					school: 'E',
					time: [{ number: 1, unit: 'action' }],
					range: { type: 'point', distance: { type: 'feet', amount: 30 } },
					components: { v: true, s: true, m: { text: 'a sprinkling of holy water' } },
					duration: [{ type: 'timed', duration: { type: 'minute', amount: 1 }, concentration: true }],
					meta: { ritual: false },
					entries: ['You bless up to three creatures.']
				}
			]
		});
		expect(e).toMatchObject({
			type: 'spell',
			spell: {
				name: 'Fireball',
				level: 3,
				school: 'Hervorrufung',
				castingTime: '1 action',
				range: '150 feet',
				components: 'V, S, M (a tiny ball of bat guano and sulfur)',
				duration: 'Instantaneous',
				tags: ['PHB']
			}
		});
		if (e.type !== 'spell') throw new Error();
		expect(e.spell.description).toContain('8d6 fire damage');
		expect(e.spell.description).toContain('**At Higher Levels.** +1d6 per slot level.');
		expect(e.spell.description).toContain('*Quelle: PHB, S. 241*');
		const bless = parseFiveTools({ spell: [{ name: 'Bless', level: 1, duration: [{ type: 'timed', duration: { type: 'minute', amount: 1 }, concentration: true }], components: { m: { text: 'holy water' } } }] })[0];
		expect(bless).toMatchObject({ spell: { concentration: true, duration: 'Concentration, up to 1 minute', components: 'M (holy water)' } });
	});

	it('übersetzt Items und Talente ohne Modifikatoren', () => {
		const entries = parseFiveTools({
			item: [
				{ name: 'Cloak of Protection', source: 'DMG', wondrous: true, rarity: 'uncommon', reqAttune: true, entries: ['You gain a +1 bonus to AC and saving throws.'] },
				{ name: 'Longsword', source: 'PHB', type: 'M', rarity: 'none', dmg1: '1d8', dmgType: 'S', dmg2: '1d10', property: ['V'] }
			],
			magicvariant: [{ name: '+1 Weapon', type: 'GV', inherits: { rarity: 'uncommon', bonusWeapon: '+1', entries: ['You have a +1 bonus.'] } }],
			feat: [{ name: 'Alert', source: 'PHB', prerequisite: [{ level: 4 }], entries: ['Always on the lookout.', { type: 'list', items: ['You gain +5 to initiative.'] }] }]
		});
		expect(entries.map((e) => e.type)).toEqual(['item', 'item', 'item', 'ability']);
		const [cloak, sword, variant, alert] = entries;
		if (cloak.type !== 'item' || sword.type !== 'item' || variant.type !== 'item' || alert.type !== 'ability') throw new Error();
		expect(cloak.item.requiresAttunement).toBe(true);
		expect(cloak.item.description).toMatch(/^\*Wondrous item, uncommon \(requires attunement\)\*/);
		expect(cloak.modifiers).toEqual([]);
		expect(sword.item.description).toContain('Damage: 1d8 slashing (versatile 1d10)');
		expect(sword.actions?.[0].action).toMatchObject({ name: 'Angriff: Longsword', kind: 'action', damage: '1d8', damageType: 'slashing' });
		expect(sword.actions?.[0].action.attack).toBeUndefined();
		expect(cloak.actions).toBeUndefined();
		expect(variant.item.description).toContain('+1 to attack and damage rolls');
		expect(variant.item.description).toContain('You have a +1 bonus.');
		expect(alert.ability).toMatchObject({ name: 'Alert', origin: 'Talent', kind: 'ability' });
		expect(alert.ability.description).toContain('*Prerequisite: Level 4*');
		expect(alert.ability.description).toContain('- You gain +5 to initiative.');
	});
});
