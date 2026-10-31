import type { Character, Container, Item } from '$lib/engine/types';

/** „Rucksack › Beutel“ */
export function containerPath(c: Character, id: string): string {
	const parts: string[] = [];
	const seen = new Set<string>();
	for (let x: Container | undefined = c.containers[id]; x && !seen.has(x.id); x = x.parentId ? c.containers[x.parentId] : undefined) {
		parts.unshift(x.name);
		seen.add(x.id);
	}
	return parts.join(' › ');
}

export function childContainers(c: Character, parentId: string | undefined): Container[] {
	return Object.values(c.containers)
		.filter((x) => (x.parentId ?? undefined) === parentId || (parentId === undefined && x.parentId && !c.containers[x.parentId]))
		.sort((a, b) => a.order - b.order);
}

export function itemsIn(c: Character, containerId: string): Item[] {
	return Object.values(c.items)
		.filter((i) => i.containerId === containerId)
		.sort((a, b) => a.order - b.order);
}

/** Items, deren Container fehlt – damit nichts unsichtbar verloren geht. */
export function orphanItems(c: Character): Item[] {
	return Object.values(c.items).filter((i) => !c.containers[i.containerId]);
}
