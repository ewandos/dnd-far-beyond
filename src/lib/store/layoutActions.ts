// Änderungen am freien Layout. Bausteine ändern den Tab an seinem Index, Tab-Struktur
// (anlegen, löschen, umsortieren) ersetzt die Tab-Liste – so bleibt Rückgängig eindeutig.

import type { Block, BlockType, Id, Tab } from '$lib/engine/types';
import { findFreeSpot, placeBlock, type Rect } from '$lib/model/layout';
import { clone } from '$lib/model/history';
import { newId } from '$lib/model/ids';
import { current, sheet } from './sheet.svelte';

export const BLOCK_LABEL: Record<BlockType, string> = {
	field: 'Feld',
	fieldGroup: 'Feldgruppe',
	counter: 'Kästchen / Zähler',
	container: 'Container',
	cardList: 'Karten-Liste',
	text: 'Textblock'
};

export function sortedTabs(): Tab[] {
	return [...current().layout.tabs].sort((a, b) => a.order - b.order);
}

function tabIndex(tabId: Id): number {
	return current().layout.tabs.findIndex((t) => t.id === tabId);
}

function commitTab(tabId: Id, kind: string, title: string, next: Tab, coalesce = false) {
	const i = tabIndex(tabId);
	if (i < 0) return;
	sheet.commit({ kind, target: tabId, title, changes: [{ path: ['layout', 'tabs', String(i)], value: next }], coalesce });
}

function commitTabs(kind: string, target: string, title: string, tabs: Tab[]) {
	sheet.commit({ kind, target, title, changes: [{ path: ['layout', 'tabs'], value: tabs }] });
}

function getTab(tabId: Id): Tab | undefined {
	const t = current().layout.tabs.find((x) => x.id === tabId);
	return t ? clone(t) : undefined;
}

// Bausteine -----------------------------------------------------------------

export function moveBlock(tabId: Id, blockId: Id, rect: Rect) {
	const tab = getTab(tabId);
	const block = tab?.blocks.find((b) => b.id === blockId);
	if (!tab || !block) return;
	if (block.x === rect.x && block.y === rect.y && block.w === rect.w && block.h === rect.h) return;
	tab.blocks = placeBlock(tab.blocks, blockId, rect);
	commitTab(tabId, 'layout.block.move', `Baustein verschoben (${tab.name})`, tab);
}

export function addBlock(tabId: Id, type: BlockType, config: Record<string, unknown>, size: { w: number; h: number }, title?: string): Id | undefined {
	const tab = getTab(tabId);
	if (!tab) return;
	const spot = findFreeSpot(tab.blocks, size.w, size.h);
	const block: Block = { id: newId(), type, ...spot, config, ...(title ? { title } : {}) };
	tab.blocks.push(block);
	commitTab(tabId, 'layout.block.add', `Baustein hinzugefügt: ${BLOCK_LABEL[type]}`, tab);
	return block.id;
}

export function updateBlock(tabId: Id, blockId: Id, patch: { config?: Record<string, unknown>; title?: string }) {
	const tab = getTab(tabId);
	const block = tab?.blocks.find((b) => b.id === blockId);
	if (!tab || !block) return;
	if (patch.config) block.config = patch.config;
	if ('title' in patch) {
		if (patch.title?.trim()) block.title = patch.title;
		else delete block.title;
	}
	commitTab(tabId, 'layout.block.config', `Baustein geändert: ${BLOCK_LABEL[block.type]}`, tab, true);
}

export function removeBlock(tabId: Id, blockId: Id) {
	const tab = getTab(tabId);
	if (!tab) return;
	const block = tab.blocks.find((b) => b.id === blockId);
	if (!block) return;
	tab.blocks = tab.blocks.filter((b) => b.id !== blockId);
	commitTab(tabId, 'layout.block.remove', `Baustein entfernt: ${BLOCK_LABEL[block.type]}`, tab);
}

// Tabs ----------------------------------------------------------------------

export function renameTab(tabId: Id, name: string) {
	const tab = getTab(tabId);
	if (!tab) return;
	tab.name = name;
	commitTab(tabId, 'layout.tab.name', 'Tab umbenannt', tab, true);
}

export function setTabHidden(tabId: Id, hidden: boolean) {
	const tab = getTab(tabId);
	if (!tab) return;
	tab.hidden = hidden;
	commitTab(tabId, 'layout.tab.hidden', `Tab ${hidden ? 'ausgeblendet' : 'eingeblendet'}: ${tab.name}`, tab);
}

export function addTab(name: string): Id {
	const tabs = sortedTabs().map((t) => clone(t));
	const id = newId();
	tabs.push({ id, name: name.trim() || 'Neuer Tab', hidden: false, order: tabs.length, blocks: [] });
	commitTabs('layout.tab.add', id, `Tab angelegt: ${name}`, tabs);
	return id;
}

export function deleteTab(tabId: Id) {
	const tabs = sortedTabs().map((t) => clone(t));
	const tab = tabs.find((t) => t.id === tabId);
	if (!tab) return;
	const rest = tabs.filter((t) => t.id !== tabId).map((t, i) => ({ ...t, order: i }));
	commitTabs('layout.tab.delete', tabId, `Tab gelöscht: ${tab.name}`, rest);
}

export function moveTab(tabId: Id, dir: -1 | 1) {
	const tabs = sortedTabs().map((t) => clone(t));
	const i = tabs.findIndex((t) => t.id === tabId);
	const j = i + dir;
	if (i < 0 || j < 0 || j >= tabs.length) return;
	[tabs[i], tabs[j]] = [tabs[j], tabs[i]];
	commitTabs('layout.tab.move', tabId, `Tab verschoben: ${tabs[j].name}`, tabs.map((t, k) => ({ ...t, order: k })));
}
