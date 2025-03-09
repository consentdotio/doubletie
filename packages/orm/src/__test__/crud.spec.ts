import { beforeEach, describe, expect, it } from 'vitest';
import { db, resetDatabase, toSqliteDate } from './utils/migration';

describe('Basic CRUD Operations', () => {
	// Reset the database before each test
	beforeEach(async () => {
		await resetDatabase();
	});

	it('should handle basic CRUD operations', async () => {
		try {
			// Clean up from previous test runs
			await db.db
				.deleteFrom('users')
				.where('email', '=', 'crud-test@gmail.com')
				.execute()
				.catch(() => {
					// Ignore if table doesn't exist
				});

			// CREATE: Insert a user
			const now = new Date();
			const insertResult = await db.db
				.insertInto('users')
				.values({
					email: 'crud-test@gmail.com',
					name: 'CRUD Test',
					username: 'crud-test',
					password: 'password123',
					followersCount: 0,
					createdAt: toSqliteDate(now),
					updatedAt: toSqliteDate(now),
				} as any)
				.returning('id')
				.executeTakeFirst();

			expect(insertResult).toBeDefined();
			if (insertResult) {
				expect(insertResult.id).toBeDefined();
			}

			// READ: Find the user by email
			const user = await db.db
				.selectFrom('users')
				.where('email', '=', 'crud-test@gmail.com')
				.selectAll()
				.executeTakeFirst();

			expect(user).toBeDefined();
			if (user) {
				expect(user.email).toBe('crud-test@gmail.com');
				expect(user.name).toBe('CRUD Test');

				// UPDATE: Update the user's name
				await db.db
					.updateTable('users')
					.set({
						name: 'Updated CRUD Test',
						updatedAt: toSqliteDate(new Date()),
					} as any)
					.where('id', '=', user.id)
					.execute();

				// Verify the update worked
				const updatedUser = await db.db
					.selectFrom('users')
					.where('id', '=', user.id)
					.selectAll()
					.executeTakeFirst();

				expect(updatedUser).toBeDefined();
				if (updatedUser) {
					expect(updatedUser.name).toBe('Updated CRUD Test');
				}

				// DELETE: Delete the user
				await db.db.deleteFrom('users').where('id', '=', user.id).execute();

				// Verify the user was deleted
				const deletedUser = await db.db
					.selectFrom('users')
					.where('id', '=', user.id)
					.selectAll()
					.executeTakeFirst();

				expect(deletedUser).toBeUndefined();
			}
		} catch (error) {
			console.error('CRUD test error:', error);
			throw error;
		}
	});

	it('should create and read records', async () => {
		try {
			// Test creating a user
			const now = new Date();

			await db.db
				.insertInto('users')
				.values({
					email: 'create-test@gmail.com',
					name: 'Create Test',
					username: 'create-test',
					password: 'password',
					followersCount: 0,
					createdAt: toSqliteDate(now),
					updatedAt: toSqliteDate(now),
				} as any)
				.execute();

			// Test reading a user
			const user = await db.db
				.selectFrom('users')
				.where('email', '=', 'create-test@gmail.com')
				.selectAll()
				.executeTakeFirst();

			expect(user).toBeDefined();
			if (user) {
				expect(user.email).toBe('create-test@gmail.com');
				expect(user.name).toBe('Create Test');
			}
		} catch (error) {
			console.error('Create/read test error:', error);
			throw error;
		}
	});

	it('should update and delete records', async () => {
		try {
			// Test creating a user that we'll update and delete
			const now = new Date();

			await db.db
				.insertInto('users')
				.values({
					email: 'update-test@gmail.com',
					name: 'Update Test',
					username: 'update-test',
					password: 'password',
					followersCount: 0,
					createdAt: toSqliteDate(now),
					updatedAt: toSqliteDate(now),
				} as any)
				.execute();

			// Get the inserted user
			const user = await db.db
				.selectFrom('users')
				.where('email', '=', 'update-test@gmail.com')
				.selectAll()
				.executeTakeFirst();

			expect(user).toBeDefined();

			if (user) {
				// Test updating
				await db.db
					.updateTable('users')
					.set({
						name: 'Updated Name',
						followersCount: 10,
						updatedAt: toSqliteDate(new Date()),
					} as any)
					.where('id', '=', user.id)
					.execute();

				// Check update worked
				const updatedUser = await db.db
					.selectFrom('users')
					.where('id', '=', user.id)
					.selectAll()
					.executeTakeFirst();

				expect(updatedUser).toBeDefined();
				if (updatedUser) {
					expect(updatedUser.name).toBe('Updated Name');
					expect(updatedUser.followersCount).toBe(10);
				}

				// Test deleting
				await db.db.deleteFrom('users').where('id', '=', user.id).execute();

				// Verify delete worked
				const deleted = await db.db
					.selectFrom('users')
					.where('id', '=', user.id)
					.selectAll()
					.executeTakeFirst();

				expect(deleted).toBeUndefined();
			}
		} catch (error) {
			console.error('Update/delete test error:', error);
			throw error;
		}
	});

	it('should support cursor-based pagination', async () => {
		try {
			// Insert a user for cursor pagination test
			await db.db
				.insertInto('users')
				.values({
					email: 'cursor1@example.com',
					name: 'Cursor Test 1',
					username: 'cursor1',
					password: 'password',
					followersCount: 0,
					createdAt: toSqliteDate(new Date('2023-01-01')),
					updatedAt: toSqliteDate(new Date()),
				} as any)
				.execute();

			// Ensure test runs in isolation by waiting 1ms
			await new Promise((resolve) => setTimeout(resolve, 1));

			await db.db
				.insertInto('users')
				.values({
					email: 'cursor2@example.com',
					name: 'Cursor Test 2',
					username: 'cursor2',
					password: 'password',
					followersCount: 0,
					createdAt: toSqliteDate(new Date('2023-01-02')),
					updatedAt: toSqliteDate(new Date()),
				} as any)
				.execute();

			// Ensure test runs in isolation by waiting 1ms
			await new Promise((resolve) => setTimeout(resolve, 1));

			await db.db
				.insertInto('users')
				.values({
					email: 'cursor3@example.com',
					name: 'Cursor Test 3',
					username: 'cursor3',
					password: 'password',
					followersCount: 0,
					createdAt: toSqliteDate(new Date('2023-01-03')),
					updatedAt: toSqliteDate(new Date()),
				} as any)
				.execute();

			// Get first page of results (2 items)
			const firstPage = await db.db
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

			// Use cursor to get next page (should only return 1 item)
			const cursor = firstPage[firstPage.length - 1].createdAt;

			const secondPage = await db.db
				.selectFrom('users')
				.where('email', 'like', 'cursor%')
				.where('createdAt', '<', cursor) // Use cursor for pagination
				.orderBy('createdAt', 'desc')
				.orderBy('name', 'asc')
				.limit(2) // Even though we request 2, only 1 should be available
				.selectAll()
				.execute();

			// Correctly expect only 1 item in the second page
			expect(secondPage).toHaveLength(1);
			expect(secondPage[0].email).toBe('cursor1@example.com');
		} catch (error) {
			console.error('Pagination test error:', error);
			throw error;
		}
	});

	it('should support basic one-to-many relationships', async () => {
		try {
			// Insert a user for the relationship test
			await db.db
				.insertInto('users')
				.values({
					email: 'relation@example.com',
					name: 'Relation Test',
					username: 'relation',
					password: 'password',
					followersCount: 0,
					createdAt: toSqliteDate(new Date()),
					updatedAt: toSqliteDate(new Date()),
				} as any)
				.execute();

			// Get the user ID
			const user = await db.db
				.selectFrom('users')
				.where('email', '=', 'relation@example.com')
				.selectAll()
				.executeTakeFirst();

			expect(user).toBeDefined();

			if (user) {
				// Insert two comments for this user
				await db.db
					.insertInto('comments')
					.values({
						userId: user.id,
						message: 'Test comment 1',
						createdAt: toSqliteDate(new Date()),
						updatedAt: toSqliteDate(new Date()),
					} as any)
					.execute();

				await db.db
					.insertInto('comments')
					.values({
						userId: user.id,
						message: 'Test comment 2',
						createdAt: toSqliteDate(new Date()),
						updatedAt: toSqliteDate(new Date()),
					} as any)
					.execute();

				// Verify the comments were created
				const comments = await db.db
					.selectFrom('comments')
					.where('userId', '=', user.id)
					.selectAll()
					.execute();

				expect(comments).toHaveLength(2);

				// Test a join query to get user with comments
				const userWithComments = await db.db
					.selectFrom('users')
					.where('users.id', '=', user.id)
					.leftJoin('comments', 'users.id', 'comments.userId')
					.select([
						'users.id as userId',
						'users.email',
						'comments.id as commentId',
						'comments.message',
					])
					.execute();

				expect(userWithComments).toHaveLength(2);
				expect(userWithComments[0].userId).toBe(user.id);
				expect(userWithComments[0].email).toBe('relation@example.com');
				expect(userWithComments[0].commentId).toBeDefined();
				expect(userWithComments[0].message).toBeDefined();
			}
		} catch (error) {
			console.error('Relationship test error:', error);
			throw error;
		}
	});
	it('should update a single column using direct set method', async () => {
		// Create a test user first to ensure we have data
		await db
			.insertInto('users')
			.values({
				id: 9999,
				name: 'Test User',
				email: 'original@example.com',
				username: 'testuser27',
			} as any)
			.execute();

		// Test the new set('column', value) syntax
		await db
			.updateTable('users')
			.set('email', 'new.email@example.com')
			.where('id', '=', 9999)
			.execute();

		// Verify the update with a separate query
		const result = await db
			.selectFrom('users')
			.where('id', '=', 9999)
			.selectAll()
			.executeTakeFirst();

		expect(result?.email).toBe('new.email@example.com');
	});

	it('should update a column with model updateColumn method', async () => {
		// Create a test record with all required fields
		await db
			.insertInto('users')
			.values({
				id: 8888,
				name: 'Test User',
				email: 'test@example.com',
				username: 'testupdatecolumn',
			} as any)
			.execute();

		// Use the updateColumn method
		await db
			.updateColumn('users', 'email', 'updated@example.com')
			.where('id', '=', 8888)
			.execute();

		// Verify the update
		const updated = await db
			.selectFrom('users')
			.where('id', '=', 8888)
			.selectAll()
			.executeTakeFirst();

		expect(updated?.email).toBe('updated@example.com');
	});
});
