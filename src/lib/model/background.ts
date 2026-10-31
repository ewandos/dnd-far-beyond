// Hintergrund-Assistent: sammelt, was ein Spieler beim Hintergrund ohnehin von Hand einträgt,
// und legt es in einem Schritt an. Keine Regelprüfung – jede Auswahl ist erlaubt.

import type { Ability, Character, Id, Item, Modifier } from '../engine/types';
import { ATTRIBUTES, STD, type AttributeKey } from './defaults';

export interface BackgroundInput {
	name: string;
	/** Feld-IDs von Fertigkeiten (oder anderen Feldern mit Übungs-Quelle), die „geübt“ werden. */
	skills: Id[];
	tools: string;
	languages: string;
	/** Attributswerterhöhungen (z. B. 2024: +2/+1 oder +1/+1/+1). */
	increases: { attr: AttributeKey; amount: number }[];
	feature: { name: string; description: string; isFeat: boolean };
	/** Eine Zeile pro Gegenstand, optional mit Menge: „2x Fackel“, „Fackel ×10“. */
	equipment: string;
	gold: number;
	story: string;
}

export interface BackgroundPlan {
	abilities: Ability[];
	modifiers: Modifier[];
	items: Item[];
	proficiencyLevels: { id: Id; level: 1 }[];
	goldDelta: number;
	/** Text, der an die Notiz „Hintergrund“ angehängt wird. */
	notesAppend?: { textId: Id; content: string };
}

/** „2x Fackel“, „Fackel x10“, „Seil (15 m)“ → Name und Menge. */
export function parseEquipmentLine(line: string): { name: string; quantity: number } | null {
	const t = line.replace(/^\s*[-*•]\s*/, '').trim();
	if (!t) return null;
	const lead = /^(\d+)\s*[x×]?\s+(.+)$/i.exec(t) ?? /^(\d+)\s*[x×]\s*(.+)$/i.exec(t);
	if (lead) return { name: lead[2].trim(), quantity: Number(lead[1]) };
	const trail = /^(.+?)\s*[x×]\s*(\d+)$/i.exec(t);
	if (trail) return { name: trail[1].trim(), quantity: Number(trail[2]) };
	return { name: t, quantity: 1 };
}

const nextOrder = (rec: Record<string, { order: number }>) => Object.values(rec).reduce((m, x) => Math.max(m, x.order), -1) + 1;

export function planBackground(c: Character, input: BackgroundInput, containerId: Id, newId: () => Id): BackgroundPlan {
	const name = input.name.trim() || 'Hintergrund';
	let abilityOrder = nextOrder(c.abilities);
	let modOrder = nextOrder(c.modifiers);
	let itemOrder = nextOrder(c.items);
	const plan: BackgroundPlan = { abilities: [], modifiers: [], items: [], proficiencyLevels: [], goldDelta: 0 };

	// Hintergrund als Fähigkeit: Beschreibung sammelt Werkzeuge, Sprachen und Fertigkeiten; die
	// Attributserhöhungen hängen als Modifikatoren daran und sind damit inspizierbar.
	const lines: string[] = [];
	const skillNames = input.skills.map((id) => c.fields[id]?.name).filter(Boolean);
	if (skillNames.length) lines.push(`**Fertigkeiten:** ${skillNames.join(', ')}`);
	if (input.tools.trim()) lines.push(`**Werkzeuge:** ${input.tools.trim()}`);
	if (input.languages.trim()) lines.push(`**Sprachen:** ${input.languages.trim()}`);
	const increases = input.increases.filter((x) => x.amount !== 0 && c.fields[STD.attr(x.attr)]);
	if (increases.length) {
		lines.push(
			`**Attributswerte:** ${increases.map((x) => `${ATTRIBUTES.find((a) => a.key === x.attr)?.name} ${x.amount > 0 ? '+' : '−'}${Math.abs(x.amount)}`).join(', ')}`
		);
	}
	const bgId = newId();
	plan.abilities.push({ id: bgId, kind: 'ability', name, origin: 'Hintergrund', description: lines.join('\n\n'), active: true, order: abilityOrder++ });
	for (const inc of increases) {
		plan.modifiers.push({
			id: newId(),
			targetFieldId: STD.attr(inc.attr),
			op: 'add',
			expr: String(inc.amount),
			description: name,
			source: { kind: 'ability', id: bgId },
			order: modOrder++
		});
	}

	if (input.feature.name.trim()) {
		plan.abilities.push({
			id: newId(),
			kind: 'ability',
			name: input.feature.name.trim(),
			origin: input.feature.isFeat ? 'Talent' : 'Hintergrund',
			description: input.feature.description,
			active: true,
			order: abilityOrder++
		});
	}

	// Übung: nur anheben, nie absenken (Expertise bleibt Expertise).
	for (const fieldId of input.skills) {
		const prof = Object.values(c.proficiencies).find((p) => p.fieldId === fieldId);
		if (prof && prof.level < 1) plan.proficiencyLevels.push({ id: prof.id, level: 1 });
	}

	for (const line of input.equipment.split('\n')) {
		const e = parseEquipmentLine(line);
		if (!e) continue;
		plan.items.push({ id: newId(), name: e.name, description: '', quantity: e.quantity, requiresAttunement: false, containerId, order: itemOrder++ });
	}

	plan.goldDelta = Number.isFinite(input.gold) ? input.gold : 0;

	if (input.story.trim()) {
		const note = Object.values(c.texts).find((t) => t.title.trim().toLowerCase() === 'hintergrund');
		if (note) {
			const sep = note.content.trim() ? '\n\n' : '';
			plan.notesAppend = { textId: note.id, content: `${note.content.trimEnd()}${sep}## ${name}\n\n${input.story.trim()}` };
		}
	}
	return plan;
}
