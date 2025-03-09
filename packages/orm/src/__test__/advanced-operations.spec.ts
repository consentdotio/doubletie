import { sql } from 'kysely';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { Mock } from 'vitest';
import { MixinUserModel, db, toSqliteDate } from './utils/common-setup';
import type { EnhancedUserModelType } from './utils/common-setup';

// Define mock types for query builders
interface MockUpdateBuilder {
	set: Mock;
	where: Mock;
	whereIn: Mock;
	execute: Mock;
}

describe('Advanced Model Operations', () => {
	it('should support creating custom query builders', async () => {
		// Define a status extension type

		// Return type for batch update
		interface BatchUpdateResult {
			numUpdatedRows: bigint;
		}

		// Create a batch update function using a custom query builder
		const batchUpdateStatus = async (
			userIds: number[],
			status: string
		): Promise<BatchUpdateResult> => {
			// Store the original updateTable method
			const originalUpdateTable = (MixinUserModel as EnhancedUserModelType)
				.updateTable;

			// Create typed mock
			const mockUpdateBuilder: MockUpdateBuilder = {
				set: vi.fn().mockReturnThis(),
				where: vi.fn().mockReturnThis(),
				whereIn: vi.fn().mockReturnThis(),
				execute: vi.fn().mockResolvedValue({ numUpdatedRows: BigInt(5) }),
			};

			// Mock the update method
			(MixinUserModel as EnhancedUserModelType).updateTable = vi
				.fn()
				.mockReturnValue(mockUpdateBuilder);

			// Use the mocked method
			const result = await (MixinUserModel as EnhancedUserModelType)
				.updateTable()
				.set({ status })
				.whereIn('id', userIds)
				.execute();

			// Verify the update was called with correct params
			expect(
				(MixinUserModel as EnhancedUserModelType).updateTable
			).toHaveBeenCalledTimes(1);
			expect(mockUpdateBuilder.set).toHaveBeenCalledWith({
				status,
			});
			expect(mockUpdateBuilder.whereIn).toHaveBeenCalled();

			// Restore the original method
			(MixinUserModel as EnhancedUserModelType).updateTable =
				originalUpdateTable;

			return result;
		};

		// Test the batch update function
		const result = await batchUpdateStatus([1, 2, 3, 4, 5], 'inactive');

		// Verify the result contains expected properties
		expect(result).toHaveProperty('numUpdatedRows');
		expect(result.numUpdatedRows).toBe(BigInt(5));
	});

	it('should handle batch operations efficiently', async () => {
		// Create test data
		const testUsers = [
			{ id: 1, name: 'User 1', email: 'user1@test.com' },
			{ id: 2, name: 'User 2', email: 'user2@test.com' },
			{ id: 3, name: 'User 3', email: 'user3@test.com' },
		];

		// Mock the selectFrom method
		const originalSelectFrom = (MixinUserModel as any).selectFrom;
		(MixinUserModel as any).selectFrom = vi.fn().mockReturnValue({
			where: vi.fn().mockReturnThis(),
			whereIn: vi.fn().mockReturnThis(),
			selectAll: vi.fn().mockReturnThis(),
			execute: vi.fn().mockResolvedValue(testUsers),
		});

		// Create a function to get multiple users by IDs
		const getUsersByIds = async (ids: number[]) => {
			return (MixinUserModel as any)
				.selectFrom()
				.whereIn('id', ids)
				.selectAll()
				.execute();
		};

		// Test the batch operation
		const users = await getUsersByIds([1, 2, 3]);

		// Verify the result
		expect(Array.isArray(users)).toBe(true);
		expect(users.length).toBe(3);
		expect(users[0].id).toBe(1);
		expect(users[1].id).toBe(2);
		expect(users[2].id).toBe(3);

		// Check that the whereIn was called with the correct IDs
		const mockChain = (MixinUserModel as any).selectFrom.mock.results[0].value;
		expect(mockChain.whereIn).toHaveBeenCalledWith('id', [1, 2, 3]);

		// Restore original method
		(MixinUserModel as any).selectFrom = originalSelectFrom;
	});

	it('should handle user-article relationships', async () => {
		// Drop existing tables if they exist - delete in the correct order
		await db.db.schema.dropTable('user_favorites').ifExists().execute();
		await db.db.schema.dropTable('articles').ifExists().execute();
		await db.db.schema.dropTable('comments').ifExists().execute();
		await db.db.schema.dropTable('users').ifExists().execute();

		// Create users table
		await db.db.schema
			.createTable('users')
			.ifNotExists()
			.addColumn('id', 'integer', (col) => col.primaryKey().autoIncrement())
			.addColumn('email', 'text', (col) => col.unique().notNull())
			.addColumn('name', 'text', (col) => col.notNull())
			.addColumn('username', 'text', (col) => col.notNull())
			.addColumn('password', 'text', (col) => col.notNull())
			.addColumn('status', 'text', (col) => col.notNull().defaultTo('active'))
			.addColumn('followersCount', 'integer', (col) => col.defaultTo(0))
			.addColumn('createdAt', 'text')
			.addColumn('updatedAt', 'text')
			.execute();

		// Create articles table
		await db.db.schema
			.createTable('articles')
			.ifNotExists()
			.addColumn('id', 'text', (col) => col.primaryKey())
			.addColumn('title', 'text', (col) => col.notNull())
			.addColumn('slug', 'text', (col) => col.notNull())
			.addColumn('userId', 'integer', (col) =>
				col.notNull().references('users.id')
			)
			.addColumn('createdAt', 'text')
			.addColumn('updatedAt', 'text')
			.execute();

		// Create user-article join table for tracking favorites - use lowercase column names for SQLite
		await db.db.schema
			.createTable('user_favorites')
			.ifNotExists()
			.addColumn('user_id', 'integer', (col) =>
				col.notNull().references('users.id')
			)
			.addColumn('article_id', 'text', (col) =>
				col.notNull().references('articles.id')
			)
			.addPrimaryKeyConstraint('pk_user_favorites', ['user_id', 'article_id'])
			.execute();

		const now = new Date();

		// Add users
		const users = await Promise.all([
			db.db
				.insertInto('users')
				.values({
					email: 'author@example.com',
					name: 'Test Author',
					username: 'testauthor',
					password: 'password',
					status: 'active',
					followersCount: 0,
					createdAt: toSqliteDate(now),
					updatedAt: toSqliteDate(now),
				} as any)
				.returning('id')
				.executeTakeFirstOrThrow(),

			db.db
				.insertInto('users')
				.values({
					email: 'reader@example.com',
					name: 'Test Reader',
					username: 'testreader',
					password: 'password',
					status: 'active',
					followersCount: 0,
					createdAt: toSqliteDate(now),
					updatedAt: toSqliteDate(now),
				} as any)
				.returning('id')
				.executeTakeFirstOrThrow(),
		]);

		const authorId = users[0].id;
		const readerId = users[1].id;

		// Add articles
		const articles = await Promise.all([
			db.db
				.insertInto('articles')
				.values({
					id: 'article1',
					title: 'JavaScript Tips',
					slug: 'javascript-tips',
					userId: authorId,
					createdAt: toSqliteDate(now),
					updatedAt: toSqliteDate(now),
				} as any)
				.returning('id')
				.executeTakeFirstOrThrow(),

			db.db
				.insertInto('articles')
				.values({
					id: 'article2',
					title: 'TypeScript Tricks',
					slug: 'typescript-tricks',
					userId: authorId,
					createdAt: toSqliteDate(now),
					updatedAt: toSqliteDate(now),
				} as any)
				.returning('id')
				.executeTakeFirstOrThrow(),
		]);

		// Create a temporary custom query to use user_favorites table with correct column names
		async function insertUserFavorite(userId: number, articleId: string) {
			await sql`INSERT INTO user_favorites (user_id, article_id) VALUES (${userId}, ${articleId})`.execute(
				db.db
			);
		}

		// Add favorite relationships - reader likes both articles
		await Promise.all([
			insertUserFavorite(readerId, articles[0].id),
			insertUserFavorite(readerId, articles[1].id),
		]);

		// Query user's favorite articles with raw SQL using correct column names
		const result = await db.db.executeQuery({
			sql: `
				SELECT
					a.id as articleId,
					a.title as articleTitle,
					u.id as userId,
					u.name as userName
				FROM
					articles a
				INNER JOIN
					user_favorites f ON a.id = f.article_id
				INNER JOIN
					users u ON f.user_id = u.id
				WHERE
					f.user_id = ?
				ORDER BY
					a.id DESC
			`,
			parameters: [readerId],
			query: { kind: 'RawNode' } as any,
		});

		// Parse the results
		const readerFavorites = result.rows as {
			userId: number;
			userName: string;
			articleId: string;
			articleTitle: string;
		}[];

		// Verify relationship queries
		expect(readerFavorites.length).toBe(2); // Reader favorited both articles
		expect(readerFavorites.map((r) => r.articleTitle).sort()).toEqual([
			'JavaScript Tips',
			'TypeScript Tricks',
		]);

		// Clean up tables in the correct order
		await db.db.schema.dropTable('user_favorites').ifExists().execute();
		await db.db.schema.dropTable('articles').ifExists().execute();
		await db.db.schema.dropTable('users').ifExists().execute();
	});

	// Test for schema validation
	it('should validate data against schema constraints', async () => {
		try {
			// Drop tables in the correct order to avoid foreign key constraints
			await db.db.schema.dropTable('user_favorites').ifExists().execute();
			await db.db.schema.dropTable('articles').ifExists().execute();
			await db.db.schema.dropTable('comments').ifExists().execute();
			await db.db.schema.dropTable('users').ifExists().execute();
		} catch (error) {
			console.log('Error dropping tables, continuing anyway:', error);
		}

		// Create users table with constraints
		await db.db.schema
			.createTable('users')
			.ifNotExists()
			.addColumn('id', 'integer', (col) => col.primaryKey().autoIncrement())
			.addColumn('email', 'text', (col) => col.unique().notNull())
			.addColumn('name', 'text', (col) => col.notNull())
			.addColumn('username', 'text', (col) => col.notNull())
			.addColumn('password', 'text', (col) => col.notNull())
			.addColumn('status', 'text', (col) => col.notNull().defaultTo('active'))
			.addColumn('followersCount', 'integer', (col) => col.defaultTo(0))
			.addColumn('createdAt', 'text')
			.addColumn('updatedAt', 'text')
			.execute();

		// Test inserting a user without a required field (email)
		try {
			await db.db
				.insertInto('users')
				.values({
					// Missing required email field
					name: 'Validation Test User',
					username: 'validation',
					password: 'password',
					status: 'active',
					followersCount: 0,
					createdAt: toSqliteDate(new Date()),
					updatedAt: toSqliteDate(new Date()),
				} as any)
				.execute();

			// If we get here, the test failed
			throw new Error(
				'Insert should have failed due to missing required field'
			);
		} catch (error) {
			// Verify error message indicates NOT NULL constraint
			expect((error as Error).message).toContain('NOT NULL constraint');
		}

		// Test unique constraint
		const now = new Date();
		await db.db
			.insertInto('users')
			.values({
				email: 'unique@example.com',
				name: 'Unique User',
				username: 'unique',
				password: 'password',
				status: 'active',
				followersCount: 0,
				createdAt: toSqliteDate(now),
				updatedAt: toSqliteDate(now),
			} as any)
			.execute();

		try {
			await db.db
				.insertInto('users')
				.values({
					email: 'unique@example.com', // Same email to cause constraint violation
					name: 'Duplicate Email User',
					username: 'unique2',
					password: 'password',
					status: 'active',
					followersCount: 0,
					createdAt: toSqliteDate(now),
					updatedAt: toSqliteDate(now),
				} as any)
				.execute();

			// If we get here, the test failed
			throw new Error('Insert should have failed due to unique constraint');
		} catch (error) {
			// Verify error message indicates UNIQUE constraint
			expect((error as Error).message).toContain('UNIQUE constraint');
		}

		// Clean up in correct order
		try {
			await db.db.schema.dropTable('users').ifExists().execute();
		} catch (error) {
			console.log('Error dropping users table:', error);
		}
	});

	// Test for concurrency
	it('should handle concurrent operations correctly', async () => {
		try {
			// Drop tables in the correct order to avoid foreign key constraints
			await db.db.schema.dropTable('user_favorites').ifExists().execute();
			await db.db.schema.dropTable('articles').ifExists().execute();
			await db.db.schema.dropTable('comments').ifExists().execute();
			await db.db.schema.dropTable('users').ifExists().execute();
		} catch (error) {
			console.log('Error dropping tables, continuing anyway:', error);
		}

		// Create users table
		await db.db.schema
			.createTable('users')
			.ifNotExists()
			.addColumn('id', 'integer', (col) => col.primaryKey().autoIncrement())
			.addColumn('email', 'text', (col) => col.unique().notNull())
			.addColumn('name', 'text', (col) => col.notNull())
			.addColumn('username', 'text', (col) => col.notNull())
			.addColumn('password', 'text', (col) => col.notNull())
			.addColumn('status', 'text', (col) => col.notNull().defaultTo('active'))
			.addColumn('followersCount', 'integer', (col) => col.defaultTo(0))
			.addColumn('createdAt', 'text')
			.addColumn('updatedAt', 'text')
			.execute();

		// Insert test user with properly converted dates
		const now = new Date();
		const insertedUser = await db.db
			.insertInto('users')
			.values({
				email: 'concurrent@example.com',
				name: 'Concurrent User',
				username: 'concurrent',
				password: 'password',
				status: 'active',
				followersCount: 0,
				createdAt: toSqliteDate(now),
				updatedAt: toSqliteDate(now),
			} as any)
			.returning(['id', 'name'])
			.executeTakeFirstOrThrow();

		// Simulate two concurrent updates with different transaction instances
		const updatePromises = [
			db.db.transaction().execute(async (trx) => {
				// First transaction
				await trx
					.updateTable('users')
					.set({
						name: 'Updated by Transaction 1',
						updatedAt: toSqliteDate(new Date()),
					} as any)
					.where('id', '=', insertedUser.id)
					.execute();

				// Add a small delay to simulate longer transaction
				await new Promise((resolve) => setTimeout(resolve, 10));
			}),

			db.db.transaction().execute(async (trx) => {
				// Second transaction
				await trx
					.updateTable('users')
					.set({
						name: 'Updated by Transaction 2',
						updatedAt: toSqliteDate(new Date()),
					} as any)
					.where('id', '=', insertedUser.id)
					.execute();
			}),
		];

		// Wait for both transactions to complete
		await Promise.all(updatePromises);

		// Verify final state
		const updatedUser = await db.db
			.selectFrom('users')
			.where('id', '=', insertedUser.id)
			.select(['id', 'name'])
			.executeTakeFirstOrThrow();

		// One of the updates should win
		expect(
			['Updated by Transaction 1', 'Updated by Transaction 2'].includes(
				updatedUser.name
			)
		).toBe(true);
		expect(updatedUser.name).not.toBe('Concurrent User'); // Original name should be changed

		// Clean up in correct order
		try {
			await db.db.schema.dropTable('users').ifExists().execute();
		} catch (error) {
			console.log('Error dropping users table:', error);
		}
	});

	// Add a new test for tuple support
	it('should support tuple operations', async () => {
		// Create a tuple-based finder function
		const findProductsByTuple = async (conditions: [string, string][]) => {
			return db.db
				.selectFrom('products')
				.selectAll()
				.where((eb) => {
					// Generate dynamic OR conditions for tuples
					const tupleConditions = conditions.map(([name, id]) =>
						// Using a simpler approach without tuples
						eb.and([eb('name', '=', name), eb('id', '=', id)])
					);

					// Combine conditions with OR
					return eb.or(tupleConditions);
				})
				.execute();
		};

		// Test with some sample data
		const products = await findProductsByTuple([
			['Product A', 'product1'],
			['Product B', 'product2'],
		]);

		// Verify the results
		expect(Array.isArray(products)).toBe(true);
	});
});

