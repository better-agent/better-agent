<script lang="ts">
import "../app.css";

let { children } = $props();
</script>

<svelte:head>
    <title>Better Agent Starter</title>
</svelte:head>

{@render children()}
