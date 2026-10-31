// Alle Änderungen am Charakter laufen über diese Aktionen, damit sie in der Historie landen.

import type {
	Ability,
	AbilityKind,
	Container,
	Counter,
	Field,
	Id,
	Item,
	Modifier,
	Operation,
	ProficiencyLevel,
	Spell,
	SpellList,
	TextNote
} from '$lib/engine/types';
import { formatOp } from '$lib/ui/format';
import { GROUPS } from '$lib/model/defaults';
import { newId } from '$lib/model/ids';
import { current, sheet, type Change } from './sheet.svelte';

const nextOrder = (rec: Record<string, { order: number }>) =>
	Object.values(rec).reduce((m, x) => Math.max(m, x.order), -1) + 1;

const fieldName = (id: Id | null) => (id ? (current().fields[id]?.name ?? '?') : 'nicht zugeordnet');

// ---------------------------------------------------------------------------
// Charakter

export function renameCharacter(name: string) {
	const c = current();
	sheet.commit({
		kind: 'character.name',
		target: c.id,
		title: 'Charaktername',
		before: c.name,
		after: name,
		changes: [{ path: ['name'], value: name }],
		coalesce: true
	});
}

// ---------------------------------------------------------------------------
// Felder

export function setFieldBase(id: Id, value: number) {
	const f = current().fields[id];
	if (!f || !Number.isFinite(value)) return;
	sheet.commit({
		kind: 'field.base',
		target: id,
		title: f.name,
		before: f.base,
		after: value,
		changes: [{ path: ['fields', id, 'base'], value }],
		coalesce: true
	});
}

const FIELD_PROP_TITLES: Partial<Record<keyof Field, string>> = {
	name: 'Feld umbenannt',
	notes: 'Notiz',
	group: 'Gruppe',
	hidden: 'Sichtbarkeit',
	format: 'Anzeige'
};

export function updateField<K extends 'name' | 'notes' | 'group' | 'hidden' | 'format'>(id: Id, key: K, value: Field[K]) {
	const f = current().fields[id];
	if (!f) return;
	sheet.commit({
		kind: `field.${key}`,
		target: id,
		title: key === 'name' ? FIELD_PROP_TITLES.name! : `${f.name}: ${FIELD_PROP_TITLES[key]}`,
		before: f[key],
		after: value,
		changes: [{ path: ['fields', id, key], value: value === '' && key !== 'name' ? undefined : value }],
		coalesce: key === 'name' || key === 'notes'
	});
}

export function addField(input: { name: string; group?: string; base?: number }): Id {
	const c = current();
	const id = newId();
	const field: Field = {
		id,
		name: input.name.trim() || 'Neues Feld',
		type: 'number',
		base: input.base ?? 0,
		group: input.group?.trim() || GROUPS.custom,
		order: nextOrder(c.fields)
	};
	sheet.commit({
		kind: 'field.add',
		target: id,
		title: `Feld angelegt: ${field.name}`,
		changes: [{ path: ['fields', id], value: field }]
	});
	return id;
}

export function deleteField(id: Id) {
	const c = current();
	const f = c.fields[id];
	if (!f) return;
	const changes: Change[] = [{ path: ['fields', id], value: undefined }];
	const profIds = new Set(Object.values(c.proficiencies).filter((p) => p.fieldId === id).map((p) => p.id));
	for (const p of profIds) changes.push({ path: ['proficiencies', p], value: undefined });
	for (const m of Object.values(c.modifiers)) {
		const ownedByField = m.source.kind === 'field' && m.source.id === id;
		const ownedByProf = m.source.kind === 'proficiency' && profIds.has(m.source.id);
		if (ownedByField || ownedByProf) changes.push({ path: ['modifiers', m.id], value: undefined });
		else if (m.targetFieldId === id) changes.push({ path: ['modifiers', m.id, 'targetFieldId'], value: null });
	}
	sheet.commit({ kind: 'field.delete', target: id, title: `Feld gelöscht: ${f.name}`, changes });
}

// ---------------------------------------------------------------------------
// Modifikatoren

export interface NewModifier {
	targetFieldId: Id | null;
	op: Operation;
	expr: string;
	description?: string;
	source: Modifier['source'];
	rounding?: Modifier['rounding'];
}

