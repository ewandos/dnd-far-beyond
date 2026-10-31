import { contentFileName, ContentError, exportContent, readContentFile, CONTENT_FILE_KIND, type ContentEntry, type ContentRef } from '$lib/model/content';
import { isFiveToolsData, parseFiveTools } from '$lib/model/fivetools';
import { CHARACTER_FILE_KIND } from '$lib/model/migrate';
import { saveJsonFile, type ExportResult } from '$lib/store/files';
import { current } from '$lib/store/sheet.svelte';

export async function exportEntries(refs: ContentRef[]): Promise<ExportResult> {
	const c = JSON.parse(JSON.stringify(current()));
	const file = exportContent(c, refs);
	return saveJsonFile(contentFileName(file), JSON.stringify(file, null, '\t'), file.entries.length === 1 ? file.entries[0].type : 'Inhalte');
}

export interface LoadedContent {
	format: 'app' | '5etools';
	entries: ContentEntry[];
}

/** Liest eine Inhalts-Datei dieser App oder eine 5eTools-Datei. */
export function loadContentText(text: string): LoadedContent {
	let data: unknown;
	try {
		data = JSON.parse(text);
	} catch {
		throw new ContentError('Die Datei ist kein gültiges JSON.');
	}
	const raw = data as Record<string, unknown> | null;
	if (raw?.kind === CONTENT_FILE_KIND) return { format: 'app', entries: readContentFile(data) };
	if (isFiveToolsData(data)) {
		const entries = parseFiveTools(data);
		if (!entries.length) throw new ContentError('Die 5eTools-Datei enthält keine Items, Zauber oder Talente.');
		return { format: '5etools', entries };
	}
	if (raw?.kind === CHARACTER_FILE_KIND || (raw && typeof raw.schemaVersion === 'number' && raw.fields)) {
		throw new ContentError('Das ist eine Charakter-Datei – bitte auf der Startseite unter „Importieren“ einlesen.');
	}
	throw new ContentError('Unbekanntes Format. Unterstützt: Inhalts-Dateien dieser App und 5eTools-Dateien (Items, Zauber, Talente).');
}
