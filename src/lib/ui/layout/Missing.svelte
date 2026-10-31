<script lang="ts">
	let { what }: { what: string } = $props();
</script>

<p class="missing">{what} fehlt – im Bearbeitungsmodus neu zuordnen.</p>

<style>
	.missing {
		margin: 0;
		padding: 12px;
		font-size: 13px;
		color: var(--muted);
		font-style: italic;
	}
</style>
