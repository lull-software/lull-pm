import { describe, expect, it } from 'vitest';
import { parseNote } from '$lib/vault/frontmatter';
import {
	bucketsOn,
	parentViolation,
	readBucket,
	readParent,
	sameParent,
	setParent,
	type Parent
} from './Parent';

/** Fixtures in the shape the real vault writes them — the Task and Project templates' keys. */

const TASK = `---
categories:
  - "[[Tasks]]"
status: Todo
priority: Medium
buckets:
projects:
due:
---
## Steps
`;

const PROJECT = `---
categories:
  - "[[Projects]]"
buckets:
  - "[[Ferret Media]]"
clients:
status:
  - Idea
---

## Tasks
`;

const BARE_PROJECT = `---
categories:
  - "[[Projects]]"
---
`;

/** A KdG note carrying `org:`, which is not a bucket and which lull-pm leaves alone. */
const ORG_PROJECT = `---
categories:
  - "[[Projects]]"
org:
  - "[[Karel de Grote Hogeschool]]"
status: Done
---
`;

const LEGACY_FLAG = '---\ncategories:\n  - "[[Projects]]"\nbucket: true\nstatus: Idea\n---\n';

const bucket = (name: string): Parent => ({ kind: 'bucket', name });
const project = (name: string, inBucket: string | null): Parent => ({
	kind: 'project',
	name,
	bucket: inBucket
});

describe('readParent', () => {
	it('reads buckets: as the bucket a project sits in', () => {
		expect(readParent(parseNote(PROJECT), 'project')).toEqual(bucket('Ferret Media'));
	});

	it('reads a task’s project, with the bucket the task carries', () => {
		const note = parseNote(setParent(TASK, 'task', project('Marketing Website', 'Student Events')));
		expect(readParent(note, 'task')).toEqual(project('Marketing Website', 'Student Events'));
	});

	it('reads a task with only a bucket as being in that bucket', () => {
		const note = parseNote(setParent(TASK, 'task', bucket('Personal')));
		expect(readParent(note, 'task')).toEqual(bucket('Personal'));
	});

	it('does not read org: as a bucket', () => {
		expect(readParent(parseNote(ORG_PROJECT), 'project')).toBeNull();
	});

	it('is null when the note carries no connection at all', () => {
		expect(readParent(parseNote(BARE_PROJECT), 'project')).toBeNull();
		expect(readParent(parseNote(TASK), 'task')).toBeNull();
	});

	it('ignores the retired bucket flag instead of inventing a bucket named "true"', () => {
		expect(readParent(parseNote(LEGACY_FLAG), 'project')).toBeNull();
	});

	it('resolves a bucket through a path and alias link', () => {
		const aliased =
			'---\ncategories:\n  - "[[Projects]]"\nbuckets:\n  - "[[Buckets/TrueFerret|TrueFerret]]"\n---\n';
		expect(readParent(parseNote(aliased), 'project')).toEqual(bucket('TrueFerret'));
	});
});

describe('readBucket and bucketsOn', () => {
	it('reads buckets: only, whatever org: says', () => {
		const both = '---\nbuckets:\n  - "[[Personal]]"\norg:\n  - "[[KdG]]"\n---\n';
		expect(bucketsOn(parseNote(both))).toEqual(['Personal']);
		expect(readBucket(parseNote(both))).toBe('Personal');
	});
});

describe('parentViolation', () => {
	it('is null for a note with one bucket, or none', () => {
		expect(parentViolation(parseNote(PROJECT), 'project')).toBeNull();
		expect(parentViolation(parseNote(BARE_PROJECT), 'project')).toBeNull();
	});

	it('is null for a task in a bucket and a project — that is the normal shape now', () => {
		const note = parseNote(setParent(TASK, 'task', project('Linker', 'Ferret Media')));
		expect(parentViolation(note, 'task')).toBeNull();
	});

	it('reports two buckets', () => {
		const two = '---\nbuckets:\n  - "[[A]]"\n  - "[[B]]"\n---\n';
		expect(parentViolation(parseNote(two), 'project')).toBe('too-many');
	});

	it('does not count org: against the one-bucket rule', () => {
		const both = '---\nbuckets:\n  - "[[Personal]]"\norg:\n  - "[[KdG]]"\n---\n';
		expect(parentViolation(parseNote(both), 'goal')).toBeNull();
	});

	it('reports a task in two projects', () => {
		const two = '---\ncategories:\n  - "[[Tasks]]"\nprojects:\n  - "[[A]]"\n  - "[[B]]"\n---\n';
		expect(parentViolation(parseNote(two), 'task')).toBe('too-many');
	});

	it('does not hold a project’s own projects: against it', () => {
		const sub = '---\nbuckets:\n  - "[[X]]"\nprojects:\n  - "[[A]]"\n  - "[[B]]"\n---\n';
		expect(parentViolation(parseNote(sub), 'project')).toBeNull();
	});
});

