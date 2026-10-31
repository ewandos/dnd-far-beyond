import { describe, expect, it } from 'vitest';
import { SCHEMA_VERSION } from '../engine/types';
import { evaluate } from '../engine/evaluate';
import { createDefaultCharacter, STD } from './defaults';
import { exportFileName, ImportError, parseCharacterFile, serializeCharacter } from './migrate';

describe('Standardcharakter', () => {
	it('hat alle Standardfelder mit festen IDs', () => {
		const c = createDefaultCharacter('Test');
		const groups = new Map<string, number>();
		for (const f of Object.values(c.fields)) groups.set(f.group!, (groups.get(f.group!) ?? 0) + 1);
		expect(groups.get('Fertigkeiten')).toBe(18);
		expect(groups.get('Rettungswürfe')).toBe(6);
		expect(groups.get('Attribute')).toBe(6);
		expect(groups.get('Attributsmodifikatoren')).toBe(6);
		expect(groups.get('Währung')).toBe(5);
		for (const id of [STD.ac, STD.initiative, STD.speed, STD.hpMax, STD.hpCurrent, STD.hpTemp, STD.spellDc, STD.attuned, STD.attunementLimit]) {
			expect(c.fields[id], id).toBeDefined();
		}
		expect(Object.keys(c.proficiencies)).toHaveLength(24);
		expect(c.containers[STD.equipped].equipped).toBe(true);
		expect(c.containers[STD.backpack].equipped).toBe(false);
		expect(Object.values(c.counters).filter((x) => x.group === 'Zauberplätze')).toHaveLength(9);
		expect(c.layout.tabs.map((t) => t.name)).toEqual(['Übersicht', 'Aktionen', 'Inventar', 'Fähigkeiten', 'Zauber', 'Notizen']);
		expect(Object.values(c.actions).filter((a) => a.standard).map((a) => a.name)).toContain('Gelegenheitsangriff');
	});

	it('rechnet ohne Fehler', () => {
		const e = evaluate(createDefaultCharacter());
		expect(Object.values(e.modifiers).filter((m) => m.state === 'error')).toEqual([]);
		expect(e.fields[STD.spellDc].value).toBe(10);
		expect(e.fields[STD.passivePerception].value).toBe(10);
	});

	it('zwei Charaktere teilen Standard-IDs, haben aber eigene Charakter-IDs', () => {
		const a = createDefaultCharacter();
		const b = createDefaultCharacter();
		expect(a.id).not.toBe(b.id);
		expect(Object.keys(a.fields)).toEqual(Object.keys(b.fields));
	});
});

describe('Charakter-Datei', () => {
	it('Export und Re-Import ergibt denselben Bogen', () => {
		const c = createDefaultCharacter('Rundreise');
		c.fields[STD.ac].base = 15;
		c.items.x = { id: 'x', name: 'Axt', description: '', quantity: 1, requiresAttunement: false, containerId: STD.equipped, order: 0 };
		const back = parseCharacterFile(serializeCharacter(c));
		expect(back).toEqual(c);
		expect(evaluate(back).fields[STD.ac].value).toBe(15);
	});

	it('füllt fehlende Bereiche älterer Dateien auf', () => {
		const c = parseCharacterFile(JSON.stringify({ schemaVersion: 0, id: 'alt', name: 'Alt', fields: { a: { id: 'a', name: 'A', base: '3' } } }));
		expect(c.schemaVersion).toBe(SCHEMA_VERSION);
		expect(c.items).toEqual({});
		expect(c.history).toEqual([]);
		expect(c.fields.a.base).toBe(3);
		expect(evaluate(c).fields.a.value).toBe(3);
	});

	it('migriert Version 1: Zauberlisten und neues Startlayout', () => {
		const v1 = createDefaultCharacter('Alt') as unknown as Record<string, unknown>;
		v1.schemaVersion = 1;
		v1.spellLists = {};
		v1.layout = { tabs: [{ id: 'x', name: 'Übersicht', hidden: false, order: 0, blocks: [] }] };
		(v1.items as Record<string, unknown>).weg = { id: 'weg', name: 'Verwaist', description: '', quantity: 1, requiresAttunement: false, containerId: 'gibtsnicht', order: 0 };
		const c = parseCharacterFile(JSON.stringify(v1));
		expect(c.schemaVersion).toBe(3);
		expect(Object.values(c.spellLists).map((l) => l.name)).toEqual(['Vorbereitet', 'Bekannt']);
		expect(c.layout.tabs.map((t) => t.name)).toEqual(['Übersicht', 'Aktionen', 'Inventar', 'Fähigkeiten', 'Zauber', 'Notizen']);
		expect(c.layout.tabs[0].blocks.length).toBeGreaterThan(5);
		expect(c.items.weg.containerId).toBe(STD.equipped);
	});

	it('migriert Version 2: Aktions-Tab wird angehängt, eigenes Layout bleibt', () => {
		const v2 = createDefaultCharacter('Zwei') as unknown as Record<string, unknown>;
		v2.schemaVersion = 2;
		delete v2.actions;
		v2.layout = { tabs: [{ id: 'mein', name: 'Mein Bogen', hidden: false, order: 0, blocks: [{ id: 'b', type: 'text', x: 0, y: 0, w: 6, h: 4, config: {} }] }] };
		const c = parseCharacterFile(JSON.stringify(v2));
		expect(c.schemaVersion).toBe(3);
		expect(c.layout.tabs.map((t) => [t.name, t.order])).toEqual([['Mein Bogen', 0], ['Aktionen', 1]]);
		expect(c.layout.tabs[1].blocks[0]).toMatchObject({ type: 'actions', config: { spellListIds: ['std.spelllist.prepared'] } });
		expect(Object.keys(c.actions).length).toBeGreaterThan(5);
		// Erneutes Laden fügt nichts doppelt hinzu
		expect(parseCharacterFile(JSON.stringify(c)).layout.tabs).toHaveLength(2);
	});

	it('lehnt kaputte oder zu neue Dateien mit verständlicher Meldung ab', () => {
		expect(() => parseCharacterFile('kein json')).toThrow(ImportError);
		expect(() => parseCharacterFile('[]')).toThrow(/keinen Charakter/);
		expect(() => parseCharacterFile('{"name":"x"}')).toThrow(/kein gültiger/);
		expect(() => parseCharacterFile(JSON.stringify({ schemaVersion: 999, id: 'x', fields: {} }))).toThrow(/neueren App-Version/);
	});

	it('erzeugt lesbare Dateinamen', () => {
		const c = createDefaultCharacter('Thalia Dörnwald-Groß');
		expect(exportFileName(c)).toMatch(/^thalia-doernwald-gross-\d{4}-\d{2}-\d{2}\.json$|^thalia-dornwald-gross-\d{4}-\d{2}-\d{2}\.json$/);
	});
});
