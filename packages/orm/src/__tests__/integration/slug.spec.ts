import type { Kysely } from 'kysely';
import {
	setupTestDatabase,
	teardownTestDatabase,
} from 'tests/fixtures/test-db';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import withSlug from '~/mixins/slug';
import createModel from '~/model';

// Test database type definition
interface TestDB {
	posts: {
		id: number;
		title: string;
		slug: string;
	};
}

describe('integration: slug mixin', () => {
	let db: Kysely<TestDB>;
	let PostModel: any;

	beforeEach(async () => {
		// Set up test database
		db = (await setupTestDatabase()) as Kysely<TestDB>;

		// Create posts table
		await db.schema
			.createTable('posts')
			.addColumn('id', 'serial', (col) => col.primaryKey())
			.addColumn('title', 'varchar(255)', (col) => col.notNull())
			.addColumn('slug', 'varchar(255)')
			.execute();

		// Create and enhance model
		const baseModel = createModel<TestDB, 'posts', 'id'>(db, 'posts', 'id');
		PostModel = withSlug(baseModel, {
			field: 'slug',
			sources: ['title'],
		});
	});

	afterEach(async () => {
		// Clean up
		await teardownTestDatabase(db);
	});

	it('should generate a slug during insertion', async () => {
		const post = await PostModel.insertWithSlug({
			title: 'Test Integration Post',
		});

		expect(post).toHaveProperty('id');
		expect(post).toHaveProperty('title', 'Test Integration Post');
		expect(post).toHaveProperty('slug', 'test-integration-post');
	});

	it('should find a record by slug', async () => {
		// Insert a post
		const inserted = await PostModel.insertWithSlug({
			title: 'Findable Post',
		});

		// Find by slug
		const found = await PostModel.findBySlug('findable-post');

		expect(found).toEqual(inserted);
	});

	it('should handle insertIfNotExistsWithSlug for new record', async () => {
		const post = await PostModel.insertIfNotExistsWithSlug(
			{ title: 'Unique Post' },
			'title'
		);

		expect(post).toHaveProperty('slug', 'unique-post');

		// Confirm it was inserted
		const found = await db
			.selectFrom('posts')
			.where('title', '=', 'Unique Post')
			.executeTakeFirst();

		expect(found).toHaveProperty('slug', 'unique-post');
	});

	it('should not create duplicate when using insertIfNotExistsWithSlug', async () => {
		// Insert first
		await PostModel.insertWithSlug({
			title: 'Already Exists',
		});

		// Try to insert again with same unique value
		const post = await PostModel.insertIfNotExistsWithSlug(
			{ title: 'Already Exists', extraField: 'should not be saved' },
			'title'
		);

		expect(post).toHaveProperty('slug', 'already-exists');

		// Check that we only have one record
		const count = await db
			.selectFrom('posts')
			.select(db.fn.count<string>('id').as('count'))
			.executeTakeFirst();

		expect(parseInt(count?.count || '0')).toBe(1);
	});

	it('should upsert with slug generation', async () => {
		// First insert
		await PostModel.insertWithSlug({
			title: 'Initial Title',
		});

		// Then upsert
		const updated = await PostModel.upsertWithSlug(
			{ column: 'title', value: 'Initial Title' },
			{ title: 'New Record' },
			{ title: 'Updated Title' }
		);

		expect(updated).toHaveProperty('title', 'Updated Title');

		// Slug should be updated to match the new title
		const found = await db.selectFrom('posts').executeTakeFirst();
		expect(found).toHaveProperty('slug', 'updated-title');
	});

	it('should handle batch inserts with slug generation', async () => {
		// Insert multiple records
		await db
			.insertInto('posts')
			.values([{ title: 'Post One' }, { title: 'Post Two' }])
			.execute();

		// Use processDataBeforeInsert to add slugs
		const dataToInsert = [
			{ title: 'Post Three' },
			{ title: 'Post Four', slug: 'custom-slug' },
		];

		const processedData = PostModel.processDataBeforeInsert(dataToInsert);
		await db.insertInto('posts').values(processedData).execute();

		// Verify all posts have slugs
		const posts = await db.selectFrom('posts').orderBy('id').execute();

		expect(posts).toHaveLength(4);
		expect(posts[2]).toHaveProperty('slug', 'post-three');
		expect(posts[3]).toHaveProperty('slug', 'custom-slug');
	});
});
