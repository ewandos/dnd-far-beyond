import type { Page } from '@playwright/test';
import { fileURLToPath } from 'node:url';
import { expect, test } from './fixtures';

// Phase 3: Austausch einzelner Inhalte, Zuordnung nicht zugeordneter Modifikatoren, 5eTools-Import.

async function newCharacter(page: Page, name: string) {
	await page.goto('./');
	await page.getByLabel('Name des neuen Charakters').fill(name);
	await page.getByRole('button', { name: 'Neuer Charakter' }).click();
	await expect(page.locator('[data-tab]')).toBeVisible();
}

const value = (page: Page, fieldId: string) => page.locator(`[data-tab] [data-field="${fieldId}"]`).first();
const nav = (page: Page, name: string) => page.locator('nav').getByRole('button', { name: new RegExp(`^${name}`) }).first();
const closePanel = async (page: Page) => {
	const close = page.locator('aside').getByRole('button', { name: 'Schließen', exact: true });
	if (await close.isVisible()) await close.click();
};

async function importFile(page: Page, path: string) {
	await page.getByRole('button', { name: 'Inhalte importieren' }).click();
	const dialog = page.getByRole('dialog');
	const chooser = page.waitForEvent('filechooser');
	await dialog.getByRole('button', { name: 'Datei wählen' }).click();
	await (await chooser).setFiles(path);
	return dialog;
}

test('SL verteilt ein Item und eine Fähigkeit; Spieler ordnet den Modifikator zu', async ({ page }) => {
	// SL-Bogen: eigenes Feld „Ruhm“, Item mit RK +2, Fähigkeit mit Modifikator auf „Ruhm“
	await newCharacter(page, 'Spielleitung');
	await nav(page, 'Verwaltung').click();
	await page.getByLabel('Feldname').fill('Ruhm');
	await page.getByRole('button', { name: 'Anlegen' }).first().click();
	await nav(page, 'Übersicht').click();
	await closePanel(page);

	const equipped = page.locator('section', { has: page.getByRole('heading', { name: 'Ausgerüstet' }) });
	await equipped.getByLabel('Name').fill('Mantel der Macht');
	await equipped.getByLabel('Zielfeld').selectOption({ label: 'RK' });
	await equipped.getByLabel('Wert oder Formel').fill('2');
	await equipped.getByRole('button', { name: 'Anlegen' }).click();
	await nav(page, 'Fähigkeiten').click();
	const abilities = page.locator('section', { has: page.getByRole('heading', { name: 'Fähigkeiten', exact: true }) });
	await abilities.getByLabel('Name').fill('Held von Hammerfall');
	await abilities.getByLabel('Zielfeld').selectOption({ label: 'Ruhm' });
	await abilities.getByLabel('Wert oder Formel').fill('3');
	await abilities.getByRole('button', { name: 'Anlegen' }).click();

	await nav(page, 'Verwaltung').click();
	await page.getByRole('button', { name: 'Exportieren', exact: true }).click();
	const dialog = page.getByRole('dialog');
	await dialog.getByRole('checkbox', { name: 'Mantel der Macht' }).check();
	await dialog.getByRole('checkbox', { name: 'Held von Hammerfall' }).check();
	const download = page.waitForEvent('download');
	await dialog.getByRole('button', { name: /Exportieren/ }).click();
	const path = await (await download).path();

	// Spieler-Bogen
	await page.goto('./');
	await newCharacter(page, 'Spielerin');
	const imp = await importFile(page, path);
	await expect(imp.getByText('Mantel der Macht')).toBeVisible();
	await expect(imp.getByText('Held von Hammerfall')).toBeVisible();
	await imp.getByRole('button', { name: '2 importieren' }).click();
	await expect(page.getByText(/1 Modifikator nicht zugeordnet/)).toBeVisible();

	// Item liegt im Rucksack: noch keine Wirkung
	await expect(value(page, 'std.ac')).toHaveText('10');
	await nav(page, 'Inventar').click();
	await page.locator('[data-item]', { hasText: 'Mantel der Macht' }).getByRole('button', { name: /Mantel der Macht/ }).click();
	await page.locator('[data-inspect-source]').getByRole('switch', { name: 'Ausrüsten' }).click();
	await closePanel(page);
	await nav(page, 'Übersicht').click();
	await expect(value(page, 'std.ac')).toHaveText('12');

	// Nicht zugeordnet: Feld „Ruhm“ gibt es bei der Spielerin nicht → selbst anlegen und zuordnen
	await expect(page.locator('nav .badge')).toHaveText('1');
	await nav(page, 'Verwaltung').click();
	await expect(page.getByText('ursprünglich „Ruhm“')).toBeVisible();
	await page.getByLabel('Feldname').fill('Ansehen');
	await page.getByRole('button', { name: 'Anlegen' }).first().click();
	await closePanel(page);
	await page.getByLabel('Zielfeld wählen').selectOption({ label: 'Ansehen' });
	await expect(page.locator('nav .badge')).toHaveCount(0);
	await expect(page.locator('[data-field]', { hasText: '3' }).first()).toBeVisible();

	// Erneuter Import erzeugt ein zweites Item
	const again = await importFile(page, path);
	await again.getByRole('checkbox', { name: 'Held von Hammerfall' }).uncheck();
	await again.getByRole('button', { name: '1 importieren' }).click();
	await nav(page, 'Inventar').click();
	await expect(page.locator('[data-item]', { hasText: 'Mantel der Macht' })).toHaveCount(2);
});

