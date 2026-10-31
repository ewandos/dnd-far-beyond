// 5eTools-Import: Items, Zauber und Talente aus 5eTools-JSON in das interne Format übersetzen.
// Verschachtelte `entries` werden zu Markdown, Inline-Tags wie {@damage 1d8} zu lesbarem Text.
// Mechanische Angaben werden bewusst NICHT zu Modifikatoren – das trägt der Spieler selbst ein.

import type { Spell } from '../engine/types';
import type { ContentEntry } from './content';

type Json = Record<string, unknown>;

export function isFiveToolsData(data: unknown): boolean {
	if (!data || typeof data !== 'object' || Array.isArray(data)) return false;
	const d = data as Json;
	return ['spell', 'item', 'baseitem', 'feat', 'magicvariant'].some((k) => Array.isArray(d[k]));
}

// ---------------------------------------------------------------------------
// Inline-Tags

const ATTACK: Record<string, string> = {
	mw: 'Melee Weapon Attack:',
	rw: 'Ranged Weapon Attack:',
	'mw,rw': 'Melee or Ranged Weapon Attack:',
	ms: 'Melee Spell Attack:',
	rs: 'Ranged Spell Attack:',
	'ms,rs': 'Melee or Ranged Spell Attack:',
	m: 'Melee Attack:',
	r: 'Ranged Attack:'
};

function renderTag(tag: string, body: string): string {
	const parts = body.split('|');
	const first = parts[0].trim();
	switch (tag) {
		case 'b':
		case 'bold':
			return `**${body}**`;
		case 'i':
		case 'italic':
			return `*${body}*`;
		case 's':
		case 'strike':
		case 'u':
		case 'underline':
		case 'note':
		case 'code':
			return body;
		case 'hit':
			return /^[-+]/.test(first) ? first : `+${first}`;
		case 'h':
			return 'Hit: ';
		case 'm':
			return 'Miss: ';
		case 'dc':
			return `DC ${first}`;
		case 'chance':
			return parts[1]?.trim() || `${first} %`;
		case 'recharge':
			return first ? `(Recharge ${first}–6)` : '(Recharge 6)';
		case 'atk':
		case 'atkr':
			return ATTACK[first] ?? 'Attack:';
		case 'scaledamage':
		case 'scaledice':
			return parts[parts.length - 1]?.trim() || first;
		case 'damage':
		case 'dice':
		case 'd20':
		case 'autodice':
			return parts[1]?.trim() || first;
		case 'filter':
			return first;
		default:
			// {@spell fireball|phb|Feuerball}: Anzeigetext ist der dritte Teil, sonst der erste.
			return parts[2]?.trim() || first;
	}
}

/** Ersetzt verschachtelte Tags von innen nach außen. */
export function renderTags(text: string): string {
	let s = text;
	for (let guard = 0; guard < 20; guard++) {
		const next = s.replace(/\{@(\w+)\s?([^{}]*)\}/g, (_, tag: string, body: string) => renderTag(tag.toLowerCase(), body));
		if (next === s) break;
		s = next;
	}
	return s;
}

// ---------------------------------------------------------------------------
// Einträge → Markdown

function cell(v: unknown): string {
	if (typeof v === 'string' || typeof v === 'number') return renderTags(String(v)).replace(/\|/g, '/');
	if (v && typeof v === 'object') {
		const o = v as Json;
		if (o.roll && typeof o.roll === 'object') {
			const r = o.roll as Json;
			if (r.exact !== undefined) return String(r.exact);
			return `${r.min ?? ''}–${r.max ?? ''}`;
		}
		if ('entry' in o) return cell(o.entry);
		if (Array.isArray(o.entries)) return o.entries.map(cell).join(' ');
	}
	return '';
}