function buildModifier(input: NewModifier, order: number): Modifier {
	return {
		id: newId(),
		targetFieldId: input.targetFieldId,
		op: input.op,
		expr: input.expr.trim() || '0',
		description: input.description?.trim() ?? '',
		source: input.source,
		order,
		...(input.rounding ? { rounding: input.rounding } : {})
	};
}

export function addModifier(input: NewModifier): Id {
	const c = current();
	const m = buildModifier(input, nextOrder(c.modifiers));
	sheet.commit({
		kind: 'modifier.add',
		target: m.id,
		title: `Modifikator: ${fieldName(m.targetFieldId)} ${formatOp(m.op)} ${m.expr.length > 20 ? '…' : m.expr}`,
		changes: [{ path: ['modifiers', m.id], value: m }]
	});
	return m.id;
}

export function updateModifier(id: Id, patch: Partial<Pick<Modifier, 'targetFieldId' | 'op' | 'expr' | 'description' | 'rounding'>>) {
	const c = current();
	const m = c.modifiers[id];
	if (!m) return;
	const changes: Change[] = Object.entries(patch).map(([k, v]) => ({ path: ['modifiers', id, k], value: v }));
	// Feldeigene Modifikatoren gehören immer zu ihrem Zielfeld.
	if ('targetFieldId' in patch && m.source.kind === 'field' && patch.targetFieldId) {
		changes.push({ path: ['modifiers', id, 'source', 'id'], value: patch.targetFieldId });
	}
	sheet.commit({
		kind: `modifier.${Object.keys(patch).sort().join(',')}`,
		target: id,
		title: `Modifikator geändert: ${m.description || fieldName(m.targetFieldId)}`,
		changes,
		coalesce: true
	});
}

export function deleteModifier(id: Id) {
	const m = current().modifiers[id];
	if (!m) return;
	sheet.commit({
		kind: 'modifier.delete',
		target: id,
		title: `Modifikator gelöscht: ${m.description || fieldName(m.targetFieldId)}`,
		changes: [{ path: ['modifiers', id], value: undefined }]
	});
}

// ---------------------------------------------------------------------------
// Items und Container

export interface QuickModifier {
	targetFieldId: Id;
	op: Operation;
	expr: string;
}

export function addItem(
	input: { name: string; containerId: Id; requiresAttunement?: boolean; description?: string; quantity?: number },
	quickMod?: QuickModifier
): Id {
	const c = current();
	const id = newId();
	const item: Item = {
		id,
		name: input.name.trim() || 'Neues Item',
		description: input.description ?? '',
		quantity: input.quantity ?? 1,
		requiresAttunement: input.requiresAttunement ?? false,
		containerId: input.containerId,
		order: nextOrder(c.items)
	};
	const changes: Change[] = [{ path: ['items', id], value: item }];
	if (quickMod) {
		const m = buildModifier({ ...quickMod, description: item.name, source: { kind: 'item', id } }, nextOrder(c.modifiers));
		changes.push({ path: ['modifiers', m.id], value: m });
	}
	sheet.commit({ kind: 'item.add', target: id, title: `Item angelegt: ${item.name}`, changes });
	return id;
}

export function updateItem<K extends 'name' | 'description' | 'notes' | 'quantity' | 'requiresAttunement'>(
	id: Id,
	key: K,
	value: Item[K]
) {
	const item = current().items[id];
	if (!item) return;
	const titles: Record<string, string> = {
		name: 'Name',
		description: 'Beschreibung',
		notes: 'Notizen',
		quantity: 'Menge',
		requiresAttunement: 'Einstimmung'
	};
	sheet.commit({
		kind: `item.${key}`,
		target: id,
		title: `${item.name}: ${titles[key]}`,
		before: key === 'description' || key === 'notes' ? undefined : item[key],
		after: key === 'description' || key === 'notes' ? undefined : value,
		changes: [{ path: ['items', id, key], value }],
		coalesce: key !== 'requiresAttunement'
	});
}

export function moveItem(id: Id, containerId: Id) {
	const c = current();
	const item = c.items[id];
	const to = c.containers[containerId];
	if (!item || !to || item.containerId === containerId) return;
	const from = c.containers[item.containerId];
	sheet.commit({
		kind: 'item.move',
		target: id,
		title: `${item.name} verschoben`,
		before: from?.name,
		after: to.name,
		changes: [
			{ path: ['items', id, 'containerId'], value: containerId },
			{ path: ['items', id, 'order'], value: nextOrder(c.items) }
		]
	});
}

