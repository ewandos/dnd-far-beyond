// Datenmodell des Charakterbogens. Die Engine kennt keine D&D-Regeln – nur Felder,
// Modifikatoren und Quellen.

export type Id = string;

export const SCHEMA_VERSION = 1;

export interface Character {
	schemaVersion: number;
	id: Id;
	name: string;
	meta: CharacterMeta;
	fields: Record<Id, Field>;
	modifiers: Record<Id, Modifier>;
	items: Record<Id, Item>;
	containers: Record<Id, Container>;
	abilities: Record<Id, Ability>;
	proficiencies: Record<Id, Proficiency>;
	counters: Record<Id, Counter>;
	spells: Record<Id, Spell>;
	spellLists: Record<Id, SpellList>;
	texts: Record<Id, TextNote>;
	layout: Layout;
	history: HistoryEvent[];
}

export interface CharacterMeta {
	createdAt: string;
	updatedAt: string;
	lastExportedAt?: string;
}

export interface Field {
	id: Id; // Standardfelder: feste IDs wie 'std.ac'
	name: string;
	type: 'number'; // später: 'dice' | 'list'
	base: number;
	notes?: string;
	group?: string;
	order: number;
	hidden?: boolean;
	/** Anzeige mit Vorzeichen (+2 / −1), z. B. für Modifikatoren und Fertigkeiten. */
	format?: 'signed';
	/** Basiswert wird gezählt statt eingegeben. Einzige automatische Zählung: Einstimmung. */
	computed?: 'attunedItems';
}

export type Operation = 'add' | 'set' | 'multiply' | 'divide';
export type Rounding = 'floor' | 'ceil' | 'round' | 'none';
export type SourceKind = 'field' | 'item' | 'ability' | 'proficiency';

export interface Modifier {
	id: Id;
	targetFieldId: Id | null; // null = nicht zugeordnet
	op: Operation;
	/** Zahl oder Formel; Referenzen werden als @[fieldId] gespeichert. */
	expr: string;
	/** Nur für Multiplizieren/Teilen. Standard: abrunden. */
	rounding?: Rounding;
	description: string;
	source: { kind: SourceKind; id: Id };
	order: number;
}

export interface Item {
	id: Id;
	originId?: Id;
	name: string;
	description: string;
	notes?: string;
	quantity: number;
	requiresAttunement: boolean;
	containerId: Id;
	order: number;
	counterId?: Id;
}

export interface Container {
	id: Id;
	name: string;
	parentId?: Id;
	equipped: boolean;
	order: number;
}

export type AbilityKind = 'ability' | 'condition';

export interface Ability {
	id: Id;
	originId?: Id;
	kind: AbilityKind;
	name: string;
	origin?: string;
	description: string;
	active: boolean;
	order: number;
	counterId?: Id;
}

export type ProficiencyLevel = 0 | 0.5 | 1 | 2;

export interface Proficiency {
	id: Id;
	fieldId: Id;
	level: ProficiencyLevel;
}

export interface Counter {
	id: Id;
	name: string;
	max: number;
	checked: number;
	order: number;
	group?: string;
}

export interface Spell {
	id: Id;
	originId?: Id;
	name: string;
	level: number;
	school?: string;
	castingTime?: string;
	range?: string;
	components?: string;
	duration?: string;
	description: string;
	tags: string[];
}

export interface SpellList {
	id: Id;
	name: string;
	spellIds: Id[];
	order: number;
}

export interface TextNote {
	id: Id;
	title: string;
	content: string; // Markdown
	order: number;
}

export interface Layout {
	tabs: Tab[];
}

export interface Tab {
	id: Id;
	name: string;
	hidden: boolean;
	order: number;
	blocks: Block[];
}

export interface Block {
	id: Id;
	type: 'field' | 'fieldGroup' | 'counter' | 'container' | 'cardList' | 'text';
	x: number;
	y: number;
	w: number;
	h: number;
	config: Record<string, unknown>;
}

/** Eine einzelne Wertänderung an einem Pfad im Charakter (undefined = Eintrag existiert nicht). */
export interface Patch {
	path: string[];
	before: unknown;
	after: unknown;
}

export interface HistoryEvent {
	id: Id;
	at: string;
	kind: string;
	/** ID des betroffenen Objekts (Feld, Item, Fähigkeit …). */
	target: string;
	/** Lesbare Beschreibung, z. B. „TP aktuell“ oder „Item angelegt: Mantel der Macht“. */
	title: string;
	before: unknown;
	after: unknown;
	patches: Patch[];
}
