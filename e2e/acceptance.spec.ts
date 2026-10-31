import type { Page } from '@playwright/test';
import { expect, test } from './fixtures';

// Abnahmekriterien MVP aus dem Design Document, als Ende-zu-Ende-Tests.

async function newCharacter(page: Page, name = 'Testheld') {
	await page.goto('./');
	await page.getByLabel('Name des neuen Charakters').fill(name);
	await page.getByRole('button', { name: 'Neuer Charakter' }).click();
	await expect(page.locator('[data-tab]')).toBeVisible();
}

const value = (page: Page, fieldId: string) => page.locator(`[data-tab] [data-field="${fieldId}"]`).first();

async function closePanel(page: Page) {
	const close = page.locator('aside').getByRole('button', { name: 'Schließen', exact: true });
	if (await close.isVisible()) await close.click();
}

async function setBase(page: Page, fieldId: string, v: number) {
	await closePanel(page);
	await value(page, fieldId).click();
	const input = page.locator('[data-inspect-field]').getByLabel(/^Basiswert/);
	await input.fill(String(v));
	await input.press('Enter');
}

test('Mantel der Macht: schnell angelegt, ablegen senkt die RK sofort', async ({ page }) => {
	await newCharacter(page);
	await expect(value(page, 'std.ac')).toHaveText('10');

	const start = Date.now();
	const equipped = page.locator('section', { has: page.getByRole('heading', { name: 'Ausgerüstet' }) });
	await equipped.getByLabel('Name').fill('Mantel der Macht');
	await equipped.getByLabel('Zielfeld').selectOption({ label: 'RK' });
	await equipped.getByLabel('Wert oder Formel').fill('2');
	await equipped.getByLabel('Wert oder Formel').press('Enter');
	expect(Date.now() - start).toBeLessThan(30_000);

	await expect(value(page, 'std.ac')).toHaveText('12');
	await expect(equipped.getByText('RK +2')).toBeVisible();

	// Inspektion: Modifikator mit Quelle
	await value(page, 'std.ac').click();
	const panel = page.locator('[data-inspect-field="std.ac"]');
	await expect(panel.getByText('Mantel der Macht').first()).toBeVisible();

	// Ablegen über den Schalter der Quelle im Panel
	await panel.getByRole('switch', { name: 'Ablegen' }).click();
	await expect(value(page, 'std.ac')).toHaveText('10');
	await expect(panel.getByText('nicht ausgerüstet (in „Rucksack“)')).toBeVisible();

	// Rückgängig stellt den Zustand wieder her
	await page.getByRole('button', { name: 'Rückgängig' }).first().click();
	await expect(value(page, 'std.ac')).toHaveText('12');
});

test('RK-Beispiel ergibt 20 und ist nachvollziehbar', async ({ page }) => {
	await newCharacter(page);
	await setBase(page, 'std.dex_mod', 3);

	// Magierrüstung als Fähigkeit mit Setzen-Modifikator
	await page.getByRole('button', { name: 'Fähigkeiten', exact: true }).click();
	const abilities = page.locator('section', { has: page.getByRole('heading', { name: /^Fähigkeiten/ }) });
	await abilities.getByLabel('Name').fill('Magierrüstung');
	await abilities.getByLabel('Zielfeld').selectOption({ label: 'RK' });
	await abilities.getByLabel('Operation').selectOption('set');
	await abilities.getByLabel('Wert oder Formel').fill('13 + @GES-Mod');
	await abilities.getByRole('button', { name: 'Anlegen' }).click();

	await page.getByRole('button', { name: 'Übersicht' }).click();
	await closePanel(page);
	const equipped = page.locator('section', { has: page.getByRole('heading', { name: 'Ausgerüstet' }) });
	for (const name of ['Schild', 'Mantel der Macht']) {
		await equipped.getByLabel('Name').fill(name);
		await equipped.getByLabel('Zielfeld').selectOption({ label: 'RK' });
		await equipped.getByLabel('Wert oder Formel').fill('2');
		await equipped.getByRole('button', { name: 'Anlegen' }).click();
	}
	await expect(value(page, 'std.ac')).toHaveText('20');

	await value(page, 'std.ac').click();
	const panel = page.locator('[data-inspect-field="std.ac"]');
	await expect(panel.getByText('= 16').first()).toBeVisible();
	await expect(panel.getByText('10 → 16')).toBeVisible();
	await expect(panel.getByText('16 → 18')).toBeVisible();
	await expect(panel.getByText('18 → 20')).toBeVisible();
	await panel.getByRole('button', { name: 'Referenz' }).click();
	await expect(panel.locator('.refs').getByText('@GES-Mod')).toBeVisible();

	// Sprung zur Quelle und zurück
	await panel.getByRole('button', { name: 'Magierrüstung' }).click();
	await expect(page.locator('[data-inspect-source]')).toBeVisible();
	await page.locator('aside').getByRole('button', { name: 'RK' }).first().click();
	await expect(panel).toBeVisible();
});