/** Für den Schalter im Inspektionspanel: zwischen ausgerüstet und nicht ausgerüstet wechseln. */
export function toggleItemEquipped(id: Id) {
	const c = current();
	const item = c.items[id];
	if (!item) return;
	const equipped = c.containers[item.containerId]?.equipped;
	const roots = Object.values(c.containers).sort((a, b) => a.order - b.order);
	const target = roots.find((x) => !x.parentId && x.equipped === !equipped) ?? roots.find((x) => x.equipped === !equipped);
	if (target) moveItem(id, target.id);
}

function sourceCleanup(kind: 'item' | 'ability', id: Id, counterId?: Id): Change[] {
	const c = current();
	const changes: Change[] = [];
	for (const m of Object.values(c.modifiers)) {
		if (m.source.kind === kind && m.source.id === id) changes.push({ path: ['modifiers', m.id], value: undefined });
	}
	if (counterId && c.counters[counterId]) changes.push({ path: ['counters', counterId], value: undefined });
	return changes;
}

export function deleteItem(id: Id) {
	const item = current().items[id];
	if (!item) return;
	sheet.commit({
		kind: 'item.delete',
		target: id,
		title: `Item gelöscht: ${item.name}`,
		changes: [{ path: ['items', id], value: undefined }, ...sourceCleanup('item', id, item.counterId)]
	});
}

export function addContainer(name: string, parentId?: Id): Id {
	const c = current();
	const id = newId();
	const container: Container = {
		id,
		name: name.trim() || 'Neuer Container',
		equipped: false,
		order: nextOrder(c.containers),
		...(parentId ? { parentId } : {})
	};
	sheet.commit({
		kind: 'container.add',
		target: id,
		title: `Container angelegt: ${container.name}`,
		changes: [{ path: ['containers', id], value: container }]
	});
	return id;
}

export function updateContainer<K extends 'name' | 'equipped'>(id: Id, key: K, value: Container[K]) {
	const ct = current().containers[id];
	if (!ct) return;
	sheet.commit({
		kind: `container.${key}`,
		target: id,
		title: key === 'name' ? 'Container umbenannt' : `${ct.name}: ausgerüstet`,
		before: ct[key],
		after: value,
		changes: [{ path: ['containers', id, key], value }],
		coalesce: key === 'name'
	});
}

/** Ist `id` gleich `ancestor` oder liegt darin (beliebig tief)? */
export function isInside(id: Id, ancestor: Id): boolean {
	const c = current();
	const seen = new Set<Id>();
	for (let x: Id | undefined = id; x && !seen.has(x); x = c.containers[x]?.parentId) {
		if (x === ancestor) return true;
		seen.add(x);
	}
	return false;
}

export function moveContainer(id: Id, parentId: Id | undefined) {
	const c = current();
	const ct = c.containers[id];
	if (!ct || ct.parentId === parentId) return;
	if (parentId && isInside(parentId, id)) return; // kein Container in sich selbst
	sheet.commit({
		kind: 'container.move',
		target: id,
		title: `${ct.name} verschoben`,
		before: ct.parentId ? c.containers[ct.parentId]?.name : '—',
		after: parentId ? c.containers[parentId]?.name : '—',
		changes: [
			{ path: ['containers', id, 'parentId'], value: parentId },
			{ path: ['containers', id, 'order'], value: nextOrder(c.containers) }
		]
	});
}

/** Löscht einen Container; Inhalt wandert in den übergeordneten bzw. einen anderen Container. */
export function deleteContainer(id: Id): boolean {
	const c = current();
	const ct = c.containers[id];
	if (!ct) return false;
	const fallback =
		ct.parentId ??
		Object.values(c.containers)
			.filter((x) => x.id !== id && !x.parentId)
			.sort((a, b) => Number(a.equipped) - Number(b.equipped) || a.order - b.order)[0]?.id;
	const hasContent =
		Object.values(c.items).some((i) => i.containerId === id) || Object.values(c.containers).some((x) => x.parentId === id);
	if (hasContent && !fallback) return false;
	const changes: Change[] = [{ path: ['containers', id], value: undefined }];
	for (const i of Object.values(c.items)) {
		if (i.containerId === id) changes.push({ path: ['items', i.id, 'containerId'], value: fallback });
	}
	for (const x of Object.values(c.containers)) {
		if (x.parentId === id) changes.push({ path: ['containers', x.id, 'parentId'], value: ct.parentId });
	}
	sheet.commit({ kind: 'container.delete', target: id, title: `Container gelöscht: ${ct.name}`, changes });
	return true;
}

