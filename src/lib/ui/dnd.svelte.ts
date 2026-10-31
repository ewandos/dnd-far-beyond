// Drag & Drop über Pointer Events – funktioniert mit Maus und Touch (iPad) gleichermaßen.

import type { Action } from 'svelte/action';
import { moveContainer, moveItem } from '$lib/store/actions';

export interface DragPayload {
	kind: 'item' | 'container';
	id: string;
	label: string;
}

class DragState {
	payload = $state<DragPayload | null>(null);
	x = $state(0);
	y = $state(0);
	over = $state<string | null>(null);
}

export const drag = new DragState();

const THRESHOLD = 6;

/** Ziehgriff. `ondrop(containerId)` wird beim Loslassen über einem Ziel aufgerufen. */
export const draggable: Action<HTMLElement, { payload: DragPayload; ondrop: (p: DragPayload, containerId: string) => void }> = (
	node,
	params
) => {
	let current = params;
	let start: { x: number; y: number; id: number } | null = null;

	function targetAt(x: number, y: number): string | null {
		const el = document.elementFromPoint(x, y) as HTMLElement | null;
		const zone = el?.closest<HTMLElement>('[data-drop-container]');
		return zone?.dataset.dropContainer ?? null;
	}

	function down(e: PointerEvent) {
		if (e.button !== 0) return;
		start = { x: e.clientX, y: e.clientY, id: e.pointerId };
		window.addEventListener('pointermove', move);
		window.addEventListener('pointerup', up);
		window.addEventListener('pointercancel', cancel);
	}

	function move(e: PointerEvent) {
		if (!start || e.pointerId !== start.id) return;
		if (!drag.payload) {
			if (Math.hypot(e.clientX - start.x, e.clientY - start.y) < THRESHOLD) return;
			drag.payload = current.payload;
			node.setPointerCapture?.(e.pointerId);
		}
		e.preventDefault();
		drag.x = e.clientX;
		drag.y = e.clientY;
		drag.over = targetAt(e.clientX, e.clientY);
	}

	function up(e: PointerEvent) {
		if (drag.payload) {
			const target = targetAt(e.clientX, e.clientY);
			if (target) current.ondrop(drag.payload, target);
			// Klick nach dem Ziehen unterdrücken
			node.addEventListener('click', swallow, { capture: true, once: true });
			setTimeout(() => node.removeEventListener('click', swallow, { capture: true }), 0);
		}
		cancel();
	}

	function swallow(e: Event) {
		e.stopPropagation();
		e.preventDefault();
	}

	function cancel() {
		start = null;
		drag.payload = null;
		drag.over = null;
		window.removeEventListener('pointermove', move);
		window.removeEventListener('pointerup', up);
		window.removeEventListener('pointercancel', cancel);
	}

	node.addEventListener('pointerdown', down);
	node.style.touchAction = 'none';
	return {
		update(p) {
			current = p;
		},
		destroy() {
			cancel();
			node.removeEventListener('pointerdown', down);
		}
	};
};

/** Standard-Ablage: Item oder Container in einen Container verschieben. */
export function handleDrop(p: DragPayload, containerId: string) {
	if (p.kind === 'item') moveItem(p.id, containerId);
	else if (p.id !== containerId) moveContainer(p.id, containerId);
}