test('Krankheit lässt sich an- und ausschalten', async ({ page }) => {
	await newCharacter(page);
	const conditions = page.locator('section', { has: page.getByRole('heading', { name: 'Zustände' }) });
	await conditions.getByLabel('Name').fill('Krankheit');
	await conditions.getByLabel('Zielfeld').selectOption({ label: 'KON' });
	await conditions.getByLabel('Wert oder Formel').fill('-2');
	await conditions.getByRole('button', { name: 'Anlegen' }).click();
	await expect(value(page, 'std.con')).toHaveText('8');

	// Zweiter Modifikator über die Quellen-Karte
	await conditions.getByRole('button', { name: 'Krankheit' }).click();
	const src = page.locator('[data-inspect-source]');
	await src.getByRole('button', { name: 'Modifikator hinzufügen' }).click();
	await src.getByLabel('Zielfeld').selectOption({ label: 'STR' });
	await src.getByLabel('Wert oder Formel').fill('-4');
	await src.getByRole('button', { name: 'Hinzufügen', exact: true }).click();
	await expect(value(page, 'std.str')).toHaveText('6');
	await closePanel(page);

	await conditions.getByRole('switch', { name: /Krankheit ausschalten/ }).click();
	await expect(value(page, 'std.con')).toHaveText('10');
	await expect(value(page, 'std.str')).toHaveText('10');
	await expect(conditions.getByText('Krankheit')).toBeVisible();
	await conditions.getByRole('switch', { name: /Krankheit einschalten/ }).click();
	await expect(value(page, 'std.str')).toHaveText('6');
});

test('Athletik folgt STR-Mod und Übungsbonus; Expertise verdoppelt', async ({ page }) => {
	await newCharacter(page);
	await setBase(page, 'std.str_mod', 3);
	await expect(value(page, 'std.skill_athletics')).toHaveText('+3');
	const row = page.locator('[data-tab] .row', { has: page.locator('[data-field="std.skill_athletics"]') });
	await row.getByRole('button', { name: /Übung: keine/ }).click();
	await expect(value(page, 'std.skill_athletics')).toHaveText('+5');
	await row.getByRole('button', { name: /Übung: geübt/ }).click();
	await expect(value(page, 'std.skill_athletics')).toHaveText('+7');
	await setBase(page, 'std.prof', 3);
	await expect(value(page, 'std.skill_athletics')).toHaveText('+9');
	// halbe Übung rundet ab: 3 + floor(1,5)
	await row.getByRole('button', { name: /Übung: Expertise/ }).click();
	await expect(value(page, 'std.skill_athletics')).toHaveText('+4');
});

