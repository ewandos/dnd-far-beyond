// Einlesen und Migrieren von Charakter-Dateien.

import { SCHEMA_VERSION, type Character } from '../engine/types';

export class ImportError extends Error {}

type Raw = Record<string, unknown>;

/** Migrationen von Version n auf n + 1. Index = Ausgangsversion. */
const MIGRATIONS: Record<number, (raw: Raw) => Raw> = {
	// 1: (raw) => ({ ...raw, schemaVersion: 2, ... })
};

const RECORDS = [
	'fields',
	'modifiers',
	'items',
	'containers',
	'abilities',
	'proficiencies',
	'counters',
	'spells',
	'spellLists',
	'texts'
] as const;

export function migrateCharacter(input: unknown): Character {
	if (!input || typeof input !== 'object' || Array.isArray(input)) {
		throw new ImportError('Die Datei enthält keinen Charakter.');
	}
	let raw = input as Raw;
	if (raw.kind === 'dnd-charakterbogen/character' && raw.character) raw = raw.character as Raw;

	let version = typeof raw.schemaVersion === 'number' ? raw.schemaVersion : 0;
	if (version > SCHEMA_VERSION) {
		throw new ImportError(
			`Die Datei stammt aus einer neueren App-Version (Schema ${version}). Bitte die App aktualisieren.`
		);
	}
	if (typeof raw.id !== 'string' || typeof raw.fields !== 'object' || raw.fields === null) {
		throw new ImportError('Die Datei ist kein gültiger Charakterbogen.');
	}
	while (version < SCHEMA_VERSION) {
		const step = MIGRATIONS[version];
		raw = step ? step(raw) : { ...raw, schemaVersion: version + 1 };
		version++;
	}

	// Fehlende Bereiche auffüllen, damit ältere oder handbearbeitete Dateien nicht abstürzen.
	const out = { ...raw } as Raw;
	for (const key of RECORDS) {
		if (!out[key] || typeof out[key] !== 'object' || Array.isArray(out[key])) out[key] = {};
	}
	const now = new Date().toISOString();
	const meta = (out.meta && typeof out.meta === 'object' ? out.meta : {}) as Raw;
	out.meta = {
		createdAt: typeof meta.createdAt === 'string' ? meta.createdAt : now,
		updatedAt: typeof meta.updatedAt === 'string' ? meta.updatedAt : now,
		...(typeof meta.lastExportedAt === 'string' ? { lastExportedAt: meta.lastExportedAt } : {})
	};
	if (typeof out.name !== 'string') out.name = 'Unbenannt';
	if (!Array.isArray(out.history)) out.history = [];
	const layout = out.layout as Raw | undefined;
	if (!layout || !Array.isArray(layout.tabs)) out.layout = { tabs: [] };
	out.schemaVersion = SCHEMA_VERSION;

	const c = out as unknown as Character;
	for (const f of Object.values(c.fields)) {
		if (typeof f.base !== 'number' || !Number.isFinite(f.base)) f.base = Number(f.base) || 0;
		if (typeof f.order !== 'number') f.order = 0;
		f.type = 'number';
	}
	for (const m of Object.values(c.modifiers)) {
		if (typeof m.expr !== 'string') m.expr = String(m.expr ?? '');
		if (typeof m.order !== 'number') m.order = 0;
		if (m.targetFieldId === undefined) m.targetFieldId = null;
	}
	return c;
}

export const CHARACTER_FILE_KIND = 'dnd-charakterbogen/character';

/** Erstellt den Inhalt der Export-Datei. */
export function serializeCharacter(c: Character): string {
	return JSON.stringify(c, null, '\t');
}

export function parseCharacterFile(text: string): Character {
	let data: unknown;
	try {
		data = JSON.parse(text);
	} catch {
		throw new ImportError('Die Datei ist kein gültiges JSON.');
	}
	return migrateCharacter(data);
}

export function exportFileName(c: Character): string {
	const slug =
		c.name
			.normalize('NFKD')
			.replace(/[̀-ͯ]/g, '')
			.replace(/ß/g, 'ss')
			.replace(/[^a-zA-Z0-9]+/g, '-')
			.replace(/^-|-$/g, '')
			.toLowerCase() || 'charakter';
	const date = new Date().toISOString().slice(0, 10);
	return `${slug}-${date}.json`;
}
