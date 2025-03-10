import { sql } from 'kysely';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import createModel from '~/model';
import {
	setupTestDatabase,
	teardownTestDatabase,
} from '../fixtures/test-db';

// Helper function to convert date to SQLite format
const toSqliteDate = (date: Date): string => date.toISOString();

describe('Basic CRUD Operations - Integration Tests', () => {
	let db: any;
	let UserModel: any;
	let CommentModel: any;

	beforeEach(async () => {
		db = await setupTestDatabase();
		UserModel = createModel(db, 'users', 'id');
		CommentModel = createModel(db, 'comments', 'id');

		// Create users table for testing
		await db.schema
			.createTable('users')
			.ifNotExists()
			.addColumn('id', 'integer', (col) => col.primaryKey().autoIncrement())
			.addColumn('email', 'text', (col) => col.unique().notNull())
			.addColumn('name', 'text', (col) => col.notNull())
			.addColumn('username', 'text', (col) => col.notNull())
			.addColumn('password', 'text', (col) => col.notNull())
			.addColumn('followersCount', 'integer', (col) => col.defaultTo(0))
			.addColumn('createdAt', 'text')
			.addColumn('updatedAt', 'text')
			.execute();

		// Create comments table for relationship tests
		await db.schema
			.createTable('comments')
			.ifNotExists()
			.addColumn('id', 'integer', (col) => col.primaryKey().autoIncrement())
			.addColumn('userId', 'integer', (col) =>
				col.notNull().references('users.id')
			)
			.addColumn('message', 'text', (col) => col.notNull())
			.addColumn('createdAt', 'text')
			.addColumn('updatedAt', 'text')
			.execute();
	});

	afterEach(async () => {
		await teardownTestDatabase(db);
	});

	it('should create and find a user', async () => {
		// Insert a test user
		const now = new Date();
		const insertResult = await db
			.insertInto('users')
			.values({
				email: 'create-test@example.com',
				name: 'Create Test',
				username: 'create-test',
				password: 'password',
				followersCount: 0,
				createdAt: toSqliteDate(now),
				updatedAt: toSqliteDate(now),
			})
			.returning('id')
			.executeTakeFirst();

		expect(insertResult).toBeDefined();
		expect(insertResult.id).toBeDefined();

		// Find the user by email
		const user = await db
			.selectFrom('users')
			.where('email', '=', 'create-test@example.com')
			.selectAll()
			.executeTakeFirst();

		expect(user).toBeDefined();
		expect(user.email).toBe('create-test@example.com');
		expect(user.name).toBe('Create Test');
	});

	it('should update a user', async () => {
		// Insert a test user
		const now = new Date();
		const insertResult = await db
			.insertInto('users')
			.values({
				email: 'update-test@example.com',
				name: 'Update Test',
				username: 'update-test',
				password: 'password',
				followersCount: 0,
				createdAt: toSqliteDate(now),
				updatedAt: toSqliteDate(now),
			})
			.returning('id')
			.executeTakeFirst();

		const userId = insertResult.id;

		// Update the user
		await db
			.updateTable('users')
			.set({
				name: 'Updated Name',
				followersCount: 10,
				updatedAt: toSqliteDate(new Date()),
			})
			.where('id', '=', userId)
			.execute();

		// Verify the update
		const updatedUser = await db
			.selectFrom('users')
			.where('id', '=', userId)
			.selectAll()
			.executeTakeFirst();

		expect(updatedUser).toBeDefined();
		expect(updatedUser.name).toBe('Updated Name');
		expect(updatedUser.followersCount).toBe(10);
	});

	it('should delete a user', async () => {
		// Insert a test user
		const now = new Date();
		const insertResult = await db
			.insertInto('users')
			.values({
				email: 'delete-test@example.com',
				name: 'Delete Test',
				username: 'delete-test',
				password: 'password',
				followersCount: 0,
				createdAt: toSqliteDate(now),
				updatedAt: toSqliteDate(now),
			})
			.returning('id')
			.executeTakeFirst();

		const userId = insertResult.id;

		// Verify the user exists
		const userBeforeDelete = await db
			.selectFrom('users')
			.where('id', '=', userId)
			.selectAll()
			.executeTakeFirst();

		expect(userBeforeDelete).toBeDefined();

		// Delete the user
		await db.deleteFrom('users').where('id', '=', userId).execute();

		// Verify the user was deleted
		const userAfterDelete = await db
			.selectFrom('users')
			.where('id', '=', userId)
			.selectAll()
			.executeTakeFirst();

		expect(userAfterDelete).toBeUndefined();
	});

	it('should update a single column using direct set method', async () => {
		// Insert a test user
		const now = new Date();
		const insertResult = await db
			.insertInto('users')
			.values({
				email: 'column-test@example.com',
				name: 'Column Test',
				username: 'column-test',
				password: 'password',
				followersCount: 0,
				createdAt: toSqliteDate(now),
				updatedAt: toSqliteDate(now),
			})
			.returning('id')
			.executeTakeFirst();

		const userId = insertResult.id;

		// Update single column using direct set method
		await db
			.updateTable('users')
			.set('email', 'updated-column@example.com')
			.where('id', '=', userId)
			.execute();

		// Verify the update
		const updatedUser = await db
			.selectFrom('users')
			.where('id', '=', userId)
			.selectAll()
			.executeTakeFirst();

		expect(updatedUser).toBeDefined();
		expect(updatedUser.email).toBe('updated-column@example.com');
	});

	it('should update a column with updateColumn method', async () => {
		// Insert a test user
		const now = new Date();
		const insertResult = await db
			.insertInto('users')
			.values({
				email: 'update-column@example.com',
				name: 'Update Column Test',
				username: 'update-column',
				password: 'password',
				followersCount: 0,
				createdAt: toSqliteDate(now),
				updatedAt: toSqliteDate(now),
			})
			.returning('id')
			.executeTakeFirst();

		const userId = insertResult.id;

		// Use the updateColumn method
		await db
			.updateColumn('users', 'name', 'Updated Column Name')
			.where('id', '=', userId)
			.execute();

		// Verify the update
		const updatedUser = await db
			.selectFrom('users')
			.where('id', '=', userId)
			.selectAll()
			.executeTakeFirst();

		expect(updatedUser).toBeDefined();
		expect(updatedUser.name).toBe('Updated Column Name');
	});

	it('should support cursor-based pagination', async () => {
		// Insert test users with different creation dates
		const dates = [
			new Date('2023-01-01'),
			new Date('2023-01-02'),
			new Date('2023-01-03'),
		];

		await Promise.all([
			db
				.insertInto('users')
				.values({
					email: 'cursor1@example.com',
					name: 'Cursor Test 1',
					username: 'cursor1',
					password: 'password',
					followersCount: 0,
					createdAt: toSqliteDate(dates[0]),
					updatedAt: toSqliteDate(new Date()),
				})
				.execute(),

			db
				.insertInto('users')
				.values({
					email: 'cursor2@example.com',
					name: 'Cursor Test 2',
					username: 'cursor2',
					password: 'password',
					followersCount: 0,
					createdAt: toSqliteDate(dates[1]),
					updatedAt: toSqliteDate(new Date()),
				})
				.execute(),

			db
				.insertInto('users')
				.values({
					email: 'cursor3@example.com',
					name: 'Cursor Test 3',
					username: 'cursor3',
					password: 'password',
					followersCount: 0,
					createdAt: toSqliteDate(dates[2]),
					updatedAt: toSqliteDate(new Date()),
				})
				.execute(),
		]);

		// Get first page of results (2 items)
		const firstPage = await db
			.selectFrom('users')
			.where('email', 'like', 'cursor%')
			.orderBy('createdAt', 'desc')
			.orderBy('name', 'asc')
			.limit(2)
			.selectAll()
			.execute();

		expect(firstPage).toHaveLength(2);
		expect(firstPage[0].email).toBe('cursor3@example.com');
		expect(firstPage[1].email).toBe('cursor2@example.com');

		// Use cursor to get next page
		const cursor = firstPage[firstPage.length - 1].createdAt;

		const secondPage = await db
			.selectFrom('users')
			.where('email', 'like', 'cursor%')
			.where('createdAt', '<', cursor)
			.orderBy('createdAt', 'desc')
			.orderBy('name', 'asc')
			.limit(2)
			.selectAll()
			.execute();

		expect(secondPage).toHaveLength(1);
		expect(secondPage[0].email).toBe('cursor1@example.com');
	});

	it('should support one-to-many relationships', async () => {
		// Insert a test user
		const now = new Date();
		const userResult = await db
			.insertInto('users')
			.values({
				email: 'relation@example.com',
				name: 'Relation Test',
				username: 'relation',
				password: 'password',
				followersCount: 0,
				createdAt: toSqliteDate(now),
				updatedAt: toSqliteDate(now),
			})
			.returning('id')
			.executeTakeFirst();

		const userId = userResult.id;

		// Insert comments for this user
		await Promise.all([
			db
				.insertInto('comments')
				.values({
					userId,
					message: 'Test comment 1',
					createdAt: toSqliteDate(now),
					updatedAt: toSqliteDate(now),
				})
				.execute(),

			db
				.insertInto('comments')
				.values({
					userId,
					message: 'Test comment 2',
					createdAt: toSqliteDate(now),
					updatedAt: toSqliteDate(now),
				})
				.execute(),
		]);

		// Get comments for this user
		const comments = await db
			.selectFrom('comments')
			.where('userId', '=', userId)
			.selectAll()
			.execute();

		expect(comments).toHaveLength(2);
		expect(comments[0].message).toBe('Test comment 1');
		expect(comments[1].message).toBe('Test comment 2');

		// Get user with comments using a join
		const userWithComments = await db
			.selectFrom('users')
			.where('users.id', '=', userId)
			.leftJoin('comments', 'users.id', 'comments.userId')
			.select([
				'users.id as userId',
				'users.email',
				'comments.id as commentId',
				'comments.message',
			])
			.execute();

		expect(userWithComments).toHaveLength(2); // One row per comment
		expect(userWithComments[0].userId).toBe(userId);
		expect(userWithComments[0].email).toBe('relation@example.com');
		expect(userWithComments[0].commentId).toBeDefined();
		expect(userWithComments[0].message).toBe('Test comment 1');
		expect(userWithComments[1].message).toBe('Test comment 2');
	});

	it('should perform full CRUD cycle in a single test', async () => {
		// CREATE
		const now = new Date();
		const insertResult = await db
			.insertInto('users')
			.values({
				email: 'crud-test@example.com',
				name: 'CRUD Test',
				username: 'crud-test',
				password: 'password123',
				followersCount: 0,
				createdAt: toSqliteDate(now),
				updatedAt: toSqliteDate(now),
			})
			.returning('id')
			.executeTakeFirst();

		expect(insertResult).toBeDefined();
		const userId = insertResult.id;

		// READ
		const user = await db
			.selectFrom('users')
			.where('id', '=', userId)
			.selectAll()
			.executeTakeFirst();

		expect(user).toBeDefined();
		expect(user.email).toBe('crud-test@example.com');
		expect(user.name).toBe('CRUD Test');

		// UPDATE
		await db
			.updateTable('users')
			.set({
				name: 'Updated CRUD Test',
				updatedAt: toSqliteDate(new Date()),
			})
			.where('id', '=', userId)
			.execute();

		const updatedUser = await db
			.selectFrom('users')
			.where('id', '=', userId)
			.selectAll()
			.executeTakeFirst();

		expect(updatedUser).toBeDefined();
		expect(updatedUser.name).toBe('Updated CRUD Test');

		// DELETE
		await db.deleteFrom('users').where('id', '=', userId).execute();

		const deletedUser = await db
			.selectFrom('users')
			.where('id', '=', userId)
			.selectAll()
			.executeTakeFirst();

		expect(deletedUser).toBeUndefined();
	});
});