function entryToMd(e: unknown, depth: number): string[] {
	if (e === null || e === undefined) return [];
	if (typeof e === 'string' || typeof e === 'number') return [renderTags(String(e))];
	if (Array.isArray(e)) return e.flatMap((x) => entryToMd(x, depth));
	if (typeof e !== 'object') return [];
	const o = e as Json;
	const name = typeof o.name === 'string' ? renderTags(o.name) : '';
	const children = (key: 'entries' | 'items') => (Array.isArray(o[key]) ? (o[key] as unknown[]) : []);

	switch (o.type) {
		case 'list': {
			const lines = children('items').map((it) => {
				if (it && typeof it === 'object' && !Array.isArray(it)) {
					const io = it as Json;
					const label = typeof io.name === 'string' ? `**${renderTags(io.name)}** ` : '';
					const body = [...entryToMd(io.entry, depth + 1), ...entryToMd(io.entries, depth + 1)].join(' ');
					return `- ${label}${body}`.trim();
				}
				return `- ${entryToMd(it, depth + 1).join(' ')}`;
			});
			return [lines.join('\n')];
		}
		case 'table': {
			const labels = Array.isArray(o.colLabels) ? (o.colLabels as unknown[]).map(cell) : [];
			const rows = Array.isArray(o.rows) ? (o.rows as unknown[][]).filter(Array.isArray).map((r) => r.map(cell)) : [];
			const width = Math.max(labels.length, ...rows.map((r) => r.length), 1);
			const head = labels.length ? labels : Array.from({ length: width }, () => '');
			const out: string[] = [];
			if (typeof o.caption === 'string') out.push(`**${renderTags(o.caption)}**`);
			out.push(
				[`| ${head.join(' | ')} |`, `|${head.map(() => '---').join('|')}|`, ...rows.map((r) => `| ${r.join(' | ')} |`)].join('\n')
			);
			return out;
		}
		case 'inset':
		case 'insetReadaloud':
		case 'quote': {
			const inner = [...(name ? [`**${name}**`] : []), ...children('entries').flatMap((x) => entryToMd(x, depth + 1))];
			if (o.type === 'quote' && typeof o.by === 'string') inner.push(`— ${renderTags(o.by)}`);
			return [inner.map((p) => p.split('\n').map((l) => `> ${l}`).join('\n')).join('\n>\n')];
		}
		case 'item':
			return [`**${name}** ${[...entryToMd(o.entry, depth), ...entryToMd(o.entries, depth)].join(' ')}`.trim()];
		case 'abilityDc':
			return [`**${name} save DC** = 8 + proficiency bonus + ${Array.isArray(o.attributes) ? o.attributes.join('/') : ''} modifier`];
		case 'abilityAttackMod':
			return [`**${name} attack modifier** = proficiency bonus + ${Array.isArray(o.attributes) ? o.attributes.join('/') : ''} modifier`];
		default: {
			// 'entries', 'section', 'inline', unbekannte Typen mit Unterinhalten
			const body = children('entries').flatMap((x) => entryToMd(x, depth + 1));
			if (o.type === 'inline' || o.type === 'inlineBlock') return [body.join('')];
			if (!name) return body;
			if (depth <= 0) return [`### ${name}`, ...body];
			// Benannte Unterabschnitte wie im Regelwerk: „**Name.** Text“
			const [firstPara, ...rest] = body;
			const lead = `**${name.replace(/\.$/, '')}.**`;
			return firstPara !== undefined ? [`${lead} ${firstPara}`, ...rest] : [lead];
		}
	}
}

export function entriesToMarkdown(entries: unknown): string {
	return entryToMd(entries, 1).filter((p) => p.trim()).join('\n\n');
}

// ---------------------------------------------------------------------------
// Zauber

const SCHOOLS: Record<string, string> = {
	A: 'Bannmagie',
	C: 'Beschwörung',
	D: 'Erkenntnismagie',
	E: 'Verzauberung',
	V: 'Hervorrufung',
	I: 'Illusion',
	N: 'Nekromantie',
	T: 'Verwandlung',
	P: 'Psionik'
};

const plural = (n: number, unit: string) => `${n} ${unit}${n === 1 ? '' : 's'}`;

function spellTime(t: unknown): string {
	if (!Array.isArray(t)) return '';
	return t
		.map((x: Json) => {
			const unit = String(x.unit ?? '');
			const label = unit === 'bonus' ? 'bonus action' : unit;
			const base = plural(Number(x.number ?? 1), label);
			return typeof x.condition === 'string' ? `${base}, ${renderTags(x.condition)}` : base;
		})
		.join(' or ');
}

function distance(d: Json | undefined): string {
	if (!d) return '';
	const type = String(d.type ?? '');
	if (['self', 'touch', 'sight', 'unlimited'].includes(type)) return type[0].toUpperCase() + type.slice(1);
	if (d.amount !== undefined) return `${d.amount} ${type === 'feet' ? 'feet' : type === 'miles' ? (d.amount === 1 ? 'mile' : 'miles') : type}`;
	return type;
}

function spellRange(r: unknown): string {
	if (!r || typeof r !== 'object') return '';
	const o = r as Json;
	const dist = distance(o.distance as Json | undefined);
	switch (o.type) {
		case 'point':
			return dist;
		case 'special':
			return 'Special';
		case 'radius':
		case 'sphere':
		case 'cone':
		case 'line':
		case 'cube':
		case 'hemisphere':
		case 'emanation':
			return `Self (${dist.replace(' feet', '-foot')} ${o.type})`;
		default:
			return dist || String(o.type ?? '');
	}
}

