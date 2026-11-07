/**
 * What a task, project or goal is connected to.
 *
 *     A Project sits in one Bucket.
 *     A Goal    sits in one Bucket.
 *     A Task    sits in one Bucket, and optionally in one Project inside that bucket.
 *
 * That is the vault's own shape, not lull-pm's. Every template writes `buckets:` — the Task and
 * Default templates write `buckets:` *and* `projects:` side by side — and `Tasks.base` files a task
 * whose `buckets:` is empty under "Personal", while "Org Tasks" finds a bucket's tasks with
 * `buckets.contains(this.asLink())`. A task that named only its project would vanish from its
 * bucket's dashboard and turn up under Personal. So a task in a project carries the project's
 * bucket too, and `setParent` writes both in the same edit.
 *
 * There is no "company" parent. A note becomes a place to put work by being tagged `#buckets` in
 * Obsidian — lull Software, Ferret Media and Personal alike — and that tag is all lull-pm reads.
 *
 * `org:` is not a bucket. lull-pm neither reads nor writes it; notes that still carry it keep it
 * exactly as they are.
 *
 * Keys hold a list of wikilinks, because that is what `.contains()` expects. lull-pm never writes
 * more than one entry.
 */

import {
	getStringList,
	parseNote,
	setFrontmatterValues,
	type FrontmatterValue,
	type ParsedNote
} from '$lib/vault/frontmatter';
import { asWikilink, formatWikilink, sameTarget } from '$lib/vault/wikilink';

export type ParentKind = 'bucket' | 'project';

/**
 * A note's one connection, as the UI shows it: the most specific thing it sits in.
 *
 * A project parent carries the bucket that project sits in, because connecting a task to a project
 * also has to place it in that project's bucket — see the module comment.
 */
export type Parent =
	{ kind: 'bucket'; name: string } | { kind: 'project'; name: string; bucket: string | null };

/** The frontmatter key each kind of connection lives under. */
export const PARENT_KEY: Record<ParentKind, string> = {
	bucket: 'buckets',
	project: 'projects'
};

/** Which kinds each note type may be connected to, most specific first. */
export const PARENT_KINDS = {
	task: ['project', 'bucket'],
	project: ['bucket'],
	goal: ['bucket']
} as const satisfies Record<string, readonly ParentKind[]>;

export type ParentedType = keyof typeof PARENT_KINDS;

/* -------------------------------------------------------------------------- */
/* Reading                                                                     */
/* -------------------------------------------------------------------------- */

/** Every bucket the note names in `buckets:`. More than one is a rule break — see `parentViolation`. */
export function bucketsOn(note: ParsedNote): string[] {
	return linkNames(note, PARENT_KEY.bucket);
}

/** The bucket the note sits in, or null. */
export function readBucket(note: ParsedNote): string | null {
	return bucketsOn(note)[0] ?? null;
}

/** Every project the note names. Only tasks are read this way. */
export function projectsOn(note: ParsedNote): string[] {
	return linkNames(note, PARENT_KEY.project);
}

/**
 * The note's parent: for a task, its project when it has one, else its bucket; for a project or a
 * goal, its bucket. Null when it is connected to nothing.
 */
export function readParent(note: ParsedNote, type: ParentedType): Parent | null {
	const bucket = readBucket(note);
	if (type === 'task') {
		const project = projectsOn(note)[0];
		if (project) return { kind: 'project', name: project, bucket };
	}
	return bucket ? { kind: 'bucket', name: bucket } : null;
}

/**
 * How a note's links break the rule, or null when they do not.
 *
 * - `too-many` — two buckets, or (for a task) two projects. One of each, at most.
 *
 * A task's project sitting in a different bucket than the task is a rule break too, but it can only
 * be seen with the projects in hand, so the audit checks it — see `audit.ts`.
 */
export type ParentViolation = 'too-many';

export function parentViolation(note: ParsedNote, type: ParentedType): ParentViolation | null {
	if (bucketsOn(note).length > 1) return 'too-many';
	if (type === 'task' && projectsOn(note).length > 1) return 'too-many';
	return null;
}

function linkNames(note: ParsedNote, key: string): string[] {
	return getStringList(note, key).map((value) => asWikilink(value).name);
}

/* -------------------------------------------------------------------------- */
/* Writing                                                                     */
/* -------------------------------------------------------------------------- */

/**
 * Connect a note to exactly one parent, or to none.
 *
 * Every key involved is settled in one `setFrontmatterValues` pass, so the rule holds at every
 * moment the file exists on disk.
 *
 * - **Bucket.** The note goes in that bucket, and a task leaves whatever project it was in.
 * - **Project** (tasks only). The task goes in that project *and* that project's bucket.
 * - **None.** Both cleared.
 *
 * Nothing moves that does not have to. A key already holding the right target is left alone, in
 * whatever shape it is written — `"[[Companies/Taboen Gang/Taboen Gang|Taboen Gang]]"` stays a path
 * link. A key with nothing to clear is not added. `org:` is never touched.
 */
export function setParent(raw: string, type: ParentedType, parent: Parent | null): string {
	if (parent && !(PARENT_KINDS[type] as readonly ParentKind[]).includes(parent.kind)) {
		throw new Error(`A ${type} cannot be connected to a ${parent.kind}.`);
	}
	if (parent && parent.name.trim() === '') {
		throw new Error('A parent needs a name.');
	}

	const bucket = parent === null ? null : parent.kind === 'bucket' ? parent.name : parent.bucket;
	const project = parent?.kind === 'project' ? parent.name : null;

	const note = parseNote(raw);
	const edits: Record<string, FrontmatterValue> = {};

	settle(note, edits, PARENT_KEY.bucket, bucket);
	if (type === 'task') settle(note, edits, PARENT_KEY.project, project);

	return setFrontmatterValues(raw, edits);
}

/** Make `key` hold exactly `target` (or nothing), recording only the edits that change something. */
function settle(
	note: ParsedNote,
	edits: Record<string, FrontmatterValue>,
	key: string,
	target: string | null
): void {
	const current = getStringList(note, key);

	if (target === null) {
		if (current.length > 0) edits[key] = null;
	} else if (!(current.length === 1 && sameTarget(current[0], target))) {
		edits[key] = [formatWikilink(target.trim())];
	}
}

/* -------------------------------------------------------------------------- */

/** Two parents are the same when they mean the same note. */
export function sameParent(a: Parent | null, b: Parent | null): boolean {
	if (a === null || b === null) return a === b;
	return a.kind === b.kind && a.name.toLowerCase() === b.name.toLowerCase();
}

/** How a parent should read in the UI: "Bucket", "Project". */
export function parentLabel(kind: ParentKind): string {
	return kind[0].toUpperCase() + kind.slice(1);
}
