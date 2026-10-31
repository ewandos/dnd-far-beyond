import type { Page } from '@playwright/test';
import { expect, test } from './fixtures';

// Phase 2: freies Layout, Bearbeitungs-/Spielmodus, Zauber und Zauberlisten.

async function newCharacter(page: Page, name = 'Layoutheld') {
	await page.goto('./');
	await page.getByLabel('Name des neuen Charakters').fill(name);
	await page.getByRole('button', { name: 'Neuer Charakter' }).click();
	await expect(page.locator('[data-tab]')).toBeVisible();
}

const tabButton = (page: Page, name: string) => page.locator('nav').getByRole('button', { name, exact: true });
const blockOf = (page: Page, fieldId: string) => page.locator('[data-tab] .block', { has: page.locator(`[data-field="${fieldId}"]`) }).first();

test('Spielmodus ist fixiert, Bearbeitungsmodus verschiebt Bausteine', async ({ page }) => {
	await newCharacter(page);
	await expect(page.locator('.overlay')).toHaveCount(0);

	await page.getByRole('button', { name: 'Layout bearbeiten' }).click();
	const overlay = blockOf(page, 'std.ac').locator('.overlay');
	await expect(overlay).toBeVisible();
	const before = await blockOf(page, 'std.ac').boundingBox();

	// Tastatur: zwei Zeilen nach unten
	await overlay.focus();
	await page.keyboard.press('ArrowDown');
	await page.keyboard.press('ArrowDown');
	const after = await blockOf(page, 'std.ac').boundingBox();
	expect(after!.y).toBeGreaterThan(before!.y + 80);

	// Ziehen mit dem Zeiger: eine Spalte weiter nach links ist belegt → Nachbarn weichen aus
	const box = (await overlay.boundingBox())!;
	await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
	await page.mouse.down();
	await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2 - 220, { steps: 8 });
	await page.mouse.up();

	await page.getByRole('button', { name: 'Layout bearbeiten' }).click();
	await expect(page.locator('.overlay')).toHaveCount(0);

	// Rückgängig stellt die vorige Position wieder her
	const moved = await blockOf(page, 'std.ac').boundingBox();
	await page.getByRole('button', { name: 'Rückgängig' }).click();
	const undone = await blockOf(page, 'std.ac').boundingBox();
	expect(undone!.y).not.toBe(moved!.y);

	// Layout bleibt nach Neuladen erhalten
	await page.waitForTimeout(600);
	const persisted = await blockOf(page, 'std.ac').boundingBox();
	await page.reload();
	await expect(blockOf(page, 'std.ac')).toBeVisible();
	expect((await blockOf(page, 'std.ac').boundingBox())!.y).toBeCloseTo(persisted!.y, 0);
});

test('Baustein hinzufügen, einstellen, Größe ändern und entfernen', async ({ page }) => {
	await newCharacter(page);
	await page.getByRole('button', { name: 'Layout bearbeiten' }).click();
	await page.getByRole('button', { name: 'Baustein hinzufügen' }).click();
	const dialog = page.getByRole('dialog');
	await dialog.getByRole('button', { name: /^Feld Ein Zahlenwert/ }).click();
	await dialog.getByLabel('Feld').selectOption({ label: 'Stufe' });
	await dialog.getByRole('button', { name: 'Hinzufügen' }).click();
	await expect(blockOf(page, 'std.level')).toBeVisible();

	const block = blockOf(page, 'std.level');
	const before = (await block.boundingBox())!;
	const handle = (await block.locator('.resize').boundingBox())!;
	await page.mouse.move(handle.x + handle.width / 2, handle.y + handle.height / 2);
	await page.mouse.down();
	await page.mouse.move(handle.x + 200, handle.y + handle.height / 2, { steps: 6 });
	await page.mouse.up();
	expect((await block.boundingBox())!.width).toBeGreaterThan(before.width + 100);

	await block.getByRole('button', { name: 'Baustein einstellen' }).click();
	await dialog.getByLabel('Überschrift').fill('Charakterstufe');
	await dialog.getByRole('button', { name: 'Übernehmen' }).click();
	await page.getByRole('button', { name: 'Layout bearbeiten' }).click();
	await expect(blockOf(page, 'std.level').getByText('Charakterstufe')).toBeVisible();

	await page.getByRole('button', { name: 'Layout bearbeiten' }).click();
	await blockOf(page, 'std.level').getByRole('button', { name: 'Baustein entfernen' }).click();
	await page.getByRole('button', { name: 'Entfernen', exact: true }).click();
	await expect(page.locator('[data-tab] [data-field="std.level"]')).toHaveCount(0);
});