function spellComponents(c: unknown): string {
	if (!c || typeof c !== 'object') return '';
	const o = c as Json;
	const parts: string[] = [];
	if (o.v) parts.push('V');
	if (o.s) parts.push('S');
	if (o.m) {
		const m = typeof o.m === 'string' ? o.m : typeof o.m === 'object' && o.m && typeof (o.m as Json).text === 'string' ? ((o.m as Json).text as string) : '';
		parts.push(m ? `M (${renderTags(m)})` : 'M');
	}
	return parts.join(', ');
}

function spellDuration(d: unknown): { text: string; concentration: boolean } {
	if (!Array.isArray(d)) return { text: '', concentration: false };
	let concentration = false;
	const text = d
		.map((x: Json) => {
			switch (x.type) {
				case 'instant':
					return 'Instantaneous';
				case 'permanent': {
					const ends = Array.isArray(x.ends) ? ` (until ${(x.ends as string[]).join(' or ')})` : '';
					return `Until dispelled${ends}`;
				}
				case 'special':
					return 'Special';
				case 'timed': {
					const dur = (x.duration ?? {}) as Json;
					const t = plural(Number(dur.amount ?? 1), String(dur.type ?? ''));
					if (x.concentration) {
						concentration = true;
						return `Concentration, up to ${t}`;
					}
					return `${dur.upTo ? 'Up to ' : ''}${t}`;
				}
				default:
					return String(x.type ?? '');
			}
		})
		.join(' or ');
	return { text, concentration };
}

function convertSpell(s: Json): ContentEntry {
	const dur = spellDuration(s.duration);
	const higher = Array.isArray(s.entriesHigherLevel) ? '\n\n' + entriesToMarkdown(s.entriesHigherLevel) : '';
	const meta = (s.meta ?? {}) as Json;
	const spell: Spell = {
		id: `5et:spell:${s.name}|${s.source ?? ''}`,
		name: String(s.name),
		level: Number(s.level ?? 0),
		school: SCHOOLS[String(s.school ?? '')] ?? (s.school ? String(s.school) : undefined),
		castingTime: spellTime(s.time) || undefined,
		range: spellRange(s.range) || undefined,
		components: spellComponents(s.components) || undefined,
		duration: dur.text || undefined,
		description: (entriesToMarkdown(s.entries) + higher).trim() + sourceLine(s),
		tags: typeof s.source === 'string' ? [s.source] : [],
		...(dur.concentration ? { concentration: true } : {}),
		...(meta.ritual ? { ritual: true } : {})
	};
	for (const k of ['school', 'castingTime', 'range', 'components', 'duration'] as const) if (spell[k] === undefined) delete spell[k];
	return { type: 'spell', spell };
}

// ---------------------------------------------------------------------------
// Items

const ITEM_TYPES: Record<string, string> = {
	M: 'Melee weapon',
	R: 'Ranged weapon',
	A: 'Ammunition',
	AF: 'Ammunition',
	LA: 'Light armor',
	MA: 'Medium armor',
	HA: 'Heavy armor',
	S: 'Shield',
	RG: 'Ring',
	RD: 'Rod',
	WD: 'Wand',
	SC: 'Scroll',
	P: 'Potion',
	G: 'Adventuring gear',
	AT: "Artisan's tools",
	T: 'Tools',
	GS: 'Gaming set',
	INS: 'Instrument',
	SCF: 'Spellcasting focus',
	TAH: 'Tack and harness',
	TG: 'Trade good',
	MNT: 'Mount',
	VEH: 'Vehicle',
	SHP: 'Ship',
	FD: 'Food and drink',
	$: 'Treasure',
	EXP: 'Explosive',
	OTH: 'Other'
};

const DAMAGE: Record<string, string> = {
	A: 'acid',
	B: 'bludgeoning',
	C: 'cold',
	F: 'fire',
	O: 'force',
	L: 'lightning',
	N: 'necrotic',
	P: 'piercing',
	I: 'poison',
	Y: 'psychic',
	R: 'radiant',
	S: 'slashing',
	T: 'thunder'
};

const stripSource = (v: unknown) => String(v ?? '').split('|')[0];

function sourceLine(o: Json): string {
	if (typeof o.source !== 'string') return '';
	return `\n\n*Quelle: ${o.source}${o.page ? `, S. ${o.page}` : ''}*`;
}

