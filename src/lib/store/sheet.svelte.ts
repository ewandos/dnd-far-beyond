// Reaktiver Zustand des geöffneten Charakters mit Historie, Rückgängig und Wiederholen.

import { evaluate, type Evaluation } from '$lib/engine/evaluate';
import type { Character, HistoryEvent, Patch } from '$lib/engine/types';
import {
	applyBackward,
	applyForward,
	canCoalesce,
	clone,
	coalesce,
	HISTORY_LIMIT,
	isNoop,
	readPath
} from '$lib/model/history';
import { newId } from '$lib/model/ids';

export interface Change {
	path: string[];
	/** Neuer Wert; `undefined` entfernt den Eintrag. */
	value: unknown;
}

export interface CommitInput {
	kind: string;
	target: string;
	title: string;
	before?: unknown;
	after?: unknown;
	changes: Change[];
	/** Schnelle Folgeänderungen am selben Wert zu einem Ereignis zusammenfassen. */
	coalesce?: boolean;
}

class SheetStore {
	character = $state<Character | null>(null);
	redoStack = $state<HistoryEvent[]>([]);
	#previous: Evaluation | undefined;

	evaluation = $derived.by(() => {
		const c = this.character;
		if (!c) return null;
		const result = evaluate(c, this.#previous);
		this.#previous = result;
		return result;
	});

	canUndo = $derived((this.character?.history.length ?? 0) > 0);
	canRedo = $derived(this.redoStack.length > 0);

	load(c: Character | null) {
		this.#previous = undefined;
		this.redoStack = [];
		this.character = c;
	}

	commit(input: CommitInput): boolean {
		const c = this.character;
		if (!c) return false;
		const patches: Patch[] = input.changes.map((ch) => ({
			path: ch.path,
			before: clone(readPath(c, ch.path)),
			after: clone(ch.value)
		}));
		const event: HistoryEvent = {
			id: newId(),
			at: new Date().toISOString(),
			kind: input.kind,
			target: input.target,
			title: input.title,
			before: clone(input.before),
			after: clone(input.after),
			patches
		};
		if (isNoop(event)) return false;

		applyForward(c, patches);

		const last = c.history[c.history.length - 1];
		if (input.coalesce && this.redoStack.length === 0 && canCoalesce(last, event)) {
			const merged = coalesce(clone(last), event);
			if (isNoop(merged)) c.history.pop();
			else c.history[c.history.length - 1] = merged;
		} else {
			c.history.push(event);
			if (c.history.length > HISTORY_LIMIT) c.history.splice(0, c.history.length - HISTORY_LIMIT);
		}
		this.redoStack = [];
		c.meta.updatedAt = event.at;
		return true;
	}

	undo() {
		const c = this.character;
		const event = c?.history.pop();
		if (!c || !event) return;
		const plain = clone(event);
		applyBackward(c, plain.patches);
		this.redoStack.push(plain);
		c.meta.updatedAt = new Date().toISOString();
	}

	redo() {
		const c = this.character;
		const event = this.redoStack.pop();
		if (!c || !event) return;
		applyForward(c, event.patches);
		c.history.push({ ...event, at: new Date().toISOString() });
		c.meta.updatedAt = new Date().toISOString();
	}
}

export const sheet = new SheetStore();

/** Kurzzugriff auf den geöffneten Charakter in Aktionen. */
export function current(): Character {
	if (!sheet.character) throw new Error('Kein Charakter geöffnet');
	return sheet.character;
}
