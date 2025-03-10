// tests/integration/mixin-composition.spec.ts

import type { Kysely } from 'kysely';
import {
	setupTestDatabase,
	teardownTestDatabase,
} from '../fixtures/test-db';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { withGlobalId } from '~/mixins/globalId';
import withSlug from '~/mixins/slug';
import createModel from '~/model';

describe('integration: mixin composition', () => {
	// Define test database schema
	interface TestDB {
		users: {
			id: number;
			name: string;
			email: string;
			slug: string;
			status: string;
		};
		posts: {
			id: number;
			user_id: number;
			title: string;
			slug: string;
			content: string;
		};
	}

	let db: Kysely<TestDB>;
	let UserModel;
	let PostModel;

	beforeEach(async () => {
		// Set up test database
		db = (await setupTestDatabase()) as Kysely<TestDB>;

		// Create test tables
		await db.schema
			.createTable('users')
			.addColumn('id', 'serial', (col) => col.primaryKey())
			.addColumn('name', 'varchar(255)', (col) => col.notNull())
			.addColumn('email', 'varchar(255)', (col) => col.unique().notNull())
			.addColumn('slug', 'varchar(255)')
			.addColumn('status', 'varchar(50)', (col) =>
				col.notNull().defaultTo('active')
			)
			.execute();

		await db.schema
			.createTable('posts')
			.addColumn('id', 'serial', (col) => col.primaryKey())
			.addColumn('user_id', 'integer', (col) =>
				col.references('users.id').onDelete('cascade').notNull()
			)
			.addColumn('title', 'varchar(255)', (col) => col.notNull())
			.addColumn('slug', 'varchar(255)')
			.addColumn('content', 'text', (col) => col.notNull())
			.execute();

		// Create base models
		const baseUserModel = createModel<TestDB, 'users', 'id'>(db, 'users', 'id');
		const basePostModel = createModel<TestDB, 'posts', 'id'>(db, 'posts', 'id');

		// Apply mixins
		UserModel = withGlobalId(
			withSlug(baseUserModel, {
				field: 'slug',
				sources: ['name'],
			}),
			{
				type: 'User',
			}
		);

		PostModel = withGlobalId(
			withSlug(basePostModel, {
				field: 'slug',
				sources: ['title'],
			}),
			{
				type: 'Post',
			}
		);

		// Seed test data
		await db
			.insertInto('users')
			.values([
				{ name: 'John Doe', email: 'john@example.com', status: 'active' },
				{ name: 'Jane Smith', email: 'jane@example.com', status: 'inactive' },
			])
			.execute();
	});

	afterEach(async () => {
		await teardownTestDatabase(db);
	});

	describe('composed functionality', () => {
		it('should generate slugs when inserting records', async () => {
			const user = await UserModel.insertWithSlug({
				name: 'Test User',
				email: 'test@example.com',
			});

			expect(user).toHaveProperty('id');
			expect(user).toHaveProperty('slug', 'test-user');
		});

		it('should find records by slug', async () => {
			// First create a user with a slug
			const insertedUser = await UserModel.insertWithSlug({
				name: 'Sluggable User',
				email: 'sluggable@example.com',
			});

			// Then find it by slug
			const foundUser = await UserModel.findBySlug('sluggable-user');

			expect(foundUser).toHaveProperty('id', insertedUser.id);
			expect(foundUser).toHaveProperty('name', 'Sluggable User');
		});

		it('should generate and resolve global IDs', async () => {
			// First get a user
			const user = await UserModel.findOne('email', 'john@example.com');

			// Generate a global ID
			const globalId = UserModel.getGlobalId(user.id);

			// Find the user by global ID
			const foundUser = await UserModel.findByGlobalId(globalId);

			expect(foundUser).toHaveProperty('id', user.id);
			expect(foundUser).toHaveProperty('name', 'John Doe');
		});

		it('should handle different types with the same mixins', async () => {
			// Create a user and a post
			const user = await UserModel.insertWithSlug({
				name: 'Mixed User',
				email: 'mixed@example.com',
			});

			const post = await PostModel.insertWithSlug({
				user_id: user.id,
				title: 'Mixed Post',
				content: 'This is a post with mixins',
			});

			// Generate global IDs for both
			const userGlobalId = UserModel.getGlobalId(user.id);
			const postGlobalId = PostModel.getGlobalId(post.id);

			// Verify they're different despite same local ID
			expect(userGlobalId).not.toBe(postGlobalId);

			// Verify correct type resolution
			const foundUser = await UserModel.findByGlobalId(userGlobalId);
			const foundPost = await PostModel.findByGlobalId(postGlobalId);

			expect(foundUser).toHaveProperty('name', 'Mixed User');
			expect(foundPost).toHaveProperty('title', 'Mixed Post');

			// Verify wrong type resolution fails
			const wrongTypeUser = await UserModel.findByGlobalId(postGlobalId);
			const wrongTypePost = await PostModel.findByGlobalId(userGlobalId);

			expect(wrongTypeUser).toBeNull();
			expect(wrongTypePost).toBeNull();
		});
	});

	describe('complex mixin interactions', () => {
		it('should handle multiple operations with composed mixins', async () => {
			// First insert a user with a slug
			const user = await UserModel.insertWithSlug({
				name: 'Complex User',
				email: 'complex@example.com',
			});

			// Verify slug was generated
			expect(user).toHaveProperty('slug', 'complex-user');

			// Get the global ID
			const globalId = UserModel.getGlobalId(user.id);

			// Update the user through a different method
			await db
				.updateTable('users')
				.set({ name: 'Updated Complex User' })
				.where('id', '=', user.id)
				.execute();

			// Find by global ID after update
			const updatedUser = await UserModel.findByGlobalId(globalId);

			expect(updatedUser).toHaveProperty('name', 'Updated Complex User');

			// Insert another user with the same name to test slug uniqueness
			const user2 = await UserModel.insertWithSlug({
				name: 'Complex User',
				email: 'complex2@example.com',
			});

			// The slug should still be unique
			expect(user2.slug).not.toBe(user.slug);
		});

		it('should support custom query functions with multiple mixins', async () => {
			// Define a custom query that combines functionality from different mixins
			const findActiveUsers = () => {
				return UserModel.selectFrom().where('status', '=', 'active').execute();
			};

			// Execute the query
			const activeUsers = await findActiveUsers();

			expect(activeUsers).toHaveLength(1);
			expect(activeUsers[0]).toHaveProperty('name', 'John Doe');

			// Get global IDs for all users
			const usersWithGlobalIds = activeUsers.map((user) => ({
				...user,
				globalId: UserModel.getGlobalId(user.id),
			}));

			expect(usersWithGlobalIds[0]).toHaveProperty('globalId');

			// Verify we can find by the generated global ID
			const foundUser = await UserModel.findByGlobalId(
				usersWithGlobalIds[0].globalId
			);
			expect(foundUser).toHaveProperty('id', activeUsers[0].id);
		});
	});
});