function convertItem(raw: Json): ContentEntry {
	// Magische Varianten (magicvariant) tragen ihre Angaben in `inherits`.
	const inherits = raw.inherits && typeof raw.inherits === 'object' ? (raw.inherits as Json) : null;
	const it: Json = inherits ? { ...raw, ...inherits, name: raw.name, type: raw.type } : raw;
	const type = stripSource(it.type);
	const kind = it.wondrous ? 'Wondrous item' : (ITEM_TYPES[type] ?? (it.staff ? 'Staff' : it.weapon ? 'Weapon' : it.armor ? 'Armor' : 'Item'));
	const rarity = typeof it.rarity === 'string' && !['none', 'unknown'].includes(it.rarity) ? it.rarity : '';
	const attune = it.reqAttune === true ? 'requires attunement' : typeof it.reqAttune === 'string' ? `requires attunement ${it.reqAttune}` : '';
	const headline = [kind, rarity].filter(Boolean).join(', ') + (attune ? ` (${attune})` : '');

	const stats: string[] = [];
	if (it.dmg1) stats.push(`Damage: ${it.dmg1}${it.dmgType ? ` ${DAMAGE[String(it.dmgType)] ?? it.dmgType}` : ''}${it.dmg2 ? ` (versatile ${it.dmg2})` : ''}`);
	if (it.ac !== undefined) stats.push(`AC ${it.ac}`);
	if (it.range) stats.push(`Range ${it.range} ft.`);
	if (it.bonusWeapon) stats.push(`${it.bonusWeapon} to attack and damage rolls`);
	if (it.bonusAc) stats.push(`${it.bonusAc} AC`);
	if (it.bonusSpellAttack) stats.push(`${it.bonusSpellAttack} spell attack rolls`);
	if (Array.isArray(it.property) && it.property.length) stats.push(`Properties: ${(it.property as unknown[]).map((p) => stripSource(typeof p === 'object' && p ? (p as Json).uid : p)).join(', ')}`);
	if (it.value !== undefined) stats.push(`Value: ${Number(it.value) / 100} gp`);

	const parts = [`*${headline}*`];
	if (stats.length) parts.push(stats.join(' · '));
	const body = entriesToMarkdown([...(Array.isArray(it.entries) ? it.entries : []), ...(Array.isArray(it.additionalEntries) ? it.additionalEntries : [])]);
	if (body) parts.push(body);
	if (it._copy) parts.push('*Hinweis: In 5eTools eine Variante eines anderen Eintrags – Details ggf. aus dem Original ergänzen.*');

	return {
		type: 'item',
		item: {
			id: `5et:item:${it.name}|${it.source ?? ''}`,
			name: String(it.name),
			description: parts.join('\n\n') + sourceLine(it),
			quantity: 1,
			requiresAttunement: !!it.reqAttune
		},
		modifiers: [],
		fieldNames: {}
	};
}

// ---------------------------------------------------------------------------
// Talente

function prerequisite(p: unknown): string {
	if (!Array.isArray(p)) return '';
	const alt = p.map((x: Json) => {
		const out: string[] = [];
		if (x.level) out.push(`Level ${typeof x.level === 'object' ? (x.level as Json).level : x.level}`);
		if (Array.isArray(x.race)) out.push((x.race as Json[]).map((r) => [r.name, r.subrace].filter(Boolean).join(' ')).join(' or '));
		if (Array.isArray(x.ability)) out.push((x.ability as Json[]).map((a) => Object.entries(a).map(([k, v]) => `${k.toUpperCase()} ${v}`).join(' or ')).join(', '));
		if (x.spellcasting || x.spellcasting2020) out.push('Spellcasting or Pact Magic feature');
		if (Array.isArray(x.proficiency)) out.push('Proficiency: ' + (x.proficiency as Json[]).map((pr) => Object.entries(pr).map(([k, v]) => `${v} ${k}`).join(', ')).join(' or '));
		if (typeof x.other === 'string') out.push(renderTags(x.other));
		if (Array.isArray(x.feat)) out.push((x.feat as string[]).map((f) => stripSource(f)).join(' or '));
		return out.join(', ');
	});
	return alt.filter(Boolean).join('; or ');
}

function convertFeat(f: Json): ContentEntry {
	const pre = prerequisite(f.prerequisite);
	const parts: string[] = [];
	if (pre) parts.push(`*Prerequisite: ${pre}*`);
	const body = entriesToMarkdown(f.entries);
	if (body) parts.push(body);
	return {
		type: 'ability',
		ability: {
			id: `5et:feat:${f.name}|${f.source ?? ''}`,
			kind: 'ability',
			name: String(f.name),
			origin: 'Talent',
			description: parts.join('\n\n') + sourceLine(f),
			active: true
		},
		modifiers: [],
		fieldNames: {}
	};
}

/** Liest eine 5eTools-Datei; unterstützt `spell`, `item`, `baseitem`, `magicvariant` und `feat`. */
export function parseFiveTools(data: unknown): ContentEntry[] {
	if (!isFiveToolsData(data)) return [];
	const d = data as Json;
	const list = (k: string) => (Array.isArray(d[k]) ? (d[k] as Json[]).filter((x) => x && typeof x.name === 'string') : []);
	const out: ContentEntry[] = [];
	for (const s of list('spell')) out.push(convertSpell(s));
	for (const it of [...list('item'), ...list('baseitem'), ...list('magicvariant')]) out.push(convertItem(it));
	for (const f of list('feat')) out.push(convertFeat(f));
	return out;
}
