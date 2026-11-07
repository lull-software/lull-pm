import { describe, expect, it } from 'vitest';
import { MemoryVaultAdapter } from './adapter.memory';
import { auditVault, countByKind, type Finding } from './audit';
import { indexVault } from './notes';

const FOLDERS = ['Tasks', 'Projects', 'Companies', 'Notes/Goals', 'Buckets'];

/** Every audit runs against a vault that has these two buckets, as the real one does. */
const BUCKETS = {
	'Buckets/Ferret Media.md':
		'---\ntags:\n  - buckets\ncategories:\n  - "[[Categories/Companies|Companies]]"\n---\n',
	'Buckets/Personal.md': '---\ntags:\n  - buckets\n---\n'
};

async function audit(files: Record<string, string>): Promise<Finding[]> {
	return auditVault(await indexVault(new MemoryVaultAdapter({ ...BUCKETS, ...files })), {
		typedFolders: FOLDERS,
		bucketsFolder: 'Buckets'
	});
}

const GOOD_PROJECT =
	'---\ncategories:\n  - "[[Projects]]"\nbuckets:\n  - "[[Ferret Media]]"\n---\n';

const task = (keys: string) => `---\ncategories:\n  - "[[Tasks]]"\nstatus: Inbox\n${keys}---\n`;

