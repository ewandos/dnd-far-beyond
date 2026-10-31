import { defineConfig } from '@playwright/test';

export default defineConfig({
	testDir: 'e2e',
	webServer: {
		command: 'npm run build && npx vite preview --port 4173 --strictPort',
		port: 4173,
		reuseExistingServer: true,
		timeout: 120_000
	},
	use: { baseURL: 'http://localhost:4173/' },
	projects: [
		{ name: 'laptop', use: { viewport: { width: 1280, height: 800 } } },
		// iPad hochkant: Die App skaliert das 1024-px-Layout proportional (Meta-Viewport).
		{ name: 'ipad-hoch', use: { viewport: { width: 820, height: 1180 }, isMobile: true, hasTouch: true, deviceScaleFactor: 2 } }
	]
});