describe('setParent', () => {
	it('writes a wikilink list under buckets:, which is what .base .contains() filters on', () => {
		expect(setParent(BARE_PROJECT, 'project', bucket('TrueFerret'))).toContain(
			'buckets:\n  - "[[TrueFerret]]"'
		);
	});

	it('moves a project to another bucket', () => {
		const next = setParent(PROJECT, 'project', bucket('Personal'));
		expect(next).toContain('buckets:\n  - "[[Personal]]"');
		expect(next).not.toContain('Ferret Media');
	});

	it('puts a task in a project and that project’s bucket in the same edit', () => {
		const next = setParent(TASK, 'task', project('Linker', 'Ferret Media'));
		expect(next).toContain('buckets:\n  - "[[Ferret Media]]"');
		expect(next).toContain('projects:\n  - "[[Linker]]"');
	});

	it('takes a task out of its project when it is moved to a bucket', () => {
		const inProject = setParent(TASK, 'task', project('Linker', 'Ferret Media'));
		const next = setParent(inProject, 'task', bucket('Personal'));
		expect(readParent(parseNote(next), 'task')).toEqual(bucket('Personal'));
		expect(next).not.toContain('Linker');
	});

	it('clears a task’s bucket when its project has none', () => {
		const inBucket = setParent(TASK, 'task', bucket('Personal'));
		const next = setParent(inBucket, 'task', project('Loose Ends', null));
		expect(readParent(parseNote(next), 'task')).toEqual(project('Loose Ends', null));
		expect(next).not.toContain('Personal');
	});

	it('never writes projects: on a project or a goal', () => {
		expect(setParent(BARE_PROJECT, 'project', bucket('X'))).not.toContain('projects:');
	});

	it('does not append a key the note never had', () => {
		expect(setParent(BARE_PROJECT, 'project', bucket('TrueFerret'))).not.toContain('org:');
	});

	it('clears everything when disconnected', () => {
		const next = setParent(PROJECT, 'project', null);
		expect(readParent(parseNote(next), 'project')).toBeNull();
		expect(next).not.toContain('Ferret Media');
	});

	it('changes nothing when disconnecting a note that has no parent', () => {
		expect(setParent(BARE_PROJECT, 'project', null)).toBe(BARE_PROJECT);
		expect(setParent(TASK, 'task', null)).toBe(TASK);
	});

	it('changes nothing when the parent already matches', () => {
		expect(setParent(PROJECT, 'project', bucket('Ferret Media'))).toBe(PROJECT);
		const placed = setParent(TASK, 'task', project('Linker', 'Ferret Media'));
		expect(setParent(placed, 'task', project('Linker', 'Ferret Media'))).toBe(placed);
	});

	it('never touches org:, whether setting a bucket or clearing one', () => {
		const set = setParent(ORG_PROJECT, 'project', bucket('Personal'));
		expect(set).toContain('org:\n  - "[[Karel de Grote Hogeschool]]"');
		expect(set).toContain('buckets:\n  - "[[Personal]]"');
		expect(setParent(ORG_PROJECT, 'project', null)).toBe(ORG_PROJECT);
	});

	it('leaves the retired bucket flag alone — it is not a parent key', () => {
		expect(setParent(LEGACY_FLAG, 'project', bucket('TrueFerret'))).toContain('bucket: true');
	});

	it('refuses a connection the rule does not allow', () => {
		expect(() => setParent(PROJECT, 'project', project('Other', null))).toThrow(
			/project cannot be connected to a project/
		);
		expect(() => setParent(PROJECT, 'goal', project('Other', null))).toThrow(
			/goal cannot be connected to a project/
		);
	});

	it('refuses a nameless parent', () => {
		expect(() => setParent(PROJECT, 'project', bucket('  '))).toThrow(/needs a name/);
	});

	it('leaves every other property and the body byte-for-byte', () => {
		const next = setParent(PROJECT, 'project', bucket('TrueFerret'));
		expect(next).toContain('clients:\n');
		expect(next).toContain('status:\n  - Idea');
		expect(next.slice(next.lastIndexOf('---') + 3)).toBe('\n\n## Tasks\n');
	});
});

describe('sameParent', () => {
	it('matches on kind and name, case-insensitively', () => {
		expect(sameParent(bucket('TrueFerret'), bucket('trueferret'))).toBe(true);
	});

	it('does not match across kinds', () => {
		expect(sameParent(project('X', null), bucket('X'))).toBe(false);
	});

	it('treats two absent parents as the same', () => {
		expect(sameParent(null, null)).toBe(true);
		expect(sameParent(null, bucket('X'))).toBe(false);
	});
});

describe('setParent and link shape', () => {
	// Real link shapes from the vault.
	const PATH_AND_ALIAS =
		'---\ncategories:\n  - "[[Projects]]"\nbuckets:\n' +
		'  - "[[Companies/Taboen Gang/Taboen Gang|Taboen Gang]]"\nstatus:\n  - Idea\n---\n';
	const PATH_ONLY = '---\ncategories:\n  - "[[Projects]]"\nbuckets:\n  - "[[Notes/KdG]]"\n---\n';

	it('resolves a path and alias link to the note it points at', () => {
		expect(readParent(parseNote(PATH_AND_ALIAS), 'project')).toEqual(bucket('Taboen Gang'));
	});

	it('leaves a path-qualified link alone when the parent has not changed', () => {
		expect(setParent(PATH_AND_ALIAS, 'project', bucket('Taboen Gang'))).toBe(PATH_AND_ALIAS);
		expect(setParent(PATH_ONLY, 'project', bucket('KdG'))).toBe(PATH_ONLY);
	});

	it('still rewrites the link when the parent actually changes', () => {
		const next = setParent(PATH_AND_ALIAS, 'project', bucket('Ferret Media'));
		expect(next).toContain('buckets:\n  - "[[Ferret Media]]"');
		expect(next).not.toContain('Taboen Gang');
	});

	it('clears a path-qualified link like any other', () => {
		expect(readParent(parseNote(setParent(PATH_ONLY, 'project', null)), 'project')).toBeNull();
	});
});