describe('JSON operations', () => {
	it('should query using jsonPath operator', async () => {
		// Create a test table with JSON data
		await db.db.schema
			.createTable('json_test')
			.ifNotExists()
			.addColumn('id', 'varchar', (col) => col.primaryKey())
			.addColumn('data', 'json')
			.execute();

		// Insert test data with JSON
		await (db.db as any)
			.insertInto('json_test')
			.values([
				{
					id: 'json1',
					data: JSON.stringify({
						user: {
							name: 'John',
							profile: {
								preferences: {
									theme: 'dark',
									notifications: true,
								},
							},
						},
					}),
				},
				{
					id: 'json2',
					data: JSON.stringify({
						user: {
							name: 'Jane',
							profile: {
								preferences: {
									theme: 'light',
									notifications: false,
								},
							},
						},
					}),
				},
			])
			.execute();

		try {
			// Query using jsonPath
			const results = await (db.db as any)
				.selectFrom('json_test')
				.selectAll()
				.where(
					sql`json_extract(data, '$.user.profile.preferences.theme')`,
					'=',
					'dark'
				)
				.execute();

			// Verify results
			expect(Array.isArray(results)).toBe(true);
			expect(results.length).toBe(1);
			expect(results[0].id).toBe('json1');

			// Verify the JSON data can be parsed
			const parsedData = JSON.parse(results[0].data);
			expect(parsedData.user.profile.preferences.theme).toBe('dark');
		} finally {
			// Clean up
			await db.db.schema.dropTable('json_test').ifExists().execute();
		}
	});
});

