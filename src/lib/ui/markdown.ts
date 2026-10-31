// Kleiner, sicherer Markdown-Renderer: HTML im Text wird immer escaped.
// Unterstützt Überschriften, Absätze, Listen, Tabellen, Zitate, Trennlinien,
// **fett**, *kursiv*, `Code` und [Links](https://…).

function escapeHtml(s: string): string {
	return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

function inline(src: string): string {
	let s = escapeHtml(src);
	const codes: string[] = [];
	s = s.replace(/`([^`]+)`/g, (_, c: string) => {
		codes.push(`<code>${c}</code>`);
		return `\u0000${codes.length - 1}\u0000`;
	});
	s = s.replace(/\[([^\]]+)\]\(([^)\s]+)\)/g, (whole, text: string, href: string) => {
		const decoded = href.replace(/&amp;/g, '&');
		if (!/^(https?:|mailto:|#)/i.test(decoded)) return text;
		return `<a href="${href}" target="_blank" rel="noopener noreferrer">${text}</a>`;
	});
	s = s.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>');
	s = s.replace(/__(.+?)__/g, '<strong>$1</strong>');
	s = s.replace(/(^|[^*])\*(?!\s)(.+?)(?<!\s)\*(?!\*)/g, '$1<em>$2</em>');
	s = s.replace(/(^|[^\w])_(?!\s)(.+?)(?<!\s)_(?!\w)/g, '$1<em>$2</em>');
	s = s.replace(/\u0000(\d+)\u0000/g, (_, i: string) => codes[Number(i)]);
	return s;
}

const isTableSep = (l: string) => /^\s*\|?\s*:?-{2,}:?\s*(\|\s*:?-{2,}:?\s*)*\|?\s*$/.test(l);
const splitRow = (l: string) =>
	l
		.trim()
		.replace(/^\|/, '')
		.replace(/\|$/, '')
		.split('|')
		.map((c) => c.trim());

export function renderMarkdown(src: string): string {
	const lines = src.replace(/\r\n?/g, '\n').split('\n');
	const out: string[] = [];
	let i = 0;

	while (i < lines.length) {
		const line = lines[i];
		if (!line.trim()) {
			i++;
			continue;
		}
		const h = /^(#{1,4})\s+(.*)$/.exec(line);
		if (h) {
			const level = h[1].length;
			out.push(`<h${level}>${inline(h[2])}</h${level}>`);
			i++;
			continue;
		}
		if (/^\s*(-{3,}|\*{3,}|_{3,})\s*$/.test(line)) {
			out.push('<hr>');
			i++;
			continue;
		}
		if (/^\s*>/.test(line)) {
			const buf: string[] = [];
			while (i < lines.length && /^\s*>/.test(lines[i])) buf.push(lines[i++].replace(/^\s*>\s?/, ''));
			out.push(`<blockquote>${renderMarkdown(buf.join('\n'))}</blockquote>`);
			continue;
		}
		if (line.includes('|') && i + 1 < lines.length && isTableSep(lines[i + 1])) {
			const head = splitRow(line);
			i += 2;
			const rows: string[][] = [];
			while (i < lines.length && lines[i].includes('|') && lines[i].trim()) rows.push(splitRow(lines[i++]));
			out.push(
				'<table><thead><tr>' +
					head.map((c) => `<th>${inline(c)}</th>`).join('') +
					'</tr></thead><tbody>' +
					rows.map((r) => '<tr>' + r.map((c) => `<td>${inline(c)}</td>`).join('') + '</tr>').join('') +
					'</tbody></table>'
			);
			continue;
		}
		const listMatch = /^(\s*)([-*+]|\d+[.)])\s+/.exec(line);
		if (listMatch) {
			out.push(renderList(lines, i, (next) => (i = next)));
			continue;
		}
		const para: string[] = [];
		while (
			i < lines.length &&
			lines[i].trim() &&
			!/^(#{1,4})\s/.test(lines[i]) &&
			!/^\s*([-*+]|\d+[.)])\s+/.test(lines[i]) &&
			!/^\s*>/.test(lines[i])
		) {
			para.push(lines[i++]);
		}
		out.push(`<p>${para.map(inline).join('<br>')}</p>`);
	}
	return out.join('\n');
}

function renderList(lines: string[], start: number, setIndex: (i: number) => void): string {
	const first = /^(\s*)([-*+]|\d+[.)])\s+/.exec(lines[start])!;
	const indent = first[1].length;
	const ordered = /\d/.test(first[2]);
	const items: string[] = [];
	let i = start;
	while (i < lines.length) {
		const m = /^(\s*)([-*+]|\d+[.)])\s+(.*)$/.exec(lines[i]);
		if (!m || m[1].length < indent) break;
		if (m[1].length > indent) {
			const nested = renderList(lines, i, (n) => (i = n));
			if (items.length) items[items.length - 1] += nested;
			continue;
		}
		items.push(inline(m[3]));
		i++;
		// Fortsetzungszeilen (eingerückt, kein neues Listenelement)
		while (i < lines.length && lines[i].trim() && /^\s{2,}\S/.test(lines[i]) && !/^\s*([-*+]|\d+[.)])\s+/.test(lines[i])) {
			items[items.length - 1] += '<br>' + inline(lines[i].trim());
			i++;
		}
	}
	setIndex(i);
	const tag = ordered ? 'ol' : 'ul';
	return `<${tag}>${items.map((x) => `<li>${x}</li>`).join('')}</${tag}>`;
}
