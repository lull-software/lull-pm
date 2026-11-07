import type { Parent, ParentViolation } from './Parent';

/**
 * A goal is a note that says `categories: [[Goals]]`.
 *
 * The vault keeps them in `Notes/Goals/` — "Goals FOR 2026", "Long Term Goals" — as plain notes
 * with nothing but the category, so the shape here is the smallest thing that is useful: a name, a
 * freeform status, and the one bucket it sits in. All three are optional on read.
 *
 * Like projects, status is not pinned to a fixed set — `GOAL_STATUSES` are quick picks offered in
 * the UI, never enforced on read.
 */
export const GOAL_STATUSES = ['Idea', 'In Progress', 'On Hold', 'Done'] as const;

export interface Goal {
	/** Vault-relative path. This is the goal's identity. */
	path: string;
	/** Basename without `.md`, `!` stripped. */
	name: string;
	/** Freeform. Empty string means unset. */
	status: string;
	/** The bucket this goal sits in. See `models/Parent.ts`. */
	parent: Parent | null;
	/** Set when the note's links break the one-parent rule, so the UI can offer to fix it. */
	parentViolation: ParentViolation | null;
	/** `YYYY-MM-DD`, or null when unset. */
	created: string | null;
}
