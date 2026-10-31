import type { Page } from '@playwright/test';
import { expect, test } from './fixtures';

// Phase 4: Feldtypen Würfelausdruck und Liste, Point-Buy-Rechner, Hintergrund-Assistent.

async function newCharacter(page: Page, name: string) {
	await page.goto('./');
	await page.getByLabel('Name des neuen Charakters').fill(name);
	await page.getByRole('button', { name: 'Neuer Charakter' }).click();
	await expect(page.locator('[data-tab]')).toBeVisible();
}
const nav = (page: Page, name: string) => page.locator('nav').getByRole('button', { name: new RegExp(`^${name}`) }).first();
const value = (page: Page, id: string) => page.locator(`[data-tab] [data-field="${id}"]`).first();
const closePanel = async (page: Page) => {
	const close = page.locator('aside').getByRole('button', { name: 'Schließen', exact: true });
	if (await close.isVisible()) await close.click();
};
async function setBase(page: Page, id: string, v: number) {
	await closePanel(page);
	await value(page, id).click();
	const input = page.locator('[data-inspect-field]').getByLabel(/^Basiswert/);
	await input.fill(String(v));
	await input.press('Enter');
}
async function createField(page: Page, name: string, type: 'Würfelausdruck' | 'Liste', dice?: string) {
	await closePanel(page);
	await nav(page, 'Verwaltung').click();
	await page.getByLabel('Feldname').fill(name);
	await page.getByLabel('Feldtyp').selectOption({ label: type });
	if (dice) await page.getByLabel('Würfel-Basiswert', { exact: true }).fill(dice);
	await page.getByRole('button', { name: 'Anlegen' }).first().click();
	await nav(page, 'Übersicht').click();
}

test('Würfelfeld: Basis, Referenz auf STR-Mod, Zustand mit Zusatzwürfel', async ({ page }) => {
	await newCharacter(page, 'Kämpferin');
	await setBase(page, 'std.str_mod', 3);
	await createField(page, 'Langschwert', 'Würfelausdruck', '1d8');
	await closePanel(page);
	const sword = page.locator('[data-tab] .row', { hasText: 'Langschwert' }).locator('[data-field]');
	await expect(sword).toHaveText('1d8');

	await sword.click();
	const panel = page.locator('[data-inspect-field]');
	await panel.getByRole('button', { name: 'Modifikator hinzufügen' }).click();
	await expect(panel.getByLabel('Operation').locator('option')).toHaveCount(2);
	await panel.getByLabel('Wert oder Formel').fill('@STR-Mod');
	await panel.getByRole('button', { name: 'Hinzufügen', exact: true }).click();
	await expect(sword).toHaveText('1d8 + 3');
	await expect(panel.getByText('1d8 → 1d8 + 3')).toBeVisible();
	await closePanel(page);

	const conditions = page.locator('section', { has: page.getByRole('heading', { name: 'Zustände' }) });
	await conditions.getByLabel('Name').fill('Hexenfluch');
	await conditions.getByLabel('Zielfeld').selectOption({ label: 'Langschwert' });
	await conditions.getByLabel('Wert oder Formel').fill('1W6');
	await conditions.getByRole('button', { name: 'Anlegen' }).click();
	await expect(sword).toHaveText('1d8 + 1d6 + 3');
	await conditions.getByRole('switch', { name: /Hexenfluch ausschalten/ }).click();
	await expect(sword).toHaveText('1d8 + 3');
});