// ---------------------------------------------------------------------------
// Fähigkeiten und Zustände

export const KIND_LABEL: Record<AbilityKind, string> = { ability: 'Fähigkeit', condition: 'Zustand' };

export function addAbility(
	input: { kind: AbilityKind; name: string; origin?: string; description?: string },
	quickMod?: QuickModifier
): Id {
	const c = current();
	const id = newId();
	const ability: Ability = {
		id,
		kind: input.kind,
		name: input.name.trim() || `Neue ${KIND_LABEL[input.kind]}`,
		description: input.description ?? '',
		active: true,
		order: nextOrder(c.abilities),
		...(input.origin?.trim() ? { origin: input.origin.trim() } : {})
	};
	const changes: Change[] = [{ path: ['abilities', id], value: ability }];
	if (quickMod) {
		const m = buildModifier({ ...quickMod, description: ability.name, source: { kind: 'ability', id } }, nextOrder(c.modifiers));
		changes.push({ path: ['modifiers', m.id], value: m });
	}
	sheet.commit({ kind: 'ability.add', target: id, title: `${KIND_LABEL[ability.kind]} angelegt: ${ability.name}`, changes });
	return id;
}

export function updateAbility<K extends 'name' | 'origin' | 'description' | 'kind'>(id: Id, key: K, value: Ability[K]) {
	const a = current().abilities[id];
	if (!a) return;
	const titles: Record<string, string> = { name: 'Name', origin: 'Herkunft', description: 'Beschreibung', kind: 'Art' };
	sheet.commit({
		kind: `ability.${key}`,
		target: id,
		title: `${a.name}: ${titles[key]}`,
		changes: [{ path: ['abilities', id, key], value: value === '' && key === 'origin' ? undefined : value }],
		coalesce: key !== 'kind'
	});
}

export function setAbilityActive(id: Id, active: boolean) {
	const a = current().abilities[id];
	if (!a || a.active === active) return;
	sheet.commit({
		kind: 'ability.active',
		target: id,
		title: a.name,
		before: a.active ? 'an' : 'aus',
		after: active ? 'an' : 'aus',
		changes: [{ path: ['abilities', id, 'active'], value: active }]
	});
}

export function deleteAbility(id: Id) {
	const a = current().abilities[id];
	if (!a) return;
	sheet.commit({
		kind: 'ability.delete',
		target: id,
		title: `${KIND_LABEL[a.kind]} gelöscht: ${a.name}`,
		changes: [{ path: ['abilities', id], value: undefined }, ...sourceCleanup('ability', id, a.counterId)]
	});
}

// ---------------------------------------------------------------------------
// Übung

export const PROFICIENCY_LABEL: Record<ProficiencyLevel, string> = {
	0: 'keine',
	0.5: 'halb',
	1: 'geübt',
	2: 'Expertise'
};

export function setProficiency(profId: Id, level: ProficiencyLevel) {
	const c = current();
	const p = c.proficiencies[profId];
	if (!p || p.level === level) return;
	sheet.commit({
		kind: 'proficiency.level',
		target: profId,
		title: `Übung ${c.fields[p.fieldId]?.name ?? ''}`.trim(),
		before: PROFICIENCY_LABEL[p.level],
		after: PROFICIENCY_LABEL[level],
		changes: [{ path: ['proficiencies', profId, 'level'], value: level }]
	});
}

/** Übungs-Quelle für ein beliebiges Feld (z. B. eigenes Werkzeug-Feld) anlegen. */
export function addProficiency(fieldId: Id, profFieldId: Id): Id {
	const c = current();
	const id = newId();
	const m = buildModifier(
		{ targetFieldId: fieldId, op: 'add', expr: `@[${profFieldId}]`, description: 'Übung', source: { kind: 'proficiency', id } },
		nextOrder(c.modifiers)
	);
	sheet.commit({
		kind: 'proficiency.add',
		target: id,
		title: `Übungs-Quelle: ${fieldName(fieldId)}`,
		changes: [
			{ path: ['proficiencies', id], value: { id, fieldId, level: 1 } },
			{ path: ['modifiers', m.id], value: m }
		]
	});
	return id;
}

// ---------------------------------------------------------------------------
// Zähler

