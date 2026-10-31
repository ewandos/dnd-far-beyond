import type { Field, Operation } from '$lib/engine/types';

const nf = new Intl.NumberFormat('de-DE', { maximumFractionDigits: 2 });

export function formatNumber(v: number): string {
	return nf.format(v).replace('-', '−');
}

export function formatSigned(v: number): string {
	if (v > 0) return '+' + nf.format(v);
	if (v < 0) return '−' + nf.format(-v);
	return '+0';
}

export function formatValue(v: number, field?: Pick<Field, 'format'>): string {
	return field?.format === 'signed' ? formatSigned(v) : formatNumber(v);
}

export const OP_SYMBOL: Record<Operation, string> = {
	add: '+',
	set: '=',
	multiply: '×',
	divide: '÷'
};

export const OP_LABEL: Record<Operation, string> = {
	add: 'Addieren',
	set: 'Setzen',
	multiply: 'Multiplizieren',
	divide: 'Teilen'
};

export function formatOp(op: Operation): string {
	return OP_SYMBOL[op];
}

/** Kompakte Darstellung eines angewendeten Werts, z. B. „+2“, „= 16“, „× 2“. */
export function formatEffect(op: Operation, value: number): string {
	if (op === 'add') return formatSigned(value);
	return `${OP_SYMBOL[op]} ${formatNumber(value)}`;
}

export function relativeTime(iso: string | undefined, now = Date.now()): string {
	if (!iso) return 'nie';
	const diff = Math.max(0, now - Date.parse(iso));
	const min = Math.round(diff / 60000);
	if (min < 1) return 'gerade eben';
	if (min < 60) return `vor ${min} Min.`;
	const h = Math.round(min / 60);
	if (h < 24) return `vor ${h} Std.`;
	const d = Math.round(h / 24);
	if (d === 1) return 'gestern';
	if (d < 30) return `vor ${d} Tagen`;
	return new Date(iso).toLocaleDateString('de-DE');
}

export function formatDateTime(iso: string): string {
	return new Date(iso).toLocaleString('de-DE', {
		day: '2-digit',
		month: '2-digit',
		year: 'numeric',
		hour: '2-digit',
		minute: '2-digit',
		second: '2-digit'
	});
}

/** Parst Benutzereingaben wie „1,5“, „−3“ oder „ 12 “. */
export function parseNumberInput(s: string): number | null {
	const t = s.trim().replace(',', '.').replace(/[−–]/g, '-');
	if (!t || !/^[-+]?(\d+(\.\d*)?|\.\d+)$/.test(t)) return null;
	return parseFloat(t);
}
