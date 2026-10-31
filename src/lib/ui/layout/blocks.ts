import type { Block, BlockType, CardListBlockConfig, Character, CounterBlockConfig, FieldGroupBlockConfig, TextBlockConfig } from '$lib/engine/types';

export const CARD_KIND_LABEL: Record<CardListBlockConfig['kind'], string> = {
	ability: 'Fähigkeiten',
	condition: 'Zustände',
	equipped: 'Ausgerüstet',
	spells: 'Zauber'
};

/** Standardgröße neuer Bausteine (Rasterzellen). */
export const DEFAULT_SIZE: Record<BlockType, { w: number; h: number }> = {
	field: { w: 2, h: 3 },
	fieldGroup: { w: 3, h: 6 },
	counter: { w: 4, h: 4 },
	container: { w: 6, h: 8 },
	cardList: { w: 6, h: 6 },
	text: { w: 6, h: 6 },
	actions: { w: 12, h: 12 }
};

/** Überschrift im Rahmen. `null` = Baustein zeichnet seine Überschrift selbst. */
export function blockTitle(c: Character, b: Block): string | null {
	switch (b.type) {
		case 'field':
		case 'container':
			return null;
		case 'fieldGroup':
			return b.title || (b.config as FieldGroupBlockConfig).group || 'Felder';
		case 'counter':
			return b.title || (b.config as CounterBlockConfig).group || 'Zähler';
		case 'cardList': {
			const cfg = b.config as unknown as CardListBlockConfig;
			if (b.title) return b.title;
			if (cfg.kind === 'spells') return cfg.spellListId ? (c.spellLists[cfg.spellListId]?.name ?? 'Zauberliste') : 'Alle Zauber';
			return CARD_KIND_LABEL[cfg.kind] ?? 'Liste';
		}
		case 'text':
			return b.title || c.texts[(b.config as unknown as TextBlockConfig).textId]?.title || 'Notiz';
		case 'actions':
			return b.title || null;
	}
}
