import adapter from '@sveltejs/adapter-static';
import { vitePreprocess } from '@sveltejs/vite-plugin-svelte';

/** @type {import('@sveltejs/kit').Config} */
const config = {
	preprocess: vitePreprocess(),
	kit: {
		// Statische SPA: läuft auf jedem Static-Host (z. B. GitHub Pages) unter beliebigem Unterpfad.
		adapter: adapter(),
		router: { type: 'hash' },
		// Für GitHub Pages: BASE_PATH=/<repo-name> npm run build
		paths: { base: process.env.BASE_PATH ?? '', relative: true }
	}
};

export default config;
