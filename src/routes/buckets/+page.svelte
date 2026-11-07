<script lang="ts">
	import { taskManager, taskState } from '$lib/managers/TaskManager.svelte';
	import { projectManager, projectState } from '$lib/managers/ProjectManager.svelte';
	import { bucketManager, bucketState } from '$lib/managers/BucketManager.svelte';
	import { vaultManager, vaultState } from '$lib/managers/VaultManager.svelte';
	import NewBucketDialog from '$lib/components/buckets/NewBucketDialog.svelte';
	import { Button } from '$lib/components/ui/button';
	import { Card } from '$lib/components/ui/card';
	import { Spinner } from '$lib/components/ui/spinner';
	import PlusIcon from '@lucide/svelte/icons/plus';
	import TriangleAlertIcon from '@lucide/svelte/icons/triangle-alert';
	import type { Bucket } from '$lib/models/Bucket';

	let newBucketOpen = $state(false);

	$effect(() => {
		if (vaultState.status !== 'ready') return;
		if (bucketState.buckets.length === 0 && !bucketState.isLoading) void bucketManager.load();
		if (taskState.tasks.length === 0 && !taskState.isLoading) void taskManager.load();
		if (projectState.projects.length === 0 && !projectState.isLoading) void projectManager.load();
	});

	// Follow the vault: a bucket note written in Obsidian should show up without a manual refresh.
	$effect(() => {
		const adapter = vaultState.adapter;
		if (!adapter) return;

		const disposers: (() => void)[] = [];
		for (const refresh of [
			() => bucketManager.refreshQuietly(),
			() => taskManager.refreshQuietly(),
			() => projectManager.refreshQuietly()
		]) {
			void adapter.watch(refresh).then((fn) => disposers.push(fn));
		}
		return () => disposers.forEach((dispose) => dispose());
	});

	// Everything that names the bucket in `buckets:` — a task in a project included, since it
	// carries its project's bucket.
	function projectCountFor(bucket: Bucket): number {
		return projectState.projects.filter((project) => project.parent?.name === bucket.name).length;
	}

	function taskCountFor(bucket: Bucket): number {
		return taskState.tasks.filter((task) => task.bucket === bucket.name).length;
	}

	function plural(count: number, word: string): string {
		return `${count} ${count === 1 ? word : `${word}s`}`;
	}
</script>

<svelte:head>
	<title>lull-pm — buckets</title>
</svelte:head>

<main class="mx-auto w-full max-w-6xl p-6 md:p-10">
	<header class="flex flex-wrap items-center justify-between gap-4 pb-3">
		<h1 class="text-base font-medium">Buckets</h1>
		<Button variant="outline" size="xs" onclick={() => (newBucketOpen = true)}>
			<PlusIcon class="size-4" />
			New bucket
		</Button>
	</header>

	{#if bucketState.error}
		<div
			class="mb-6 flex items-start gap-2 rounded-md border border-destructive/40 bg-destructive/10 p-3 text-sm"
		>
			<TriangleAlertIcon class="mt-0.5 size-4 shrink-0 text-destructive" />
			<span>{bucketState.error}</span>
		</div>
	{/if}

	{#if bucketState.isLoading && bucketState.buckets.length === 0}
		<div class="flex justify-center py-16">
			<Spinner class="size-5 text-muted-foreground" />
		</div>
	{:else if bucketState.buckets.length === 0}
		<div class="rounded-lg border border-dashed p-10 text-center">
			<p class="text-sm text-muted-foreground">
				No buckets yet. A bucket is a note tagged <code class="font-mono">#buckets</code>, kept in
				<code class="font-mono">Buckets/</code>.
			</p>
			<Button class="mt-4" variant="outline" size="sm" onclick={() => (newBucketOpen = true)}>
				Create the first one
			</Button>
		</div>
	{:else}
		<div class="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
			{#each bucketState.buckets as bucket (bucket.path)}
				<Card
					class="cursor-pointer gap-2 p-4 transition hover:ring-2 hover:ring-ring/40"
					onclick={() => vaultManager.openInObsidian(bucket.path)}
				>
					<p class="text-sm font-medium leading-snug">{bucket.name}</p>
					{#if bucket.summary}
						<p class="line-clamp-2 text-xs text-muted-foreground">{bucket.summary}</p>
					{/if}
					<span class="text-xs text-muted-foreground">
						{plural(projectCountFor(bucket), 'project')} · {plural(taskCountFor(bucket), 'task')}
					</span>
				</Card>
			{/each}
		</div>
	{/if}
</main>

<NewBucketDialog
	bind:open={newBucketOpen}
	onClose={() => (newBucketOpen = false)}
	onCreated={() => (newBucketOpen = false)}
/>