export function setCounterChecked(id: Id, checked: number) {
	const ct = current().counters[id];
	if (!ct) return;
	const value = Math.max(0, Math.min(ct.max, Math.round(checked)));
	sheet.commit({
		kind: 'counter.checked',
		target: id,
		title: ct.name,
		before: `${ct.checked}/${ct.max}`,
		after: `${value}/${ct.max}`,
		changes: [{ path: ['counters', id, 'checked'], value }],
		coalesce: true
	});
}

export function setCounterMax(id: Id, max: number) {
	const ct = current().counters[id];
	if (!ct) return;
	const value = Math.max(0, Math.min(99, Math.round(max)));
	const changes: Change[] = [{ path: ['counters', id, 'max'], value }];
	if (ct.checked > value) changes.push({ path: ['counters', id, 'checked'], value });
	sheet.commit({
		kind: 'counter.max',
		target: id,
		title: `${ct.name}: Anzahl`,
		before: ct.max,
		after: value,
		changes,
		coalesce: true
	});
}

export function renameCounter(id: Id, name: string) {
	const ct = current().counters[id];
	if (!ct) return;
	sheet.commit({
		kind: 'counter.name',
		target: id,
		title: 'Zähler umbenannt',
		before: ct.name,
		after: name,
		changes: [{ path: ['counters', id, 'name'], value: name }],
		coalesce: true
	});
}

export function addCounter(name: string, max: number, group?: string): Id {
	const c = current();
	const id = newId();
	const counter: Counter = { id, name: name.trim() || 'Neuer Zähler', max, checked: 0, order: nextOrder(c.counters), ...(group ? { group } : {}) };
	sheet.commit({
		kind: 'counter.add',
		target: id,
		title: `Zähler angelegt: ${counter.name}`,
		changes: [{ path: ['counters', id], value: counter }]
	});
	return id;
}

export function deleteCounter(id: Id) {
	const c = current();
	const ct = c.counters[id];
	if (!ct) return;
	const changes: Change[] = [{ path: ['counters', id], value: undefined }];
	for (const a of Object.values(c.abilities)) if (a.counterId === id) changes.push({ path: ['abilities', a.id, 'counterId'], value: undefined });
	for (const i of Object.values(c.items)) if (i.counterId === id) changes.push({ path: ['items', i.id, 'counterId'], value: undefined });
	sheet.commit({ kind: 'counter.delete', target: id, title: `Zähler gelöscht: ${ct.name}`, changes });
}

/** Nutzungs-Kästchen an einer Fähigkeit, einem Zustand oder Item. */
export function addUsageCounter(owner: { kind: 'ability' | 'item'; id: Id }, max: number) {
	const c = current();
	const src = owner.kind === 'ability' ? c.abilities[owner.id] : c.items[owner.id];
	if (!src || src.counterId) return;
	const id = newId();
	const counter: Counter = { id, name: `Nutzungen: ${src.name}`, max, checked: 0, order: nextOrder(c.counters), group: 'Nutzungen' };
	sheet.commit({
		kind: 'counter.add',
		target: id,
		title: `Nutzungs-Kästchen: ${src.name}`,
		changes: [
			{ path: ['counters', id], value: counter },
			{ path: [owner.kind === 'ability' ? 'abilities' : 'items', owner.id, 'counterId'], value: id }
		]
	});
}

// ---------------------------------------------------------------------------
// Texte

export function updateText<K extends 'title' | 'content'>(id: Id, key: K, value: TextNote[K]) {
	const t = current().texts[id];
	if (!t) return;
	sheet.commit({
		kind: `text.${key}`,
		target: id,
		title: key === 'title' ? 'Notiz umbenannt' : `Notiz: ${t.title}`,
		changes: [{ path: ['texts', id, key], value }],
		coalesce: true
	});
}

export function addText(title: string): Id {
	const c = current();
	const id = newId();
	sheet.commit({
		kind: 'text.add',
		target: id,
		title: `Notiz angelegt: ${title}`,
		changes: [{ path: ['texts', id], value: { id, title, content: '', order: nextOrder(c.texts) } }]
	});
	return id;
}

export function deleteText(id: Id) {
	const t = current().texts[id];
	if (!t) return;
	sheet.commit({
		kind: 'text.delete',
		target: id,
		title: `Notiz gelöscht: ${t.title}`,
		changes: [{ path: ['texts', id], value: undefined }]
	});
}