test('Listenfeld: Basis-Einträge und Einträge aus einem Item', async ({ page }) => {
	await newCharacter(page, 'Polyglott');
	await createField(page, 'Sprachen', 'Liste');
	const langs = page.locator('[data-tab] .row', { hasText: 'Sprachen' }).locator('[data-field]');
	await expect(langs).toHaveText('—');
	await langs.click();
	const add = page.locator('[data-inspect-field]').getByLabel('Sprachen hinzufügen');
	await add.fill('Gemeinsprache, Zwergisch');
	await add.press('Enter');
	await expect(langs).toHaveText('Gemeinsprache, Zwergisch');
	await closePanel(page);

	const equipped = page.locator('section', { has: page.getByRole('heading', { name: 'Ausgerüstet' }) });
	await equipped.getByLabel('Name').fill('Helm der Sprachen');
	await equipped.getByLabel('Zielfeld').selectOption({ label: 'Sprachen' });
	await equipped.getByLabel('Wert oder Formel').fill('Elfisch, zwergisch');
	await equipped.getByRole('button', { name: 'Anlegen' }).click();
	await expect(langs).toHaveText('Gemeinsprache, Zwergisch, Elfisch');
});

test('Point-Buy übernimmt Werte und Modifikatoren in einem Schritt', async ({ page }) => {
	await newCharacter(page, 'Rechnerin');
	await nav(page, 'Verwaltung').click();
	await page.getByRole('button', { name: 'Point-Buy' }).click();
	const dialog = page.getByRole('dialog');
	for (let i = 0; i < 5; i++) await dialog.getByRole('button', { name: 'STR erhöhen' }).click();
	await expect(dialog.getByText('Übrig')).toContainText('22');
	await dialog.getByLabel('Bonus STR').fill('2');
	await dialog.getByLabel('Bonus STR').press('Enter');
	await dialog.getByRole('button', { name: 'Übernehmen' }).click();
	await nav(page, 'Übersicht').click();
	await expect(value(page, 'std.str')).toHaveText('15');
	await expect(value(page, 'std.str_mod')).toHaveText('+2');
	await expect(value(page, 'std.dex')).toHaveText('8');
	await expect(value(page, 'std.dex_mod')).toHaveText('−1');
	await page.getByRole('button', { name: 'Rückgängig' }).click();
	await expect(value(page, 'std.str')).toHaveText('10');
});

test('Hintergrund-Assistent trägt Übungen, Erhöhungen, Ausrüstung und Gold ein', async ({ page }) => {
	await newCharacter(page, 'Akolythin');
	await nav(page, 'Verwaltung').click();
	await page.getByRole('button', { name: 'Hintergrund', exact: true }).click();
	const dialog = page.getByRole('dialog');
	await dialog.getByPlaceholder('z. B. Akolyth').fill('Akolyth');
	await dialog.getByLabel('Motiv erkennen').check();
	await dialog.getByLabel('Religion').check();
	await dialog.getByLabel('Art der Erhöhung').selectOption('21');
	await dialog.getByLabel('Attribut 1').selectOption('wis');
	await dialog.getByLabel('Attribut 2').selectOption('int');
	await dialog.getByLabel('Name des Merkmals').fill('Magie-Eingeweihter');
	await dialog.getByLabel('ist ein Talent').check();
	await dialog.getByPlaceholder(/Heiliges Symbol/).fill('Heiliges Symbol\n5x Kerze');
	await dialog.getByLabel('Gold dazu (GM)').fill('15');
	await dialog.getByRole('button', { name: 'Eintragen' }).click();

	await nav(page, 'Übersicht').click();
	await expect(value(page, 'std.wis')).toHaveText('12');
	await expect(value(page, 'std.int')).toHaveText('11');
	await value(page, 'std.wis').click();
	await expect(page.locator('[data-inspect-field]').getByRole('button', { name: 'Akolyth' })).toBeVisible();
	await closePanel(page);
	const insight = page.locator('[data-tab] .row', { has: page.locator('[data-field="std.skill_insight"]') });
	await expect(insight.getByRole('button', { name: /Übung: geübt/ })).toBeVisible();

	await nav(page, 'Inventar').click();
	await expect(page.locator('[data-item]', { hasText: 'Kerze' })).toContainText('×5');
	await expect(value(page, 'std.gp')).toHaveText('15');
	await nav(page, 'Fähigkeiten').click();
	await expect(page.locator('[data-ability]', { hasText: 'Magie-Eingeweihter' })).toContainText('Talent');
});
