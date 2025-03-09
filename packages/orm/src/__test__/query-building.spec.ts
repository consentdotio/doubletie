import { sql } from 'kysely';
import { beforeEach, describe, expect, it } from 'vitest';
import {
	MixinUserModel,
	db,
	resetDatabase,
	toSqliteDate,
} from './utils/common-setup';

describe('Query Building', () => {
	// Reset the database before each test
	beforeEach(async () => {
		await resetDatabase();

		// Insert test users for query tests
		await db.db.schema
			.createTable('users')
			.ifNotExists()
			.addColumn('id', 'integer', (col) => col.primaryKey().autoIncrement())
			.addColumn('email', 'text', (col) => col.unique().notNull())
			.addColumn('name', 'text', (col) => col.notNull())
			.addColumn('username', 'text', (col) => col.notNull())
			.addColumn('password', 'text', (col) => col.notNull())
			.addColumn('status', 'text', (col) => col.notNull())
			.addColumn('followersCount', 'integer', (col) => col.defaultTo(0))
			.addColumn('createdAt', 'text')
			.addColumn('updatedAt', 'text')
			.execute();

		// Insert test users with various properties
		const now = new Date();
		const testUsers = [
			{
				email: 'test1@example.com',
				name: 'Test User 1',
				username: 'testuser1',
				password: 'password',
				status: 'active',
				followersCount: 10,
				createdAt: toSqliteDate(
					new Date(now.getTime() - 3 * 24 * 60 * 60 * 1000)
				), // 3 days ago
				updatedAt: toSqliteDate(now),
			},
			{
				email: 'test2@example.com',
				name: 'Test User 2',
				username: 'testuser2',
				password: 'password',
				status: 'inactive',
				followersCount: 5,
				createdAt: toSqliteDate(
					new Date(now.getTime() - 2 * 24 * 60 * 60 * 1000)
				), // 2 days ago
				updatedAt: toSqliteDate(now),
			},
			{
				email: 'test3@example.com',
				name: 'Another Test User',
				username: 'testuser3',
				password: 'password',
				status: 'pending',
				followersCount: 15,
				createdAt: toSqliteDate(
					new Date(now.getTime() - 1 * 24 * 60 * 60 * 1000)
				), // 1 day ago
				updatedAt: toSqliteDate(now),
			},
		];

		// Insert test users
		for (const user of testUsers) {
			await db.db
				.insertInto('users')
				.values(user as any)
				.execute();
		}

		// Create comments table for subquery test
		await db.db.schema
			.createTable('comments')
			.ifNotExists()
			.addColumn('id', 'integer', (col) => col.primaryKey().autoIncrement())
			.addColumn('userId', 'integer', (col) => col.notNull())
			.addColumn('message', 'text', (col) => col.notNull())
			.addColumn('createdAt', 'text')
			.addColumn('updatedAt', 'text')
			.execute();

		// Insert test comments
		await db.db
			.insertInto('comments')
			.values({
				userId: 1,
				message: 'Test comment 1',
				createdAt: toSqliteDate(now),
				updatedAt: toSqliteDate(now),
			} as any)
			.execute();

		await db.db
			.insertInto('comments')
			.values({
				userId: 2,
				message: 'Test comment 2',
				createdAt: toSqliteDate(now),
				updatedAt: toSqliteDate(now),
			} as any)
			.execute();
	});

	it('should build complex queries with multiple conditions', async () => {
		// Create a complex search function that builds a query with real execution
		const searchUsers = async (searchTerm: string, limit = 10) => {
			let query = MixinUserModel.selectFrom().selectAll();

			// Use individual where clauses instead of the object-based and condition
			if (searchTerm) {
				query = query.where('name', 'like', `%${searchTerm}%`);
				query = query.where('followersCount', '>', 5);
				query = query.where('status', 'in', ['active', 'pending']);
				query = query.where('email', 'is not', null);
			}

			// Convert dates to strings because the database stores them as strings
			const startDate = new Date();
			startDate.setMonth(startDate.getMonth() - 1); // One month ago
			const startDateStr = toSqliteDate(startDate);

			const endDate = new Date();
			const endDateStr = toSqliteDate(endDate);

			// Use between operator for date range
			query = query.where('createdAt', '>=', startDateStr);
			query = query.where('createdAt', '<=', endDateStr);

			return query
				.orderBy('createdAt', 'desc')
				.limit(limit)
				.offset(0)
				.execute();
		};

		// Execute the search function with real database access
		const results = await searchUsers('Test');

		// Verify that the query works and returns expected results
		expect(Array.isArray(results)).toBe(true);
		// Should find users with "Test" in name and followers > 5
		expect(results.length).toBeGreaterThan(0);

		// Check specific properties of returned users
		for (const user of results) {
			expect(user.name).toMatch(/Test/); // Name contains "Test"
			expect(user.followersCount).toBeGreaterThan(5); // Followers > 5
			expect(['active', 'pending']).toContain(user.status); // Status is active or pending
			expect(user.email).not.toBeNull(); // Email is not null
		}
	});

	it('should support subqueries and joins', async () => {
		// Create a subquery for users who have comments
		const userIdsWithComments = db.db
			.selectFrom('comments')
			.select('userId')
			.distinct();

		// Execute a real query with the subquery
		const usersWithComments = await db.db
			.selectFrom('users')
			.where((eb) =>
				eb.exists(
					eb
						.selectFrom('comments')
						.whereRef('comments.userId', '=', 'users.id')
						.select('comments.id')
				)
			)
			.selectAll()
			.execute();

		// Verify the results are as expected
		expect(Array.isArray(usersWithComments)).toBe(true);
		expect(usersWithComments.length).toBeGreaterThan(0);

		// The users returned should be those with IDs 1 and 2
		const userIds = usersWithComments.map((user) => user.id);
		expect(userIds).toContain(1);
		expect(userIds).toContain(2);

		// Verify we can also perform a direct join query
		const usersWithCommentsViaJoin = await db.db
			.selectFrom('users')
			.innerJoin('comments', 'users.id', 'comments.userId')
			.select(['users.id as userId', 'users.name', 'comments.message'])
			.execute();

		// Verify the join results
		expect(Array.isArray(usersWithCommentsViaJoin)).toBe(true);
		expect(usersWithCommentsViaJoin.length).toBeGreaterThan(0);

		// Each result should have both user and comment information
		for (const result of usersWithCommentsViaJoin) {
			expect(result).toHaveProperty('userId');
			expect(result).toHaveProperty('name');
			expect(result).toHaveProperty('message');
		}
	});

	it('should maintain type safety with various query builders', async () => {
		// This test doesn't actually execute queries, it just verifies type safety
		const typeSafeQuery = MixinUserModel.selectFrom()
			.select(['id', 'name', 'email'])
			.where('id', '=', 1)
			.orderBy('name', 'asc')
			.limit(10);

		// Verify the query can be executed
		expect(typeSafeQuery.execute).toBeDefined();
	});

	it('should support selecting constants and expressions', async () => {
		// Use selectNoFrom to get constants and expressions
		const result = await db.selectNoFrom().execute();

		// Verify the result contains the expected fields
		expect(result[0].one).toBe(1);
		expect(result[0].constantText).toBe('test');
		expect(typeof result[0].currentDate).toBe('string');
	});

	it('should support ordering by multiple columns', async () => {
		// Create a function to get users ordered by multiple columns
		const getOrderedUsers = async () => {
			return db.db
				.selectFrom('users')
				.selectAll()
				.orderBy('followersCount', 'desc') // First order by followers count descending
				.orderBy('name', 'asc') // Then by name ascending
				.limit(10)
				.execute();
		};

		// Get the ordered users
		const users = await getOrderedUsers();

		// Verify the result is an array
		expect(Array.isArray(users)).toBe(true);

		// If we have more than one user, verify the ordering
		if (users.length > 1) {
			// Check that users are ordered correctly
			for (let i = 0; i < users.length - 1; i++) {
				const current = users[i];
				const next = users[i + 1];

				// Either the current user has more followers
				// OR they have the same number of followers and the current user's name comes before the next user's name
				expect(
					current.followersCount > next.followersCount ||
						(current.followersCount === next.followersCount &&
							current.name <= next.name)
				).toBe(true);
			}
		}
	});

	it('should support the cast functionality', async () => {
		// Get a user with a string ID and cast it to an integer using sql tag
		const userId = 1;
		const result = await db.db
			.selectFrom('users')
			.select([
				'id',
				'name',
				sql<number>`CAST(${userId} AS INTEGER)`.as('castedId'),
			])
			.where('id', '=', userId)
			.executeTakeFirst();

		// Verify the cast worked correctly
		expect(result).not.toBeNull();
		expect(result?.castedId).toBe(1);
		// The type should be number, not string
		expect(typeof result?.castedId).toBe('number');
	});
});
