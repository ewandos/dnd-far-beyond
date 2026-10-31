import { describe, expect, it } from 'vitest';
import { renderMarkdown } from './markdown';

describe('Markdown', () => {
	it('rendert Grundelemente', () => {
		expect(renderMarkdown('# Titel')).toBe('<h1>Titel</h1>');
		expect(renderMarkdown('**fett** und *kursiv* und `code`')).toBe('<p><strong>fett</strong> und <em>kursiv</em> und <code>code</code></p>');
		expect(renderMarkdown('- a\n- b')).toBe('<ul><li>a</li><li>b</li></ul>');
		expect(renderMarkdown('1. a\n2. b')).toBe('<ol><li>a</li><li>b</li></ol>');
		expect(renderMarkdown('- a\n  - b\n- c')).toBe('<ul><li>a<ul><li>b</li></ul></li><li>c</li></ul>');
		expect(renderMarkdown('Zeile 1\nZeile 2\n\nAbsatz')).toBe('<p>Zeile 1<br>Zeile 2</p>\n<p>Absatz</p>');
	});

	it('rendert Tabellen', () => {
		const html = renderMarkdown('| W6 | Effekt |\n|---|---|\n| 1 | Nichts |');
		expect(html).toContain('<th>W6</th>');
		expect(html).toContain('<td>Nichts</td>');
	});

	it('escaped HTML und blockiert gefährliche Links', () => {
		expect(renderMarkdown('<script>alert(1)</script>')).toBe('<p>&lt;script&gt;alert(1)&lt;/script&gt;</p>');
		expect(renderMarkdown('[x](javascript:alert(1))')).not.toContain('href');
		expect(renderMarkdown('[x](https://5e.tools)')).toContain('href="https://5e.tools"');
		expect(renderMarkdown('<img src=x onerror=alert(1)>')).not.toContain('<img');
	});
});
