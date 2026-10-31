import type { Page } from '@playwright/test';
import { expect, test } from './fixtures';

// Aktionsübersicht: Aktionen, Bonusaktionen, Reaktionen und Sonstiges aus Items, Fähigkeiten und Zaubern.

async function newCharacter(page: Page, name: string) {
	await page.goto('./');
	await page.getByLabel('Name des neuen Charakters').fill(name);
	await page.getByRole('button', { name: 'Neuer Charakter' }).click();
	await expect(page.locator('[data-tab]')).toBeVisible();
}
const nav = (page: Page, name: string) => page.locator('nav').getByRole('button', { name: new RegExp(`^${name}`) }).first();
const column = (page: Page, kind: string) => page.locator(`[data-tab] section[data-kind="${kind}"]`);
const closePanel = async (page: Page) => {
	const close = page.locator('aside').getByRole('button', { name: 'Schließen', exact: true });
	if (await close.isVisible()) await close.click();
};

test('Waffe mit Angriffsaktion: Werte aus Formeln, im Rucksack nicht verfügbar', async ({ page }) => {
	await newCharacter(page, 'Kriegerin');
	await nav(page, 'Aktionen').click();
	await expect(column(page, 'action').getByRole('button', { name: 'Spurt' })).toBeVisible();
	await expect(column(page, 'reaction').getByRole('button', { name: 'Gelegenheitsangriff' })).toBeVisible();

	await nav(page, 'Übersicht').click();
	const equipped = page.locator('section', { has: page.getByRole('heading', { name: 'Ausgerüstet' }) });
	await equipped.getByLabel('Name').fill('Langschwert');
	await equipped.getByRole('button', { name: 'Anlegen' }).click();
	await equipped.getByRole('button', { name: 'Langschwert' }).click();

	const item = page.locator('[data-inspect-source]');
	await item.getByRole('button', { name: 'Aktion hinzufügen' }).click();
	const panel = page.locator('[data-inspect-action]');
	await expect(panel.getByLabel('Name')).toHaveValue('Angriff: Langschwert');
	await panel.getByLabel('Angriffsbonus').fill('@STR-Mod + @Übungsbonus');
	await panel.getByLabel('Angriffsbonus').press('Enter');
	await panel.getByLabel('Schaden', { exact: true }).fill('1d8 + @STR-Mod');
	await panel.getByLabel('Schaden', { exact: true }).press('Enter');
	await panel.getByPlaceholder('z. B. Hieb, Feuer').fill('Hieb');
	await expect(panel.getByText('+2', { exact: true })).toBeVisible();
	await closePanel(page);

	await nav(page, 'Aktionen').click();
	const entry = column(page, 'action').locator('[data-action]', { hasText: 'Angriff: Langschwert' });
	await expect(entry).toContainText('+2');
	await expect(entry).toContainText('1d8 Hieb');
	await expect(entry).toContainText('Langschwert');

	// In den Rucksack: Aktion bleibt sichtbar, aber nicht verfügbar
	await nav(page, 'Inventar').click();
	await page.locator('[data-item]', { hasText: 'Langschwert' }).getByRole('button', { name: /Langschwert/ }).click();
	await page.locator('[data-inspect-source]').getByRole('switch', { name: 'Ablegen' }).click();
	await closePanel(page);
	await nav(page, 'Aktionen').click();
	await expect(entry).toContainText('nicht ausgerüstet (in „Rucksack“)');
});

test('Zauber erscheinen nach Zeitaufwand; eigene Bonusaktion per Schnellanlage', async ({ page }) => {
	await newCharacter(page, 'Klerikerin');
	await nav(page, 'Zauber').click();
	const prepared = page.locator('section', { has: page.getByRole('heading', { name: 'Vorbereitet' }) });
	await prepared.getByLabel('Zaubername').fill('Heilendes Wort');
	await prepared.getByLabel('Zaubername').press('Enter');
	await prepared.getByRole('button', { name: /Heilendes Wort/ }).click();
	const spell = page.locator('[data-inspect-spell]');
	await spell.getByPlaceholder('1 Aktion').fill('1 Bonusaktion');
	await expect(spell.getByLabel('Art in der Aktionsübersicht').locator('option').first()).toHaveText(/automatisch.*Bonusaktion/);
	await spell.getByLabel('Schaden', { exact: true }).fill('1d4 + 2');
	await spell.getByLabel('Schaden', { exact: true }).press('Enter');
	await closePanel(page);

	await nav(page, 'Aktionen').click();
	await expect(column(page, 'bonus').locator('[data-action]', { hasText: 'Heilendes Wort' })).toContainText('1d4 + 2');

	// Eigene Bonusaktion
	await page.getByLabel('Name der Aktion').fill('Zweite Luft');
	await page.getByLabel('Art der Aktion').selectOption({ label: 'Bonusaktion' });
	await page.getByRole('button', { name: 'Anlegen' }).click();
	await expect(column(page, 'bonus').locator('[data-action]', { hasText: 'Zweite Luft' })).toBeVisible();

	// Art umstellen über das Panel
	await column(page, 'bonus').getByRole('button', { name: 'Zweite Luft' }).click();
	await page.locator('[data-inspect-action]').getByRole('radio', { name: 'Sonstiges' }).click();
	await expect(column(page, 'other').locator('[data-action]', { hasText: 'Zweite Luft' })).toBeVisible();
	await page.getByRole('button', { name: 'Rückgängig' }).click();
	await expect(column(page, 'bonus').locator('[data-action]', { hasText: 'Zweite Luft' })).toBeVisible();
});
