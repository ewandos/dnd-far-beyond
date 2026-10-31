// Lokale Arbeitskopie in IndexedDB. Die eigentliche „Wahrheit“ ist die exportierte JSON-Datei.

import Dexie, { type Table } from 'dexie';
import type { Character } from '$lib/engine/types';
import { migrateCharacter } from '$lib/model/migrate';

export interface StoredCharacter {
	id: string;
	name: string;
	updatedAt: string;
	data: Character;
}

export interface CharacterSummary {
	id: string;
	name: string;
	updatedAt: string;
	lastExportedAt?: string;
	level?: number;
}

class SheetDb extends Dexie {
	characters!: Table<StoredCharacter, string>;

	constructor() {
		super('dnd-charakterbogen');
		this.version(1).stores({ characters: 'id, name, updatedAt' });
	}
}

let db: SheetDb | null = null;
function getDb(): SheetDb {
	db ??= new SheetDb();
	return db;
}

export async function listCharacters(): Promise<CharacterSummary[]> {
	const all = await getDb().characters.orderBy('updatedAt').reverse().toArray();
	return all.map((s) => ({
		id: s.id,
		name: s.name,
		updatedAt: s.updatedAt,
		lastExportedAt: s.data.meta?.lastExportedAt,
		level: s.data.fields?.['std.level']?.base
	}));
}

export async function loadCharacter(id: string): Promise<Character | null> {
	const s = await getDb().characters.get(id);
	return s ? migrateCharacter(s.data) : null;
}

export async function saveCharacter(c: Character): Promise<void> {
	await getDb().characters.put({ id: c.id, name: c.name, updatedAt: c.meta.updatedAt, data: c });
}

export async function deleteCharacter(id: string): Promise<void> {
	await getDb().characters.delete(id);
}

export async function characterExists(id: string): Promise<boolean> {
	return (await getDb().characters.get(id)) !== undefined;
}

/** Bittet den Browser, die Daten nicht bei Speicherknappheit zu löschen. */
export async function requestPersistentStorage(): Promise<boolean | null> {
	try {
		if (!navigator.storage?.persist) return null;
		if (await navigator.storage.persisted()) return true;
		return await navigator.storage.persist();
	} catch {
		return null;
	}
}
