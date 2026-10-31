// Export per Download bzw. iPad-Teilen-Menü, Import per Dateiauswahl.

import type { Character } from '$lib/engine/types';
import { exportFileName, serializeCharacter } from '$lib/model/migrate';

export type ExportResult = 'shared' | 'downloaded' | 'cancelled';

export async function exportCharacterFile(c: Character): Promise<ExportResult> {
	return saveJsonFile(exportFileName(c), serializeCharacter(c), c.name);
}

/** Speichert JSON per Download bzw. – auf iPad/iPhone – über das Teilen-Menü (z. B. iCloud Drive). */
export async function saveJsonFile(name: string, json: string, title: string): Promise<ExportResult> {
	const blob = new Blob([json], { type: 'application/json' });
	const file = new File([blob], name, { type: 'application/json' });
	if (prefersShareSheet() && navigator.canShare?.({ files: [file] })) {
		try {
			await navigator.share({ files: [file], title });
			return 'shared';
		} catch (e) {
			if ((e as DOMException)?.name === 'AbortError') return 'cancelled';
			// sonst: Fallback auf Download
		}
	}
	const url = URL.createObjectURL(blob);
	const a = document.createElement('a');
	a.href = url;
	a.download = name;
	document.body.appendChild(a);
	a.click();
	a.remove();
	setTimeout(() => URL.revokeObjectURL(url), 10_000);
	return 'downloaded';
}

function prefersShareSheet(): boolean {
	return isAppleTouchDevice();
}

export function isAppleTouchDevice(): boolean {
	if (typeof navigator === 'undefined') return false;
	const ua = navigator.userAgent;
	return /iPad|iPhone|iPod/.test(ua) || (/Macintosh/.test(ua) && navigator.maxTouchPoints > 1);
}

export function isStandalone(): boolean {
	if (typeof window === 'undefined') return false;
	return (
		window.matchMedia?.('(display-mode: standalone)').matches ||
		(navigator as Navigator & { standalone?: boolean }).standalone === true
	);
}

export function pickFile(accept = 'application/json,.json'): Promise<File | null> {
	return new Promise((resolve) => {
		const input = document.createElement('input');
		input.type = 'file';
		input.accept = accept;
		input.style.display = 'none';
		input.addEventListener('change', () => {
			resolve(input.files?.[0] ?? null);
			input.remove();
		});
		input.addEventListener('cancel', () => {
			resolve(null);
			input.remove();
		});
		document.body.appendChild(input);
		input.click();
	});
}