describe('auditVault', () => {
	it('finds nothing wrong with a vault that follows the structure', async () => {
		expect(
			await audit({
				'Projects/Marketing Website.md': GOOD_PROJECT,
				'Tasks/Design the button.md': task(
					'buckets:\n  - "[[Ferret Media]]"\nprojects:\n  - "[[Marketing Website]]"\n'
				),
				'Tasks/Buy milk.md': task('buckets:\n  - "[[Personal]]"\n'),
				// org: is not a bucket, and not lull-pm's business — never a finding either way.
				'Notes/Goals/Run.md':
					'---\ncategories:\n  - "[[Goals]]"\nbuckets:\n  - "[[Personal]]"\norg:\n  - "[[KdG]]"\n---\n'
			})
		).toEqual([]);
	});

	it('does not report the bucket notes themselves, though most claim no category', async () => {
		expect(await audit({})).toEqual([]);
	});

	it('reports a note whose frontmatter does not parse, and says lull-pm will not write it', async () => {
		const findings = await audit({
			'Projects/Broken.md': '---\ncategories: [[[Projects]]\nstatus: Idea\n---\nbody\n'
		});

		expect(findings).toHaveLength(1);
		expect(findings[0].kind).toBe('unparseable-frontmatter');
		expect(findings[0].severity).toBe('blocking');
		expect(findings[0].suggestion).toMatch(/refuse to change it/);
	});

	it('reports a project in two buckets, naming both', async () => {
		const findings = await audit({
			'Projects/Confused.md':
				'---\ncategories:\n  - "[[Projects]]"\nbuckets:\n  - "[[Personal]]"\n' +
				'  - "[[Ferret Media]]"\n---\n'
		});

		expect(findings.map((f) => f.kind)).toEqual(['too-many-parents']);
		expect(findings[0].detail).toContain('Ferret Media');
		expect(findings[0].detail).toContain('Personal');
	});

	it('reports a task in two projects', async () => {
		const findings = await audit({
			'Tasks/Two.md': task('buckets:\n  - "[[Personal]]"\nprojects:\n  - "[[A]]"\n  - "[[B]]"\n')
		});

		expect(findings.map((f) => f.kind)).toEqual(['too-many-parents']);
	});

	it('reports a task with no bucket whose project sits in one', async () => {
		const findings = await audit({
			'Projects/Linker.md': GOOD_PROJECT,
			'Tasks/Film it.md': task('buckets:\nprojects:\n  - "[[Linker]]"\n')
		});

		expect(findings.map((f) => f.kind)).toEqual(['bucket-mismatch']);
		expect(findings[0].detail).toMatch(/under Personal/);
	});

	it('reports a task in a different bucket from its project', async () => {
		const findings = await audit({
			'Projects/Linker.md': GOOD_PROJECT,
			'Tasks/Film it.md': task('buckets:\n  - "[[Personal]]"\nprojects:\n  - "[[Linker]]"\n')
		});

		expect(findings.map((f) => f.kind)).toEqual(['bucket-mismatch']);
		expect(findings[0].detail).toContain('Ferret Media');
	});

	it('asks nothing of a task whose project has no bucket', async () => {
		expect(
			await audit({
				'Projects/Loose.md': '---\ncategories:\n  - "[[Projects]]"\n---\n',
				'Tasks/Do it.md': task('projects:\n  - "[[Loose]]"\n')
			})
		).toEqual([]);
	});

	it('reports a link to a bucket that is not tagged as one', async () => {
		const findings = await audit({
			'Companies/!Fig Sphinx.md': '---\ncategories:\n  - "[[Companies]]"\n---\n',
			'Projects/Rebrand.md':
				'---\ncategories:\n  - "[[Projects]]"\nbuckets:\n  - "[[Fig Sphinx]]"\n---\n'
		});

		expect(findings.map((f) => f.kind)).toEqual(['unknown-bucket']);
		expect(findings[0].detail).toContain('Fig Sphinx');
	});

	it('reports a note in Buckets/ that is not tagged #buckets', async () => {
		const findings = await audit({
			'Buckets/Side Quests.md': '---\ncategories:\n  - "[[Companies]]"\n---\n'
		});

		expect(findings.map((f) => f.kind)).toEqual(['uncategorised']);
		expect(findings[0].detail).toMatch(/not tagged #buckets/);
	});

	it('reports the retired bucket flag without touching it', async () => {
		const findings = await audit({
			'Projects/Old Bucket.md':
				'---\ncategories:\n  - "[[Projects]]"\nbucket: true\nstatus: Idea\n---\n'
		});

		expect(findings.map((f) => f.kind)).toEqual(['legacy-bucket-flag']);
		expect(findings[0].suggestion).toMatch(/remove it when convenient/);
	});

	it('reports an uncategorised note sitting in one of lull-pm folders', async () => {
		const findings = await audit({ 'Projects/Stray.md': '# Just some writing\n' });

		expect(findings.map((f) => f.kind)).toEqual(['uncategorised']);
		expect(findings[0].detail).toContain('Projects/');
	});

	it('reports an uncategorised main note anywhere, since ! means it is an entity', async () => {
		// Real note: Companies/lull-Software/lull.app/!lull.app.md has no frontmatter at all.
		const findings = await audit({
			'Companies/lull-Software/lull.app/!lull.app.md': '### Part of: [[lull]]\n'
		});

		expect(findings.map((f) => f.kind)).toEqual(['uncategorised']);
		expect(findings[0].title).toBe('lull.app');
	});

	it('leaves ordinary uncategorised writing alone', async () => {
		// The vault has 558 of these. None of them belong on this page.
		expect(await audit({ 'Notes/A thought I had.md': '# A thought\n' })).toEqual([]);
	});

	it('sorts blocking findings above notices', async () => {
		const findings = await audit({
			'Projects/Zebra.md': '---\ncategories: [[[Projects]]\n---\n',
			'Projects/Apple.md': '---\ncategories:\n  - "[[Projects]]"\nbucket: true\n---\n'
		});

		expect(findings.map((f) => f.severity)).toEqual(['blocking', 'notice']);
	});

	it('never reports a template, which the vault excludes everywhere else too', async () => {
		expect(
			await audit({ 'Templates/Project Template.md': '---\ncategories: [[[x]]\n---\n' })
		).toEqual([]);
	});
});

describe('countByKind', () => {
	it('counts every kind, including the ones with no findings', async () => {
		const counts = countByKind(
			await audit({
				'Projects/Old.md': '---\ncategories:\n  - "[[Projects]]"\nbucket: true\n---\n',
				'Projects/Stray.md': '# writing\n'
			})
		);

		expect(counts['legacy-bucket-flag']).toBe(1);
		expect(counts.uncategorised).toBe(1);
		expect(counts['bucket-mismatch']).toBe(0);
	});
});