test('Tabs anlegen, umbenennen, ausblenden', async ({ page }) => {
	await newCharacter(page);
	await page.getByRole('button', { name: 'Layout bearbeiten' }).click();
	await page.locator('nav').getByRole('button', { name: 'Tab', exact: true }).click();
	const names = page.locator('nav').getByLabel('Tabname');
	await expect(names).toHaveCount(7);
	await names.last().fill('Begleiter');
	await page.getByRole('button', { name: 'Baustein hinzufügen' }).click();
	await page.getByRole('dialog').getByRole('button', { name: /^Textblock/ }).click();
	await page.getByRole('dialog').getByRole('button', { name: 'Hinzufügen' }).click();
	await page.getByRole('button', { name: 'Layout bearbeiten' }).click();
	await expect(tabButton(page, 'Begleiter')).toBeVisible();

	await page.getByRole('button', { name: 'Layout bearbeiten' }).click();
	const notes = page.locator('nav .tab-edit').nth(5);
	await expect(notes.getByLabel('Tabname')).toHaveValue('Notizen');
	await notes.getByRole('button', { name: 'Ausblenden' }).click();
	await page.getByRole('button', { name: 'Layout bearbeiten' }).click();
	await expect(tabButton(page, 'Notizen')).toHaveCount(0);
	await expect(tabButton(page, 'Begleiter')).toBeVisible();
});

test('Zauber anlegen, in Listen einordnen, Zauberplätze ankreuzen', async ({ page }) => {
	await newCharacter(page);
	await tabButton(page, 'Zauber').click();
	const prepared = page.locator('section', { has: page.getByRole('heading', { name: 'Vorbereitet' }) });
	const known = page.locator('section', { has: page.getByRole('heading', { name: 'Bekannt' }) });

	await prepared.getByLabel('Zaubername').fill('Feuerball');
	await prepared.getByLabel('Grad').selectOption({ label: 'Grad 3' });
	await prepared.getByLabel('Zaubername').press('Enter');
	await expect(prepared.getByRole('button', { name: /Feuerball/ })).toBeVisible();
	await expect(known.getByText('Feuerball')).toHaveCount(0);

	await prepared.getByRole('button', { name: /Feuerball/ }).click();
	const panel = page.locator('[data-inspect-spell]');
	await panel.getByLabel('Schule').fill('Hervorrufung');
	await panel.getByPlaceholder('18 m').fill('45 m');
	await panel.getByLabel('Bekannt').check();
	await expect(known.getByRole('button', { name: /Feuerball/ })).toBeVisible();
	await expect(prepared.getByText('Hervorrufung')).toBeVisible();
	await page.locator('aside').getByRole('button', { name: 'Schließen', exact: true }).click();

	const slots = page.locator('section', { has: page.getByRole('heading', { name: 'Zauberplätze' }) });
	await slots.getByRole('button', { name: 'Anzahl ändern' }).click();
	const grad3 = slots.locator('.counter', { hasText: 'Grad 3' });
	await grad3.getByRole('button', { name: 'Kästchen hinzufügen' }).click();
	await grad3.getByRole('button', { name: 'Kästchen hinzufügen' }).click();
	await slots.getByRole('button', { name: 'Fertig' }).click();
	await expect(slots.locator('.counter')).toHaveCount(1);
	await slots.getByRole('button', { name: /Kästchen 1 frei/ }).click();
	await expect(slots.getByRole('button', { name: /Kästchen 1 angekreuzt/ })).toBeVisible();
});
