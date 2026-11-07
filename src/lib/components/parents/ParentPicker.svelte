<script lang="ts">
	/**
	 * One control for "where does this sit".
	 *
	 * A project or a goal picks a bucket. A task picks a bucket or a project — and picking a project
	 * puts the task in that project's bucket too, because that is what the vault's `Tasks.base` reads
	 * to find a bucket's tasks. One selection, so the two can never disagree.
	 */
	import SearchableSelect from '$lib/components/universals/SearchableSelect.svelte';
	import { PARENT_KINDS, type Parent, type ParentedType } from '$lib/models/Parent';
	import { bucketManager, bucketState } from '$lib/managers/BucketManager.svelte';
	import { projectManager, projectState } from '$lib/managers/ProjectManager.svelte';
	import { vaultState } from '$lib/managers/VaultManager.svelte';

	interface Props {
		/** Which note type this is for — decides which kinds are offered. */
		type: ParentedType;
		parent: Parent | null;
		onChange: (parent: Parent | null) => void;
		placeholder?: string;
	}

	let { type, parent, onChange, placeholder = 'Search…' }: Props = $props();

	const NONE = '— not connected —';

	// The picker can be the first thing on a page to need buckets or projects (the Projects page
	// loads no buckets of its own), so it fetches what it offers rather than relying on its host.
	$effect(() => {
		if (vaultState.status !== 'ready') return;
		const kinds: readonly string[] = PARENT_KINDS[type];
		if (kinds.includes('bucket') && bucketState.buckets.length === 0 && !bucketState.isLoading) {
			void bucketManager.load();
		}
		if (
			kinds.includes('project') &&
			projectState.projects.length === 0 &&
			!projectState.isLoading
		) {
			void projectManager.load();
		}
	});

	/**
	 * Labels carry their kind, because a bucket and a project can share a name. A project's label
	 * also names its bucket, since choosing it moves the task there as well.
	 */
	const listed = $derived(
		PARENT_KINDS[type].flatMap((kind): (Parent & { label: string })[] =>
			kind === 'bucket'
				? bucketState.buckets.map((b) => ({
						kind: 'bucket' as const,
						name: b.name,
						label: labelFor({ kind: 'bucket', name: b.name })
					}))
				: projectState.projects.map((p) => {
						const bucket = p.parent?.name ?? null;
						return {
							kind: 'project' as const,
							name: p.name,
							bucket,
							label: labelFor({ kind: 'project', name: p.name, bucket })
						};
					})
		)
	);

	/**
	 * The note's own parent is always an option, even when it is not in the list — a bucket lull-pm
	 * cannot find, or a list still loading. Showing "not connected" for a note that says otherwise
	 * would misreport the note.
	 */
	const entries = $derived(
		parent && !listed.some((e) => e.kind === parent.kind && e.name === parent.name)
			? [{ ...parent, label: labelFor(parent) }, ...listed]
			: listed
	);

	function labelFor(p: Parent): string {
		if (p.kind === 'bucket') return `Bucket — ${p.name}`;
		return p.bucket ? `Project — ${p.name} · ${p.bucket}` : `Project — ${p.name}`;
	}

	const options = $derived([NONE, ...entries.map((entry) => entry.label)]);
	const current = $derived(
		parent
			? (entries.find((e) => e.kind === parent.kind && e.name === parent.name)?.label ?? NONE)
			: NONE
	);

	function choose(value: string) {
		if (value === NONE) {
			onChange(null);
			return;
		}
		const entry = entries.find((e) => e.label === value);
		if (!entry) return;
		const { label: _label, ...chosen } = entry;
		void _label;
		onChange(chosen);
	}
</script>

<SearchableSelect value={current} {options} {placeholder} onValueChange={choose} />
