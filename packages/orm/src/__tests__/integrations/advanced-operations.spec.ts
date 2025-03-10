import { sql } from 'kysely';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import createModel from '~/model';
import { setupTestDatabase, teardownTestDatabase } from '../fixtures/test-db';

// Helper function to convert date to SQLite format
const toSqliteDate = (date: Date): string => date.toISOString();

describe('Advanced Model Operations - Integration Tests', () => {
	let db: any;
	let UserModel: any;

	beforeEach(async () => {
		db = await setupTestDatabase();
		UserModel = createModel(db, 'users', 'id');
	});

	afterEach(async () => {
		await teardownTestDatabase(db);
	});

	it.skip('should handle user-article relationships', async () => {
		// Create users table
		await db.schema
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
		await db.schema
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

		// Create user-article join table for tracking favorites
		await db.schema
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
			db
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
				})
				.returning('id')
				.executeTakeFirstOrThrow(),

			db
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
				})
				.returning('id')
				.executeTakeFirstOrThrow(),
		]);

		const authorId = users[0].id;
		const readerId = users[1].id;

		// Add articles
		const articles = await Promise.all([
			db
				.insertInto('articles')
				.values({
					id: 'article1',
					title: 'JavaScript Tips',
					slug: 'javascript-tips',
					userId: authorId,
					createdAt: toSqliteDate(now),
					updatedAt: toSqliteDate(now),
				})
				.returning('id')
				.executeTakeFirstOrThrow(),

			db
				.insertInto('articles')
				.values({
					id: 'article2',
					title: 'TypeScript Tricks',
					slug: 'typescript-tricks',
					userId: authorId,
					createdAt: toSqliteDate(now),
					updatedAt: toSqliteDate(now),
				})
				.returning('id')
				.executeTakeFirstOrThrow(),
		]);

		// Create a temporary custom query to use user_favorites table
		async function insertUserFavorite(userId: number, articleId: string) {
			await sql`INSERT INTO user_favorites (user_id, article_id) VALUES (${userId}, ${articleId})`.execute(
				db
			);
		}

		// Add favorite relationships - reader likes both articles
		await Promise.all([
			insertUserFavorite(readerId, articles[0].id),
			insertUserFavorite(readerId, articles[1].id),
		]);

		// Query user's favorite articles with raw SQL
		const result = await db.executeQuery({
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
	});

	// Test for schema validation
	it.skip('should validate data against schema constraints', async () => {
		// Create users table with constraints
		await db.schema
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
			await db
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
				})
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
		await db
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
			})
			.execute();

		try {
			await db
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
				})
				.execute();

			// If we get here, the test failed
			throw new Error('Insert should have failed due to unique constraint');
		} catch (error) {
			// Verify error message indicates UNIQUE constraint
			expect((error as Error).message).toContain('UNIQUE constraint');
		}
	});

	it.skip('should handle concurrent operations correctly', async () => {
		// Create users table
		await db.schema
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

		// Insert test user
		const now = new Date();
		const insertedUser = await db
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
			})
			.returning(['id', 'name'])
			.executeTakeFirstOrThrow();

		// Simulate two concurrent updates with different transaction instances
		const updatePromises = [
			db.transaction().execute(async (trx) => {
				// First transaction
				await trx
					.updateTable('users')
					.set({
						name: 'Updated by Transaction 1',
						updatedAt: toSqliteDate(new Date()),
					})
					.where('id', '=', insertedUser.id)
					.execute();

				// Add a small delay to simulate longer transaction
				await new Promise((resolve) => setTimeout(resolve, 10));
			}),

			db.transaction().execute(async (trx) => {
				// Second transaction
				await trx
					.updateTable('users')
					.set({
						name: 'Updated by Transaction 2',
						updatedAt: toSqliteDate(new Date()),
					})
					.where('id', '=', insertedUser.id)
					.execute();
			}),
		];

		// Wait for both transactions to complete
		await Promise.all(updatePromises);

		// Verify final state
		const updatedUser = await db
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
	});

	it.skip('should handle JSON operations', async () => {
		// Create a test table with JSON data
		await db.schema
			.createTable('json_test')
			.ifNotExists()
			.addColumn('id', 'varchar', (col) => col.primaryKey())
			.addColumn('data', 'json')
			.execute();

		// Insert test data with JSON
		await db
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

		// Query using jsonPath
		const results = await db
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
	});

	it.skip('should support streaming large result sets', async () => {
		// Create a test table for streaming
		await db.schema
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

		await db.insertInto('stream_test').values(insertValues).execute();

		// Use streaming to process results in chunks
		const streamedItems: any[] = [];
		const stream = await db
			.selectFrom('stream_test')
			.selectAll()
			.orderBy('id', 'asc')
			.stream();

		// Process the stream
		for await (const item of stream) {
			streamedItems.push(item);
		}

		// Verify all rows were streamed
		expect(streamedItems.length).toBe(100);
		expect(streamedItems[0].id).toBe(1);
		expect(streamedItems[99].id).toBe(100);
	});

	it.skip('should support findByTuple operations', async () => {
		// Create a test table
		await db.schema
			.createTable('test_tuples')
			.ifNotExists()
			.addColumn('id', 'varchar', (col) => col.primaryKey())
			.addColumn('name', 'varchar')
			.addColumn('category', 'varchar')
			.addColumn('price', 'numeric')
			.addColumn('created_at', 'varchar')
			.execute();

		// Insert test data
		await db
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
			])
			.execute();

		// Create a test model for the test_tuples table
		const TestTupleModel = createModel(db, 'test_tuples', 'id');

		// Define the findByTuple function
		TestTupleModel.findByTuple = async function <T extends any[]>(
			columns: string[],
			values: T
		) {
			// Validate tuple lengths
			if (columns.length !== values.length) {
				throw new Error('Columns and values arrays must have the same length');
			}

			if (columns.length > 5) {
				throw new Error(
					`Tuple with ${columns.length} columns is not supported`
				);
			}

			// Build the query
			let query = db.selectFrom('test_tuples').selectAll();

			// Add conditions for each column/value pair
			for (let i = 0; i < columns.length; i++) {
				query = query.where(columns[i], '=', values[i]);
			}

			return query.execute();
		};

		// Test with different column counts
		const singleColumn = await TestTupleModel.findByTuple(
			['category'],
			['Category A']
		);
		expect(singleColumn.length).toBe(2);
		expect(singleColumn[0].name).toBe('Item One');
		expect(singleColumn[1].name).toBe('Item Two');

		const twoColumns = await TestTupleModel.findByTuple(
			['category', 'price'],
			['Category B', 25.99]
		);
		expect(twoColumns.length).toBe(1);
		expect(twoColumns[0].name).toBe('Item Four');

		const threeColumns = await TestTupleModel.findByTuple(
			['id', 'name', 'category'],
			['item5', 'Item Five', 'Category C']
		);
		expect(threeColumns.length).toBe(1);
		expect(threeColumns[0].id).toBe('item5');

		// Test error cases
		await expect(
			TestTupleModel.findByTuple(['id', 'name'], ['item1'])
		).rejects.toThrow('Columns and values arrays must have the same length');

		await expect(
			TestTupleModel.findByTuple(
				['col1', 'col2', 'col3', 'col4', 'col5', 'col6'],
				[1, 2, 3, 4, 5, 6]
			)
		).rejects.toThrow('Tuple with 6 columns is not supported');
	});
});
