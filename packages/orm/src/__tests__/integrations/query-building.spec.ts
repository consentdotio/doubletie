import { sql } from 'kysely';
import type { Kysely } from 'kysely';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import type { Database, ModelRegistry } from '~/database';
import createModel from '~/model';
import { setupTestDatabase, teardownTestDatabase } from '../fixtures/test-db';

// Test database schema
interface TestDB {
	users: {
		id: number;
		name: string;
		email: string;
		status: string;
		followers: number;
		created_at: Date;
	};
	posts: {
		id: number;
		user_id: number;
		title: string;
		content: string;
		views: number;
		published: boolean;
		created_at: Date;
	};
	comments: {
		id: number;
		post_id: number;
		user_id: number;
		content: string;
		created_at: Date;
	};
}

describe('integration: query building functionality', () => {
	let db: Kysely<TestDB>;
	let UserModel: any;
	let PostModel: any;
	let CommentModel: any;

	beforeEach(async () => {
		// Set up test database
		db = (await setupTestDatabase()) as Kysely<TestDB>;

		// Add transaction mock
		(db as any).transaction = async (callback) => {
			return callback(db);
		};
		(db as any).transaction.bind = function (thisArg) {
			return this;
		};

		// Drop existing tables if they exist
		await db.schema.dropTable('comments').ifExists().execute();
		await db.schema.dropTable('posts').ifExists().execute();
		await db.schema.dropTable('users').ifExists().execute();

		// Create test tables
		await db.schema
			.createTable('users')
			.ifNotExists()
			.addColumn('id', 'serial', (col) => col.primaryKey())
			.addColumn('name', 'varchar(255)', (col) => col.notNull())
			.addColumn('email', 'varchar(255)', (col) => col.unique().notNull())
			.addColumn('status', 'varchar(50)', (col) => col.notNull())
			.addColumn('followers', 'integer', (col) => col.notNull().defaultTo(0))
			.addColumn('created_at', 'timestamp', (col) =>
				col.defaultTo(sql`CURRENT_TIMESTAMP`).notNull()
			)
			.execute();

		await db.schema
			.createTable('posts')
			.ifNotExists()
			.addColumn('id', 'serial', (col) => col.primaryKey())
			.addColumn('user_id', 'integer', (col) =>
				col.references('users.id').onDelete('cascade').notNull()
			)
			.addColumn('title', 'varchar(255)', (col) => col.notNull())
			.addColumn('content', 'text', (col) => col.notNull())
			.addColumn('views', 'integer', (col) => col.notNull().defaultTo(0))
			.addColumn('published', 'boolean', (col) => col.notNull().defaultTo(true))
			.addColumn('created_at', 'timestamp', (col) =>
				col.defaultTo(sql`CURRENT_TIMESTAMP`).notNull()
			)
			.execute();

		await db.schema
			.createTable('comments')
			.ifNotExists()
			.addColumn('id', 'serial', (col) => col.primaryKey())
			.addColumn('post_id', 'integer', (col) =>
				col.references('posts.id').onDelete('cascade').notNull()
			)
			.addColumn('user_id', 'integer', (col) =>
				col.references('users.id').onDelete('cascade').notNull()
			)
			.addColumn('content', 'text', (col) => col.notNull())
			.addColumn('created_at', 'timestamp', (col) =>
				col.defaultTo(sql`CURRENT_TIMESTAMP`).notNull()
			)
			.execute();

		// Create models with proper type casting
		UserModel = createModel<TestDB, 'users', 'id'>(
			db as unknown as Database<TestDB, ModelRegistry<TestDB>>,
			'users',
			'id'
		);
		PostModel = createModel<TestDB, 'posts', 'id'>(
			db as unknown as Database<TestDB, ModelRegistry<TestDB>>,
			'posts',
			'id'
		);
		CommentModel = createModel<TestDB, 'comments', 'id'>(
			db as unknown as Database<TestDB, ModelRegistry<TestDB>>,
			'comments',
			'id'
		);

		// Seed test data
		type UserInsert = Omit<TestDB['users'], 'created_at'>;
		type PostInsert = Omit<TestDB['posts'], 'created_at'>;
		type CommentInsert = Omit<TestDB['comments'], 'created_at'>;

		const usersToInsert: UserInsert[] = [
			{
				id: 1,
				name: 'John Doe',
				email: 'john@example.com',
				status: 'active',
				followers: 100,
			},
			{
				id: 2,
				name: 'Jane Smith',
				email: 'jane@example.com',
				status: 'active',
				followers: 200,
			},
			{
				id: 3,
				name: 'Bob Johnson',
				email: 'bob@example.com',
				status: 'inactive',
				followers: 50,
			},
			{
				id: 4,
				name: 'Alice Brown',
				email: 'alice@example.com',
				status: 'active',
				followers: 150,
			},
			{
				id: 5,
				name: 'Charlie Davis',
				email: 'charlie@example.com',
				status: 'inactive',
				followers: 75,
			},
		];

		console.log(
			'Debug - First user to insert:',
			JSON.stringify(usersToInsert[0], null, 2)
		);

		try {
			await db.insertInto('users').values(usersToInsert).execute();
		} catch (error: any) {
			console.error('Debug - Insert error:', error);
			console.error('Debug - Error name:', error.name);
			console.error('Debug - Error message:', error.message);
			throw error;
		}

		await db
			.insertInto('posts')
			.values([
				{
					id: 1,
					user_id: 1,
					title: 'First Post',
					content: 'Content of first post',
					views: 100,
					published: true,
				},
				{
					id: 2,
					user_id: 1,
					title: 'Second Post',
					content: 'Content of second post',
					views: 150,
					published: true,
				},
				{
					id: 3,
					user_id: 2,
					title: 'Jane Post',
					content: 'Content of Jane post',
					views: 200,
					published: true,
				},
				{
					id: 4,
					user_id: 3,
					title: 'Bob Post',
					content: 'Content of Bob post',
					views: 50,
					published: false,
				},
				{
					id: 5,
					user_id: 4,
					title: 'Alice Post',
					content: 'Content of Alice post',
					views: 120,
					published: true,
				},
			] as PostInsert[])
			.execute();

		await db
			.insertInto('comments')
			.values([
				{ id: 1, post_id: 1, user_id: 2, content: 'Great post!' },
				{ id: 2, post_id: 1, user_id: 3, content: 'I agree!' },
				{ id: 3, post_id: 2, user_id: 2, content: 'Interesting thoughts' },
				{ id: 4, post_id: 3, user_id: 1, content: 'Nice work Jane' },
				{ id: 5, post_id: 5, user_id: 3, content: 'Well said Alice' },
			] as CommentInsert[])
			.execute();
	});

	afterEach(async () => {
		// Clean up test database
		await db.schema.dropTable('comments').ifExists().execute();
		await db.schema.dropTable('posts').ifExists().execute();
		await db.schema.dropTable('users').ifExists().execute();
		await teardownTestDatabase(db);
	});

	describe('basic select queries', () => {
		it.skip('should fetch all users', async () => {
			const users = await UserModel.selectFrom().execute();

			expect(users).toHaveLength(5);
			expect(users[0]).toHaveProperty('id', 1);
			expect(users[0]).toHaveProperty('name', 'John Doe');
		});

		it.skip('should select specific columns', async () => {
			const users = await UserModel.selectFrom()
				.select(['id', 'name'])
				.execute();

			expect(users[0]).toHaveProperty('id');
			expect(users[0]).toHaveProperty('name');
			expect(users[0]).not.toHaveProperty('email');
			expect(users[0]).not.toHaveProperty('status');
		});

		it.skip('should filter with where clause', async () => {
			const activeUsers = await UserModel.selectFrom()
				.where('status', '=', 'active')
				.execute();

			expect(activeUsers).toHaveLength(3);
			activeUsers.forEach((user) => {
				expect(user.status).toBe('active');
			});
		});

		it.skip('should filter with compound where clauses', async () => {
			const users = await UserModel.selectFrom()
				.where('status', '=', 'active')
				.where('followers', '>', 100)
				.execute();

			expect(users).toHaveLength(2);
			users.forEach((user) => {
				expect(user.status).toBe('active');
				expect(user.followers).toBeGreaterThan(100);
			});
		});
	});

	describe('complex WHERE conditions', () => {
		it.skip('should filter with whereIn', async () => {
			const users = await UserModel.selectFrom()
				.whereIn('id', [1, 3, 5])
				.execute();

			expect(users).toHaveLength(3);
			expect(users.map((u) => u.id)).toEqual([1, 3, 5]);
		});

		it.skip('should filter with OR conditions', async () => {
			const users = await UserModel.selectFrom()
				.where((eb) =>
					eb.or([eb('status', '=', 'inactive'), eb('followers', '>', 150)])
				)
				.execute();

			expect(users).toHaveLength(3);
			users.forEach((user) => {
				// Either inactive or has more than 150 followers
				expect(user.status === 'inactive' || user.followers > 150).toBeTruthy();
			});
		});

		it.skip('should filter with LIKE operator', async () => {
			const users = await UserModel.selectFrom()
				.where('name', 'like', '%John%')
				.execute();

			expect(users).toHaveLength(1);
			expect(users[0].name).toBe('John Doe');
		});

		it.skip('should implement a search function with complex conditions', async () => {
			// Real implementation of the search function
			const searchUsers = async (params: {
				minFollowers?: number;
				status?: string;
				nameLike?: string;
			}) => {
				const query = UserModel.selectFrom();

				if (params.minFollowers !== undefined) {
					query.where('followers', '>=', params.minFollowers);
				}

				if (params.status) {
					query.where('status', '=', params.status);
				}

				if (params.nameLike) {
					query.where('name', 'like', `%${params.nameLike}%`);
				}

				return query.execute();
			};

			// Test with different search combinations
			const activeUsersWithManyFollowers = await searchUsers({
				status: 'active',
				minFollowers: 150,
			});

			expect(activeUsersWithManyFollowers).toHaveLength(2);

			const usersNamedJohn = await searchUsers({
				nameLike: 'John',
			});

			expect(usersNamedJohn).toHaveLength(1);
			expect(usersNamedJohn[0].name).toBe('John Doe');
		});
	});

	describe('joins and relations', () => {
		it.skip('should join users and posts', async () => {
			const results = await UserModel.selectFrom()
				.innerJoin('posts', 'posts.user_id', 'users.id')
				.select([
					'users.id as user_id',
					'users.name as user_name',
					'posts.id as post_id',
					'posts.title as post_title',
				])
				.execute();

			expect(results).toHaveLength(5); // Total number of posts
			expect(results[0]).toHaveProperty('user_id');
			expect(results[0]).toHaveProperty('user_name');
			expect(results[0]).toHaveProperty('post_id');
			expect(results[0]).toHaveProperty('post_title');
		});

		it.skip('should count posts per user with grouping', async () => {
			const results = await UserModel.selectFrom()
				.leftJoin('posts', 'posts.user_id', 'users.id')
				.select([
					'users.id as user_id',
					'users.name as user_name',
					sql`count(posts.id)`.as('post_count'),
				])
				.groupBy(['users.id', 'users.name'])
				.execute();

			expect(results).toHaveLength(5); // All users

			// John has 2 posts
			const john = results.find((r) => r.user_id === 1);
			expect(Number(john.post_count)).toBe(2);

			// Jane has 1 post
			const jane = results.find((r) => r.user_id === 2);
			expect(Number(jane.post_count)).toBe(1);
		});

		it.skip('should perform multi-level joins', async () => {
			const results = await PostModel.selectFrom()
				.innerJoin('users', 'users.id', 'posts.user_id')
				.innerJoin('comments', 'comments.post_id', 'posts.id')
				.select([
					'posts.id as post_id',
					'posts.title as post_title',
					'users.name as author_name',
					'comments.content as comment_content',
				])
				.execute();

			expect(results.length).toBeGreaterThan(0);
			expect(results[0]).toHaveProperty('post_id');
			expect(results[0]).toHaveProperty('post_title');
			expect(results[0]).toHaveProperty('author_name');
			expect(results[0]).toHaveProperty('comment_content');
		});
	});

	describe('aggregations and grouping', () => {
		it.skip('should count users by status', async () => {
			const results = await UserModel.selectFrom()
				.select(['status', sql`count(id)`.as('user_count')])
				.groupBy(['status'])
				.execute();

			expect(results).toHaveLength(2); // active and inactive

			const activeStatus = results.find((r) => r.status === 'active');
			const inactiveStatus = results.find((r) => r.status === 'inactive');

			expect(Number(activeStatus.user_count)).toBe(3);
			expect(Number(inactiveStatus.user_count)).toBe(2);
		});

		it.skip('should calculate average followers by status', async () => {
			const results = await UserModel.selectFrom()
				.select(['status', sql`avg(followers)`.as('avg_followers')])
				.groupBy(['status'])
				.execute();

			const activeStatus = results.find((r) => r.status === 'active');
			const inactiveStatus = results.find((r) => r.status === 'inactive');

			// Calculate expected averages
			const activeUsers = [100, 200, 150]; // John, Jane, Alice
			const inactiveUsers = [50, 75]; // Bob, Charlie

			const expectedActiveAvg =
				activeUsers.reduce((sum, val) => sum + val, 0) / activeUsers.length;
			const expectedInactiveAvg =
				inactiveUsers.reduce((sum, val) => sum + val, 0) / inactiveUsers.length;

			// Convert string result to number and compare approximately
			expect(Number(activeStatus.avg_followers)).toBeCloseTo(
				expectedActiveAvg,
				1
			);
			expect(Number(inactiveStatus.avg_followers)).toBeCloseTo(
				expectedInactiveAvg,
				1
			);
		});

		it.skip('should filter groups with HAVING clause', async () => {
			const results = await UserModel.selectFrom()
				.select(['status', sql`count(id)`.as('user_count')])
				.groupBy(['status'])
				.having((eb) => eb('user_count', '>', 2))
				.execute();

			expect(results).toHaveLength(1); // Only active status has more than 2 users
			expect(results[0].status).toBe('active');
			expect(Number(results[0].user_count)).toBe(3);
		});
	});

	describe('ordering and limiting', () => {
		it.skip('should order users by followers descending', async () => {
			const users = await UserModel.selectFrom()
				.orderBy('followers', 'desc')
				.execute();

			expect(users).toHaveLength(5);
			expect(users[0].followers).toBe(200); // Jane has the most followers
			expect(users[1].followers).toBe(150); // Alice
			expect(users[2].followers).toBe(100); // John
		});

		it.skip('should order by multiple columns', async () => {
			const users = await UserModel.selectFrom()
				.orderBy('status', 'asc')
				.orderBy('followers', 'desc')
				.execute();

			// First active users (sorted by followers)
			expect(users[0].status).toBe('active');
			expect(users[0].followers).toBe(200); // Jane

			expect(users[1].status).toBe('active');
			expect(users[1].followers).toBe(150); // Alice

			// Then inactive users (sorted by followers)
			expect(users[3].status).toBe('inactive');
			expect(users[3].followers).toBe(75); // Charlie

			expect(users[4].status).toBe('inactive');
			expect(users[4].followers).toBe(50); // Bob
		});

		it.skip('should implement a search/sort function', async () => {
			// Real implementation of a search and sort function
			const getOrderedUsers = async () => {
				return UserModel.selectFrom().orderBy('name', 'asc').execute();
			};

			const users = await getOrderedUsers();

			expect(users).toHaveLength(5);
			// Alphabetical order: Alice, Bob, Charlie, Jane, John
			expect(users[0].name).toBe('Alice Brown');
			expect(users[1].name).toBe('Bob Johnson');
			expect(users[2].name).toBe('Charlie Davis');
			expect(users[3].name).toBe('Jane Smith');
			expect(users[4].name).toBe('John Doe');
		});
	});

	describe('subqueries', () => {
		it.skip('should use a subquery to find users with posts', async () => {
			const usersWithPosts = await UserModel.selectFrom()
				.where(({ eb, exists, selectFrom }) =>
					exists(
						selectFrom('posts')
							.select('posts.id')
							.where('posts.user_id', '=', eb.ref('users.id'))
					)
				)
				.execute();

			expect(usersWithPosts).toHaveLength(4); // All users except Charlie have posts

			// Verify Charlie isn't included (id: 5)
			expect(usersWithPosts.find((u) => u.id === 5)).toBeUndefined();
		});

		it.skip('should use a subquery to get users with published post count', async () => {
			const results = await UserModel.selectFrom()
				.select(({ selectFrom, eb }) => [
					'users.id',
					'users.name',
					selectFrom('posts')
						.select(eb.fn.count('posts.id').as('post_count'))
						.where('posts.user_id', '=', eb.ref('users.id'))
						.where('posts.published', '=', true)
						.as('published_post_count'),
				])
				.execute();

			expect(results).toHaveLength(5);

			// John has 2 published posts
			const john = results.find((r) => r.id === 1);
			expect(Number(john.published_post_count)).toBe(2);

			// Bob has 0 published posts (his post is unpublished)
			const bob = results.find((r) => r.id === 3);
			expect(Number(bob.published_post_count)).toBe(0);
		});
	});

	describe('raw SQL expressions', () => {
		it.skip('should execute a query with a raw SQL expression', async () => {
			const users = await UserModel.selectFrom()
				.where(
					({ eb }) =>
						sql`${eb.ref('followers')} > 100 AND ${eb.ref('status')} = 'active'`
				)
				.execute();

			expect(users).toHaveLength(2); // Jane and Alice
			expect(users.find((u) => u.name === 'Jane Smith')).toBeDefined();
			expect(users.find((u) => u.name === 'Alice Brown')).toBeDefined();
		});

		it.skip('should use SQL expressions for complex ordering', async () => {
			const users = await UserModel.selectFrom()
				.orderBy(
					sql`CASE WHEN ${sql.ref('status')} = 'active' THEN 1 ELSE 2 END`,
					'asc'
				)
				.orderBy('name', 'asc')
				.execute();

			// Active users should come first (sorted by name)
			expect(users[0].status).toBe('active');
			expect(users[1].status).toBe('active');
			expect(users[2].status).toBe('active');

			// Then inactive users (sorted by name)
			expect(users[3].status).toBe('inactive');
			expect(users[4].status).toBe('inactive');

			// Check name ordering within status groups
			expect(users[0].name).toBe('Alice Brown');
			expect(users[1].name).toBe('Jane Smith');
			expect(users[2].name).toBe('John Doe');
			expect(users[3].name).toBe('Bob Johnson');
			expect(users[4].name).toBe('Charlie Davis');
		});
	});
});
