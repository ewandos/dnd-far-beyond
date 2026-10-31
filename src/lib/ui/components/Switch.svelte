<script lang="ts">
	let {
		checked,
		onchange,
		label,
		small = false
	}: { checked: boolean; onchange: (v: boolean) => void; label: string; small?: boolean } = $props();
</script>

<button
	type="button"
	role="switch"
	aria-checked={checked}
	aria-label={label}
	title={label}
	class="switch"
	class:on={checked}
	class:small
	onclick={(e) => {
		e.stopPropagation();
		onchange(!checked);
	}}
>
	<span class="knob"></span>
</button>

<style>
	.switch {
		position: relative;
		flex-shrink: 0;
		width: 46px;
		height: var(--tap);
		padding: 0;
		border: none;
		background: transparent;
	}
	.switch::before {
		content: '';
		position: absolute;
		left: 0;
		right: 0;
		top: 50%;
		height: 26px;
		transform: translateY(-50%);
		border-radius: 13px;
		background: var(--surface-3);
		border: 1px solid var(--border-strong);
		transition: background 0.15s;
	}
	.switch.on::before {
		background: var(--accent);
		border-color: var(--accent);
	}
	.knob {
		position: absolute;
		top: 50%;
		left: 4px;
		width: 20px;
		height: 20px;
		transform: translateY(-50%);
		border-radius: 50%;
		background: var(--surface);
		box-shadow: 0 1px 2px rgb(0 0 0 / 0.25);
		transition: left 0.15s;
	}
	.switch.on .knob {
		left: 22px;
	}
	.switch.small {
		width: 38px;
		height: 36px;
	}
	.switch.small::before {
		height: 22px;
	}
	.switch.small .knob {
		width: 16px;
		height: 16px;
	}
	.switch.small.on .knob {
		left: 18px;
	}
</style>
