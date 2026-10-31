/// <reference types="@sveltejs/kit" />
/// <reference no-default-lib="true"/>
/// <reference lib="esnext" />
/// <reference lib="webworker" />

// Offline-first: Alle App-Dateien werden beim Installieren zwischengespeichert.
// Nutzerdaten liegen ausschließlich in IndexedDB, nie im Cache.

import { build, files, version } from '$service-worker';

const sw = self as unknown as ServiceWorkerGlobalScope;
const CACHE = `charakterbogen-${version}`;
const ASSETS = [...build, ...files, './'];

sw.addEventListener('install', (event) => {
	event.waitUntil(
		caches
			.open(CACHE)
			.then((cache) => cache.addAll(ASSETS))
			.then(() => sw.skipWaiting())
	);
});

sw.addEventListener('activate', (event) => {
	event.waitUntil(
		caches
			.keys()
			.then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
			.then(() => sw.clients.claim())
	);
});

sw.addEventListener('fetch', (event) => {
	const req = event.request;
	if (req.method !== 'GET') return;
	const url = new URL(req.url);
	if (url.origin !== sw.location.origin) return;

	event.respondWith(
		(async () => {
			const cache = await caches.open(CACHE);
			// Navigation: immer die App-Hülle (Hash-Routing), zuerst aus dem Cache.
			if (req.mode === 'navigate') {
				const shell = (await cache.match('./')) ?? (await cache.match('index.html'));
				if (shell) return shell;
			}
			const cached = await cache.match(req, { ignoreSearch: true });
			if (cached) return cached;
			try {
				const res = await fetch(req);
				if (res.ok && res.type === 'basic') cache.put(req, res.clone());
				return res;
			} catch {
				const fallback = await cache.match('./');
				if (fallback) return fallback;
				return new Response('Offline', { status: 503 });
			}
		})()
	);
});
