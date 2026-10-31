<script lang="ts">
	// Übungs-Marker: Antippen schaltet die Übungs-Quelle durch keine → geübt → Expertise → halb.
	import type { ProficiencyLevel } from '$lib/engine/types';
	import { PROFICIENCY_LABEL, setProficiency } from '$lib/store/actions';
	import { sheet } from '$lib/store/sheet.svelte';

	let { id }: { id: string } = $props();
	const prof = $derived(sheet.character?.proficiencies[id]);
	const NEXT: Record<ProficiencyLevel, ProficiencyLevel> = { 0: 1, 1: 2, 2: 0.5, 0.5: 0 };
</script>

{#if prof}
	<button
		type="button"
		class="marker l{String(prof.level).replace('.', '')}"
		title="Übung: {PROFICIENCY_LABEL[prof.level]} (antippen zum Wechseln)"
		aria-label="Übung: {PROFICIENCY_LABEL[prof.level]}"
		onclick={(e) => {
			e.stopPropagation();
			setProficiency(id, NEXT[prof.level]);
		}}
	>
		<span class="dot"></span>
	</button>
{/if}

<style>
	.marker {
		display: inline-flex;
		align-items: center;
		justify-content: center;
		width: 36px;
		height: 36px;
		padding: 0;
		border: none;
		background: transparent;
		flex-shrink: 0;
	}
	.dot {
		position: relative;
		width: 14px;
		height: 14px;
		border-radius: 50%;
		border: 1.5px solid var(--border-strong);
		background: transparent;
		transition: all 0.12s;
	}
	.l05 .dot {
		border-color: var(--accent);
		background: linear-gradient(90deg, var(--accent) 50%, transparent 50%);
	}
	.l1 .dot {
		border-color: var(--accent);
		background: var(--accent);
	}
	.l2 .dot {
		border-color: var(--accent);
		background: var(--accent);
		box-shadow:
			0 0 0 2px var(--surface),
			0 0 0 3.5px var(--accent);
	}
	.marker:hover .dot {
		transform: scale(1.12);
	}
</style>
