<script lang="ts">
	import { page } from '$app/state';
	import type { Character } from '$lib/engine/types';
	import { loadCharacter, saveCharacter } from '$lib/store/db';
	import { sheet } from '$lib/store/sheet.svelte';
	import { ui } from '$lib/store/ui.svelte';
	import SheetView from '$lib/ui/SheetView.svelte';

	let status = $state<'loading' | 'ready' | 'missing' | 'error'>('loading');
	let errorText = $state('');
	const id = $derived(page.params.id ?? '');

	$effect(() => {
		const current = id;
		status = 'loading';
		ui.close();
		ui.tab = '';
		ui.editMode = false;
		ui.dialog = null;
		ui.historyFilter = '';
		loadCharacter(current)
			.then((c) => {
				if (current !== id) return;
				sheet.load(c);
				status = c ? 'ready' : 'missing';
				if (c) document.title = `${c.name} – Charakterbogen`;
			})
			.catch((e) => {
				status = 'error';
				errorText = String(e);
			});
		return () => {
			void flush();
			sheet.load(null);
		};
	});

	// Automatisch speichern: kurz nach jeder Änderung und beim Verlassen der Seite.
	let pending: Character | null = null;
	let timer: ReturnType<typeof setTimeout> | undefined;

	async function flush() {
		clearTimeout(timer);
		const data = pending;
		pending = null;
		if (data) {
			try {
				await saveCharacter(data);
			} catch (e) {
				ui.toast('Speichern fehlgeschlagen: ' + String(e));
			}
		}
	}

	$effect(() => {
		if (status !== 'ready' || !sheet.character) return;
		const snap = $state.snapshot(sheet.character);
		if (snap.id !== id) return;
		pending = snap;
		document.title = `${snap.name} – Charakterbogen`;
		clearTimeout(timer);
		timer = setTimeout(flush, 400);
	});

	$effect(() => {
		const onHide = () => {
			if (document.visibilityState === 'hidden') void flush();
		};
		document.addEventListener('visibilitychange', onHide);
		window.addEventListener('pagehide', flush);
		return () => {
			document.removeEventListener('visibilitychange', onHide);
			window.removeEventListener('pagehide', flush);
		};
	});
</script>

{#if status === 'ready' && sheet.character}
	<SheetView onexported={() => void flush()} />
{:else if status === 'missing'}
	<div class="msg">
		<h1>Charakter nicht gefunden</h1>
		<p>Auf diesem Gerät gibt es keinen Charakter mit dieser Adresse. Vielleicht wurde er gelöscht – ein Export lässt sich jederzeit wieder importieren.</p>
		<a class="btn" href="#/">Zur Übersicht</a>
	</div>
{:else if status === 'error'}
	<div class="msg">
		<h1>Fehler beim Laden</h1>
		<p>{errorText}</p>
		<a class="btn" href="#/">Zur Übersicht</a>
	</div>
{/if}

<style>
	.msg {
		max-width: 560px;
		margin: 80px auto;
		display: flex;
		flex-direction: column;
		gap: 12px;
		align-items: flex-start;
	}
</style>
