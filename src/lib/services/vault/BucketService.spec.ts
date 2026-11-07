import { beforeEach, describe, expect, it } from 'vitest';
import { MemoryVaultAdapter } from '$lib/vault/adapter.memory';
import { indexVault } from '$lib/vault/notes';
import { BucketService } from './BucketService';

/** The real vault's two bucket shapes: a bare one, and one that also claims a category. */
const BUCKET = '---\ntags:\n  - buckets\n---\n';
const COMPANY_BUCKET = `---
tags:
  - buckets
categories:
  - "[[Categories/Companies|Companies]]"
summary: Content production and media services for festivals, events, and clients.
---
# Ferret Media
`;

let adapter: MemoryVaultAdapter;
let service: BucketService;

beforeEach(async () => {
	adapter = new MemoryVaultAdapter({
		'.obsidian/app.json': '{}',
		'Buckets/Personal.md': BUCKET,
		'Buckets/Ferret Media.md': COMPANY_BUCKET,
		'Projects/Marketing Website.md': '---\ncategories:\n  - "[[Projects]]"\n---\n',
		// A company that is not a bucket — the vault's Fig Sphinx.
		'Companies/!Fig Sphinx.md': '---\ncategories:\n  - "[[Categories/Companies|Companies]]"\n---\n'
	});
	service = await BucketService.open(adapter);
});

async function buckets() {
	return service.listBuckets(await indexVault(adapter));
}

describe('reading', () => {
	it('lists notes tagged #buckets, alphabetically', async () => {
		expect((await buckets()).map((b) => b.name)).toEqual(['Ferret Media', 'Personal']);
	});

	it('does not count a note that is not tagged, whatever its category', async () => {
		expect((await buckets()).map((b) => b.name)).not.toContain('Fig Sphinx');
	});

	it('reads the summary', async () => {
		const [ferret, personal] = await buckets();
		expect(ferret.summary).toBe(
			'Content production and media services for festivals, events, and clients.'
		);
		expect(personal.summary).toBe('');
	});

	it('finds a bucket wherever it lives, since the tag is what identifies it', async () => {
		await adapter.write('Somewhere/Else/Side Projects.md', BUCKET);
		expect((await buckets()).map((b) => b.name)).toContain('Side Projects');
	});

	it('accepts the tag however it is written', async () => {
		await adapter.write('A.md', '---\ntags: buckets\n---\n');
		await adapter.write('B.md', '---\ntags:\n  - "#Buckets"\n---\n');
		expect((await buckets()).map((b) => b.name)).toEqual(expect.arrayContaining(['A', 'B']));
	});

	it('no longer reads the old categories: [[Buckets]] notes as buckets', async () => {
		await adapter.write('Categories/Buckets/Work.md', '---\ncategories:\n  - "[[Buckets]]"\n---\n');
		expect((await buckets()).map((b) => b.name)).not.toContain('Work');
	});

	it('ignores a project still carrying the retired bucket flag', async () => {
		await adapter.write(
			'Projects/Old.md',
			'---\ncategories:\n  - "[[Projects]]"\nbucket: true\n---\n'
		);
		expect((await buckets()).map((b) => b.name)).not.toContain('Old');
	});
});

describe('creating', () => {
	it('creates a note in Buckets/ shaped exactly like Personal.md', async () => {
		const bucket = await service.createBucket('Side Quests');

		expect(bucket.path).toBe('Buckets/Side Quests.md');
		expect(await adapter.read(bucket.path)).toBe('---\ntags:\n  - buckets\n---\n');
		expect((await buckets()).map((b) => b.name)).toContain('Side Quests');
	});

	it('does not create a category note or a base file — those are the user’s to write', async () => {
		await service.createBucket('Side Quests');

		expect(await adapter.exists('Categories/Buckets.md')).toBe(false);
		expect(await adapter.exists('Buckets/Buckets.base')).toBe(false);
	});

	it('refuses an empty name', async () => {
		await expect(service.createBucket('   ')).rejects.toThrow(/needs a name/);
	});

	it('refuses to overwrite an existing bucket', async () => {
		await expect(service.createBucket('Personal')).rejects.toThrow(/already exists/);
	});
});
