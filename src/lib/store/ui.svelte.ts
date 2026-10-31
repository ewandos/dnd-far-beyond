// Oberflächenzustand: Inspektionspanel (mit Rücksprung-Stapel), Tabs, Theme, Hinweise.

import type { Id } from '$lib/engine/types';

export type Panel =
	| { kind: 'field'; id: Id }
	| { kind: 'item'; id: Id }
	| { kind: 'ability'; id: Id }
	| { kind: 'spell'; id: Id };

/** Feste Verwaltungsseiten neben den frei gestaltbaren Layout-Tabs. */
export const SYSTEM_TABS = [
	{ id: 'sys.fields', label: 'Verwaltung' },
	{ id: 'sys.history', label: 'Verlauf' }
] as const;

export type SystemTabId = (typeof SYSTEM_TABS)[number]['id'];

export type Theme = 'system' | 'light' | 'dark';

interface Toast {
	id: number;
	text: string;
	action?: { label: string; run: () => void };
}

class UiState {
	stack = $state<Panel[]>([]);
	/** ID eines Layout-Tabs oder einer Systemseite (sys.*). Leer = erster sichtbarer Tab. */
	tab = $state<string>('');
	/** Bearbeitungsmodus: Bausteine und Tabs anordnen. Spielmodus (Standard) fixiert das Layout. */
	editMode = $state(false);
	/** Offener Austausch-Dialog. */
	dialog = $state<'import' | 'export' | 'pointbuy' | 'background' | null>(null);
	toasts = $state<Toast[]>([]);
	theme = $state<Theme>('system');
	/** Verlauf-Tab: vorbelegter Filter (z. B. „Historie dieses Feldes“). */
	historyFilter = $state('');
	#toastId = 0;

	panel = $derived(this.stack.length ? this.stack[this.stack.length - 1] : null);

	/** Öffnet ein Panel als neue Wurzel (Antippen eines Werts). */
	open(p: Panel) {
		this.stack = [p];
	}

	/** Springt weiter (Sprung zur Quelle bzw. zum Feld); „Zurück“ führt wieder hin. */
	push(p: Panel) {
		const top = this.panel;
		if (top && top.kind === p.kind && top.id === p.id) return;
		this.stack = [...this.stack, p];
	}

	back() {
		this.stack = this.stack.slice(0, -1);
	}

	close() {
		this.stack = [];
	}

	toast(text: string, action?: Toast['action']) {
		const id = ++this.#toastId;
		this.toasts = [...this.toasts.slice(-1), { id, text, action }];
		setTimeout(() => this.dismiss(id), action ? 4500 : 3500);
	}

	dismiss(id: number) {
		this.toasts = this.toasts.filter((t) => t.id !== id);
	}

	initTheme() {
		try {
			const t = localStorage.getItem('theme');
			if (t === 'light' || t === 'dark') this.theme = t;
		} catch {
			/* privater Modus */
		}
		this.applyTheme();
	}

	setTheme(t: Theme) {
		this.theme = t;
		try {
			if (t === 'system') localStorage.removeItem('theme');
			else localStorage.setItem('theme', t);
		} catch {
			/* privater Modus */
		}
		this.applyTheme();
	}

	cycleTheme() {
		const order: Theme[] = ['system', 'light', 'dark'];
		this.setTheme(order[(order.indexOf(this.theme) + 1) % order.length]);
	}

	private applyTheme() {
		const root = document.documentElement;
		if (this.theme === 'system') root.removeAttribute('data-theme');
		else root.setAttribute('data-theme', this.theme);
	}
}

export const ui = new UiState();