// ---------------------------------------------------------------------------
// Zauber und Zauberlisten

export function spellLevelLabel(level: number): string {
	return level <= 0 ? 'Zaubertrick' : `Grad ${level}`;
}

export function addSpell(input: { name: string; level?: number }, listId?: Id): Id {
	const c = current();
	const id = newId();
	const spell: Spell = {
		id,
		name: input.name.trim() || 'Neuer Zauber',
		level: Math.max(0, Math.min(9, Math.round(input.level ?? 1))),
		description: '',
		tags: []
	};
	const changes: Change[] = [{ path: ['spells', id], value: spell }];
	const list = listId ? c.spellLists[listId] : undefined;
	if (list) changes.push({ path: ['spellLists', list.id, 'spellIds'], value: [...list.spellIds, id] });
	sheet.commit({ kind: 'spell.add', target: id, title: `Zauber angelegt: ${spell.name}`, changes });
	return id;
}

type SpellKey = 'name' | 'level' | 'school' | 'castingTime' | 'range' | 'components' | 'duration' | 'description' | 'tags' | 'concentration' | 'ritual' | 'notes';

export function updateSpell<K extends SpellKey>(id: Id, key: K, value: Spell[K]) {
	const s = current().spells[id];
	if (!s) return;
	const empty = value === '' || value === false;
	sheet.commit({
		kind: `spell.${key}`,
		target: id,
		title: `${s.name}: ${SPELL_PROP_LABEL[key]}`,
		changes: [{ path: ['spells', id, key], value: empty && key !== 'name' && key !== 'description' ? undefined : value }],
		coalesce: key !== 'concentration' && key !== 'ritual'
	});
}

export const SPELL_PROP_LABEL: Record<SpellKey, string> = {
	name: 'Name',
	level: 'Grad',
	school: 'Schule',
	castingTime: 'Zeitaufwand',
	range: 'Reichweite',
	components: 'Komponenten',
	duration: 'Wirkungsdauer',
	description: 'Beschreibung',
	tags: 'Tags',
	concentration: 'Konzentration',
	ritual: 'Ritual',
	notes: 'Notizen'
};

export function deleteSpell(id: Id) {
	const c = current();
	const s = c.spells[id];
	if (!s) return;
	const changes: Change[] = [{ path: ['spells', id], value: undefined }];
	for (const l of Object.values(c.spellLists)) {
		if (l.spellIds.includes(id)) changes.push({ path: ['spellLists', l.id, 'spellIds'], value: l.spellIds.filter((x) => x !== id) });
	}
	sheet.commit({ kind: 'spell.delete', target: id, title: `Zauber gelöscht: ${s.name}`, changes });
}

export function setSpellInList(spellId: Id, listId: Id, inList: boolean) {
	const c = current();
	const l = c.spellLists[listId];
	const s = c.spells[spellId];
	if (!l || !s || l.spellIds.includes(spellId) === inList) return;
	sheet.commit({
		kind: 'spelllist.member',
		target: listId,
		title: `${s.name} ${inList ? '→' : '←'} ${l.name}`,
		changes: [{ path: ['spellLists', listId, 'spellIds'], value: inList ? [...l.spellIds, spellId] : l.spellIds.filter((x) => x !== spellId) }]
	});
}

export function addSpellList(name: string): Id {
	const c = current();
	const id = newId();
	const list: SpellList = { id, name: name.trim() || 'Neue Liste', spellIds: [], order: nextOrder(c.spellLists) };
	sheet.commit({ kind: 'spelllist.add', target: id, title: `Zauberliste angelegt: ${list.name}`, changes: [{ path: ['spellLists', id], value: list }] });
	return id;
}

export function renameSpellList(id: Id, name: string) {
	const l = current().spellLists[id];
	if (!l) return;
	sheet.commit({
		kind: 'spelllist.name',
		target: id,
		title: 'Zauberliste umbenannt',
		before: l.name,
		after: name,
		changes: [{ path: ['spellLists', id, 'name'], value: name }],
		coalesce: true
	});
}

/** Löscht nur die Liste – die Zauber selbst bleiben erhalten. */
export function deleteSpellList(id: Id) {
	const l = current().spellLists[id];
	if (!l) return;
	sheet.commit({ kind: 'spelllist.delete', target: id, title: `Zauberliste gelöscht: ${l.name}`, changes: [{ path: ['spellLists', id], value: undefined }] });
}
