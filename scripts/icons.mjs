// Erzeugt die PNG-Icons (Home-Bildschirm/iPad) aus static/favicon.svg.
import { chromium } from 'playwright';
import { readFileSync } from 'node:fs';

const svg = readFileSync(new URL('../static/favicon.svg', import.meta.url), 'utf8');
const browser = await chromium.launch();
const page = await browser.newPage();
for (const [name, size, pad] of [
	['icon-192.png', 192, 0],
	['icon-512.png', 512, 0],
	['apple-touch-icon.png', 180, 0]
]) {
	await page.setViewportSize({ width: size, height: size });
	await page.setContent(
		`<html><body style="margin:0;background:#2a2420">${svg.replace('<svg ', `<svg width="${size - pad * 2}" height="${size - pad * 2}" style="display:block;margin:${pad}px" `)}</body></html>`
	);
	await page.screenshot({ path: new URL(`../static/${name}`, import.meta.url).pathname, omitBackground: false });
}
await browser.close();