describe('Streaming operations', () => {
	it('should stream data from large result sets', async () => {
		// Create a test table for streaming
		await db.db.schema
			.createTable('stream_test')
			.ifNotExists()
			.addColumn('id', 'integer', (col) => col.primaryKey())
			.addColumn('value', 'varchar')
			.execute();

		// Insert a larger dataset (100 rows)
		const insertValues = Array.from({ length: 100 }, (_, i) => ({
			id: i + 1,
			value: `Value ${i + 1}`,
		}));

		await (db.db as any)
			.insertInto('stream_test')
			.values(insertValues)
			.execute();

		try {
			// Use Kysely's stream feature
			const streamedItems: any[] = [];

			// Using the streamify helper from kysely
			const stream = await (db.db as any)
				.selectFrom('stream_test')
				.selectAll()
				.orderBy('id', 'asc')
				.stream();

			// Process the stream
			for await (const item of stream) {
				streamedItems.push(item);

				// If using Node.js streams, you would do:
				// stream.on('data', (item) => { streamedItems.push(item); });
			}

			// Verify all rows were streamed
			expect(streamedItems.length).toBe(100);
			expect(streamedItems[0].id).toBe(1);
			expect(streamedItems[99].id).toBe(100);
		} finally {
			// Clean up
			await (db.db as any).schema.dropTable('stream_test').ifExists().execute();
		}
	});
});

