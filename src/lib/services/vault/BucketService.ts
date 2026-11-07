/**
 * Buckets, read as notes tagged `#buckets` and written into `Buckets/`.
 *
 * Same discipline as `TaskService` and `ProjectService`: reads come from the shared vault index —
 * by tag, wherever the note lives — and creating one goes through `createNote`.
 *
 * lull-pm creates the `Buckets/` folder if it has to, because it has to put the note somewhere. It
 * does not write a category note or a `.base` for buckets; those are the user's.
 */

import { createNote, joinPath, noteName, type VaultAdapter } from '$lib/vault/adapter';
import { getString, parseNote, type ParsedNote } from '$lib/vault/frontmatter';
import type { VaultIndex } from '$lib/vault/notes';
import { readLullConfig } from '$lib/vault/settings';
import type { Bucket } from '$lib/models/Bucket';

/** The tag a bucket note carries. */
export const BUCKET_TAG = 'buckets';

export class BucketService {
	private constructor(
		private readonly adapter: VaultAdapter,
		private readonly folder: string
	) {}

	static async open(adapter: VaultAdapter): Promise<BucketService> {
		const config = await readLullConfig(adapter);
		return new BucketService(adapter, config.folders.buckets);
	}

	/**
	 * Every bucket in the vault, alphabetical.
	 *
	 * Synchronous: the index already holds each note parsed, so there is nothing left to await.
	 */
	listBuckets(index: VaultIndex): Bucket[] {
		return index
			.byTag(BUCKET_TAG)
			.map((note) => toBucket(note.path, note.note, note.title))
			.sort((a, b) => a.name.localeCompare(b.name));
	}

	async readBucket(path: string): Promise<Bucket> {
		return toBucket(path, parseNote(await this.adapter.read(path)));
	}

	/**
	 * Create a bucket note.
	 *
	 * The frontmatter is exactly what `Buckets/Personal.md` carries — the tag, and nothing else.
	 * A summary, a dashboard, anything more: the user adds those in Obsidian.
	 */
	async createBucket(name: string): Promise<Bucket> {
		const trimmed = name.trim();
		if (trimmed === '') throw new Error('A bucket needs a name.');

		const path = joinPath(this.folder, `${trimmed}.md`);
		await createNote(this.adapter, path, `---\ntags:\n  - ${BUCKET_TAG}\n---\n`);
		return this.readBucket(path);
	}
}

function toBucket(path: string, note: ParsedNote, title?: string): Bucket {
	return {
		path,
		name: title ?? noteName(path).replace(/^!/, ''),
		summary: getString(note, 'summary') ?? '',
		created: getString(note, 'created') ?? null
	};
}
