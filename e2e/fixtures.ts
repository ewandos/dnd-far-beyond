import { expect, test as base } from '@playwright/test';

/** Jeder Test schlägt fehl, wenn die Seite einen unbehandelten Fehler wirft. */
export const test = base.extend<{ pageErrors: string[] }>({
	pageErrors: [
		async ({ page }, use) => {
			const errors: string[] = [];
			page.on('pageerror', (e) => errors.push(e.message));
			await use(errors);
			expect(errors, 'Fehler auf der Seite').toEqual([]);
		},
		{ auto: true }
	]
});

export { expect };