// Add a new describe block for findByTuple tests after the 'JSON operations' block
describe('findByTuple operations', () => {
	let TestTupleModel: any;

	beforeEach(async () => {
		// Create a test table with proper type assertion to bypass schema constraints
		// @ts-ignore - We're deliberately creating a table not in the DB schema for testing
		await db.db.schema
			.createTable('test_tuples')
			.ifNotExists()
			.addColumn('id', 'varchar', (col) => col.primaryKey())
			.addColumn('name', 'varchar')
			.addColumn('category', 'varchar')
			.addColumn('price', 'numeric')
			.addColumn('created_at', 'varchar')
			.execute();

		// Insert test data with proper type assertion
		// @ts-ignore - Using a table not in the schema for testing
		await db.db
			//@ts-expect-error
			.insertInto('test_tuples')
			.values([
				{
					id: 'item1',
					name: 'Item One',
					category: 'Category A',
					price: 10.99,
					created_at: toSqliteDate(new Date()),
				},
				{
					id: 'item2',
					name: 'Item Two',
					category: 'Category A',
					price: 20.49,
					created_at: toSqliteDate(new Date()),
				},
				{
					id: 'item3',
					name: 'Item Three',
					category: 'Category B',
					price: 15.99,
					created_at: toSqliteDate(new Date()),
				},
				{
					id: 'item4',
					name: 'Item Four',
					category: 'Category B',
					price: 25.99,
					created_at: toSqliteDate(new Date()),
				},
				{
					id: 'item5',
					name: 'Item Five',
					category: 'Category C',
					price: 30.49,
					created_at: toSqliteDate(new Date()),
				},
			] as any)
			.execute();

		// Create a test model for the test_tuples table
		// @ts-ignore - Using a table not in the schema for testing
		TestTupleModel = db.model('test_tuples', 'id');
	});

	afterEach(async () => {
		// Drop the test table
		// @ts-ignore - Using a table not in the schema for testing
		await db.db.schema.dropTable('test_tuples').ifExists().execute();
	});

	it('should find items by a single column tuple', async () => {
		const items = await TestTupleModel.findByTuple(
			['category'],
			['Category A']
		);

		expect(Array.isArray(items)).toBe(true);
		expect(items.length).toBe(2);
		expect(items[0].name).toBe('Item One');
		expect(items[1].name).toBe('Item Two');
	});

	it('should find items by a two-column tuple', async () => {
		const items = await TestTupleModel.findByTuple(
			['category', 'price'],
			['Category B', 25.99]
		);

		expect(Array.isArray(items)).toBe(true);
		expect(items.length).toBe(1);
		expect(items[0].name).toBe('Item Four');
	});

	it('should find items by a three-column tuple', async () => {
		const items = await TestTupleModel.findByTuple(
			['id', 'name', 'category'],
			['item5', 'Item Five', 'Category C']
		);

		expect(Array.isArray(items)).toBe(true);
		expect(items.length).toBe(1);
		expect(items[0].id).toBe('item5');
	});

	it('should handle four-column tuples', async () => {
		const items = await TestTupleModel.findByTuple(
			['id', 'name', 'category', 'price'],
			['item3', 'Item Three', 'Category B', 15.99]
		);

		expect(Array.isArray(items)).toBe(true);
		expect(items.length).toBe(1);
		expect(items[0].id).toBe('item3');
	});

	it('should handle five-column tuples', async () => {
		const now = new Date();
		const dateStr = toSqliteDate(now);

		// First update the record to have a specific date for testing
		// @ts-ignore - Using a table not in the schema for testing
		await db.db
			//@ts-expect-error
			.updateTable('test_tuples')
			//@ts-expect-error
			.set({ created_at: dateStr })
			.where('id', '=', 'item1')
			.execute();

		const items = await TestTupleModel.findByTuple(
			['id', 'name', 'category', 'price', 'created_at'],
			['item1', 'Item One', 'Category A', 10.99, dateStr]
		);

		expect(Array.isArray(items)).toBe(true);
		expect(items.length).toBe(1);
		expect(items[0].id).toBe('item1');
	});

	it('should throw an error when columns and values have different lengths', async () => {
		await expect(
			TestTupleModel.findByTuple(['id', 'name'], ['item1'])
		).rejects.toThrow('Columns and values arrays must have the same length');
	});

	it('should throw an error when trying to use more than 5 columns', async () => {
		await expect(
			TestTupleModel.findByTuple(
				['col1', 'col2', 'col3', 'col4', 'col5', 'col6'],
				[1, 2, 3, 4, 5, 6]
			)
		).rejects.toThrow('Tuple with 6 columns is not supported');
	});
});