test('5eTools-Datei: Auswahl, Zauber in Liste, Beschreibung als Markdown', async ({ page }) => {
	await newCharacter(page, 'Leserin');
	const dialog = await importFile(page, fileURLToPath(new URL('./fixtures/5etools-sample.json', import.meta.url)));
	await expect(dialog.getByText('5eTools · 4 Einträge')).toBeVisible();
	// Kleine Dateien sind komplett vorausgewählt
	await expect(dialog.getByText('4 ausgewählt')).toBeVisible();
	await dialog.getByRole('button', { name: 'Angezeigte abwählen' }).click();
	await dialog.getByLabel('Einträge suchen').fill('fire');
	await expect(dialog.locator('.entries li')).toHaveCount(1);
	await dialog.getByRole('checkbox', { name: 'Fireball' }).check();
	await dialog.getByLabel('Einträge suchen').fill('');
	await dialog.getByRole('checkbox', { name: 'Alert' }).check();
	await dialog.getByRole('checkbox', { name: 'Cloak of Protection' }).check();
	await dialog.getByRole('button', { name: 'Vorschau Fireball' }).click();
	await expect(dialog.getByText('8d6 fire damage')).toBeVisible();
	await dialog.getByLabel('Zauber in Liste').selectOption({ label: 'Vorbereitet' });
	await dialog.getByRole('button', { name: '3 importieren' }).click();
	await expect(page.getByText('3 Inhalte importiert')).toBeVisible();

	await nav(page, 'Zauber').click();
	const prepared = page.locator('section', { has: page.getByRole('heading', { name: 'Vorbereitet' }) });
	await prepared.getByRole('button', { name: /Fireball/ }).click();
	const panel = page.locator('[data-inspect-spell]');
	await expect(panel.getByLabel('Schule')).toHaveValue('Hervorrufung');
	await expect(panel.getByPlaceholder('18 m')).toHaveValue('150 feet');
	await expect(panel.locator('.md')).toContainText('8d6 fire damage');
	await expect(panel.getByText('Importierte Kopie')).toBeVisible();
	await closePanel(page);

	await nav(page, 'Fähigkeiten').click();
	await expect(page.locator('[data-ability]', { hasText: 'Alert' })).toContainText('Talent');
	await nav(page, 'Inventar').click();
	await expect(page.locator('[data-item]', { hasText: 'Cloak of Protection' })).toContainText('Einstimmung');
});

test('Charakter-Datei im Inhalts-Import wird verständlich abgelehnt', async ({ page }) => {
	await newCharacter(page, 'Prüferin');
	const download = page.waitForEvent('download');
	await page.getByRole('button', { name: /Exportieren/ }).first().click();
	const path = await (await download).path();
	const dialog = await importFile(page, path);
	await expect(dialog.getByRole('alert')).toContainText('Charakter-Datei');
});
