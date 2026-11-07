/**
 * A bucket is a note tagged `#buckets` — one of the handful of areas everything else sits in.
 *
 * In the vault they live in `Buckets/`: Personal, Ferret Media, lull Software, Schneider Electric,
 * Karel de Grote Hogeschool and so on. A note is a bucket because the user tagged it one, and for
 * no other reason — not its folder, and not whatever `categories:` it also claims.
 *
 * Projects, goals and tasks point at a bucket with `buckets: [[Name]]`.
 */

export interface Bucket {
	/** Vault-relative path. This is the bucket's identity. */
	path: string;
	/** Basename without `.md`, `!` stripped — what `buckets:` links to. */
	name: string;
	/** The note's `summary:` property, or empty string. */
	summary: string;
	/** `YYYY-MM-DD`, or null when unset. */
	created: string | null;
}