test('Zirkelbezug wird angezeigt, ohne abzustürzen; Umbenennen bricht keine Formel', async ({ page }) => {
	const errors: string[] = [];
	page.on('pageerror', (e) => errors.push(e.message));
	await newCharacter(page);
	await setBase(page, 'std.dex_mod', 2);

	await value(page, 'std.dex_mod').click();
	const panel = page.locator('[data-inspect-field="std.dex_mod"]');
	await panel.getByRole('button', { name: 'Modifikator hinzufügen' }).click();
	await panel.getByLabel('Wert oder Formel').fill('@Initiative');
	await panel.getByRole('button', { name: 'Hinzufügen', exact: true }).click();
	await expect(panel.getByText(/Zirkelbezug: GES-Mod → Initiative → GES-Mod/)).toBeVisible();
	// Beide beteiligten Modifikatoren zählen nicht – der Rest rechnet weiter.
	await expect(value(page, 'std.dex_mod')).toHaveText('+2');
	await expect(value(page, 'std.initiative')).toHaveText('+0');
	await expect(page.locator('[data-tab] [data-field="std.initiative"] .flag.err')).toBeVisible();
	await expect(page.locator('[data-tab] [data-field="std.skill_acrobatics"]')).toHaveText('+2');

	// Umbenennen
	await panel.getByLabel('Feldname').fill('Geschick');
	await closePanel(page);
	await value(page, 'std.initiative').click();
	await expect(page.locator('[data-inspect-field="std.initiative"]').getByText('@Geschick', { exact: true })).toBeVisible();
	await expect(value(page, 'std.initiative')).toHaveText('+0');
	expect(errors).toEqual([]);
});

test('Export, Löschen und Re-Import ergibt denselben Bogen', async ({ page }) => {
	await newCharacter(page, 'Exportheld');
	await setBase(page, 'std.ac', 15);
	await closePanel(page);
	const equipped = page.locator('section', { has: page.getByRole('heading', { name: 'Ausgerüstet' }) });
	await equipped.getByLabel('Name').fill('Ring des Schutzes');
	await equipped.getByLabel('Zielfeld').selectOption({ label: 'RK' });
	await equipped.getByLabel('Wert oder Formel').fill('1');
	await equipped.getByRole('button', { name: 'Anlegen' }).click();
	await expect(value(page, 'std.ac')).toHaveText('16');

	const download = page.waitForEvent('download');
	await page.getByRole('button', { name: /Exportieren/ }).click();
	const file = await download;
	const path = await file.path();
	await page.waitForTimeout(600);

	await page.getByRole('link', { name: 'Alle Charaktere' }).click();
	await page.getByRole('button', { name: 'Exportheld löschen' }).click();
	await page.getByRole('button', { name: 'Endgültig löschen' }).click();
	await expect(page.getByText('Noch keine Charaktere')).toBeVisible();

	const chooser = page.waitForEvent('filechooser');
	await page.getByRole('button', { name: 'Importieren' }).click();
	await (await chooser).setFiles(path);
	await page.getByRole('link', { name: /Exportheld/ }).click();
	await expect(value(page, 'std.ac')).toHaveText('16');
	await expect(page.getByText('Ring des Schutzes').first()).toBeVisible();
	await page.locator('nav').getByRole('button', { name: 'Verlauf' }).click();
	await expect(page.locator('.history').getByText('Item angelegt: Ring des Schutzes').first()).toBeVisible();
});

test('Daten überleben ein Neuladen', async ({ page }) => {
	await newCharacter(page, 'Persistent');
	await setBase(page, 'std.hp_max', 34);
	await page.waitForTimeout(700);
	await page.reload();
	await expect(value(page, 'std.hp_max')).toHaveText('34');
});

test('App startet offline (Service Worker)', async ({ page, context }) => {
	await page.goto('./');
	await page.evaluate(() => navigator.serviceWorker.ready);
	await page.reload();
	await expect.poll(() => page.evaluate(() => !!navigator.serviceWorker.controller)).toBe(true);
	await context.setOffline(true);
	await page.reload();
	await expect(page.getByRole('heading', { name: 'Charakterbogen' })).toBeVisible();
	await page.getByLabel('Name des neuen Charakters').fill('Offline');
	await page.getByRole('button', { name: 'Neuer Charakter' }).click();
	await expect(page.locator('[data-tab]')).toBeVisible();
	await context.setOffline(false);
});
