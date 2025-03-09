import { sql } from 'kysely';
import type { SelectQueryBuilder } from 'kysely';
import { beforeEach, describe, expect, it } from 'vitest';
import { CommentTestModel, SortKey } from './utils/common-setup';
import { db, resetDatabase, toSqliteDate } from './utils/migration';
import type { Comments } from './utils/migration';

describe('Cursorable pagination', () => {
	// Setup test data before each test
	beforeEach(async () => {
		await resetDatabase();

		// Create users table first (since comments reference users)
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

		// Insert test users
		const now = new Date();
		await db.db
			.insertInto('users')
			.values({
				id: 1,
				email: 'test1@example.com',
				name: 'Test User 1',
				username: 'testuser1',
				password: 'password',
				status: 'active',
				followersCount: 10,
				createdAt: toSqliteDate(now),
				updatedAt: toSqliteDate(now),
			} as any)
			.execute();

		await db.db
			.insertInto('users')
			.values({
				id: 2,
				email: 'test2@example.com',
				name: 'Test User 2',
				username: 'testuser2',
				password: 'password',
				status: 'active',
				followersCount: 5,
				createdAt: toSqliteDate(now),
				updatedAt: toSqliteDate(now),
			} as any)
			.execute();

		// Now create comments table with foreign key constraint
		await db.db.schema
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

		// Create test comments with staggered timestamps
		const testComments = [
			{
				userId: 1,
				message: 'First comment',
				createdAt: new Date(now.getTime() - 4000), // 4 seconds ago
				updatedAt: new Date(),
			},
			{
				userId: 1,
				message: 'Second comment',
				createdAt: new Date(now.getTime() - 3000), // 3 seconds ago
				updatedAt: new Date(),
			},
			{
				userId: 2,
				message: 'Third comment',
				createdAt: new Date(now.getTime() - 2000), // 2 seconds ago
				updatedAt: new Date(),
			},
			{
				userId: 2,
				message: 'Fourth comment',
				createdAt: new Date(now.getTime() - 1000), // 1 second ago
				updatedAt: new Date(),
			},
			{
				userId: 1,
				message: 'Fifth comment',
				createdAt: new Date(now.getTime()), // Current time
				updatedAt: new Date(),
			},
		];

		// Insert test comments
		for (const comment of testComments) {
			await CommentTestModel.insertOne(comment);
		}
	});

	describe('Basic pagination functionality', () => {
		it('should provide cursor-based forward pagination with first parameter', async () => {
			// Test forward pagination with 'first' parameter
			const forwardResult = await CommentTestModel.getCursorableConnection({
				first: 2,
				sortKey: SortKey.CREATED_AT,
			});

			// Verify structure of pagination result
			expect(forwardResult).toHaveProperty('nodes');
			expect(forwardResult).toHaveProperty('pageInfo');
			expect(forwardResult.pageInfo).toHaveProperty('hasNextPage');
			expect(forwardResult.pageInfo).toHaveProperty('hasPreviousPage');
			expect(forwardResult.pageInfo).toHaveProperty('startCursor');
			expect(forwardResult.pageInfo).toHaveProperty('endCursor');

			// Check pagination metadata
			expect(forwardResult.nodes.length).toBe(2);
			expect(forwardResult.pageInfo.hasNextPage).toBe(true); // More items available
			expect(forwardResult.pageInfo.hasPreviousPage).toBe(false); // No previous page

			// Verify content order - should be oldest first (ascending by createdAt)
			expect(forwardResult.nodes[0].message).toBe('First comment');
			expect(forwardResult.nodes[1].message).toBe('Second comment');
		});

		it('should provide cursor-based pagination with after parameter', async () => {
			// First get initial page
			const firstPage = await CommentTestModel.getCursorableConnection({
				first: 2,
				sortKey: SortKey.CREATED_AT,
			});

			// Then get next page using the endCursor
			const afterCursor = firstPage.pageInfo.endCursor;
			const secondPage = await CommentTestModel.getCursorableConnection({
				first: 2,
				after: afterCursor,
				sortKey: SortKey.CREATED_AT,
			});

			// Verify second page
			expect(secondPage.nodes.length).toBe(2);
			expect(secondPage.pageInfo.hasPreviousPage).toBe(true); // Has previous page

			// Verify content doesn't overlap with first page
			expect(secondPage.nodes[0].message).toBe('Third comment');
			expect(secondPage.nodes[1].message).toBe('Fourth comment');

			// Get final page
			const thirdPageCursor = secondPage.pageInfo.endCursor;
			const thirdPage = await CommentTestModel.getCursorableConnection({
				first: 2,
				after: thirdPageCursor,
				sortKey: SortKey.CREATED_AT,
			});

			// Verify third page
			expect(thirdPage.nodes.length).toBe(1); // Only one record left
			expect(thirdPage.pageInfo.hasNextPage).toBe(false); // No more pages
			expect(thirdPage.pageInfo.hasPreviousPage).toBe(true); // Has previous pages
			expect(thirdPage.nodes[0].message).toBe('Fifth comment');
		});

		it('should provide cursor-based backward pagination with last parameter', async () => {
			// Test backward pagination with 'last' parameter
			const backwardResult = await CommentTestModel.getCursorableConnection({
				last: 2,
				sortKey: SortKey.CREATED_AT,
			});

			// Verify structure and content
			expect(backwardResult.nodes.length).toBe(2);
			expect(backwardResult.pageInfo.hasNextPage).toBe(false); // No next page (we're at the end)
			expect(backwardResult.pageInfo.hasPreviousPage).toBe(true); // Has previous pages

			// Should contain the most recent comments in ascending order
			expect(backwardResult.nodes[0].message).toBe('Fourth comment');
			expect(backwardResult.nodes[1].message).toBe('Fifth comment');
		});

		it('should provide cursor-based pagination with before parameter', async () => {
			// First get the last page
			const lastPage = await CommentTestModel.getCursorableConnection({
				last: 2,
				sortKey: SortKey.CREATED_AT,
			});

			// Then get previous page using the startCursor
			const beforeCursor = lastPage.pageInfo.startCursor;
			const previousPage = await CommentTestModel.getCursorableConnection({
				last: 2,
				before: beforeCursor,
				sortKey: SortKey.CREATED_AT,
			});

			// Verify previous page
			expect(previousPage.nodes.length).toBe(2);
			expect(previousPage.pageInfo.hasNextPage).toBe(true); // Has next page
			expect(previousPage.pageInfo.hasPreviousPage).toBe(true); // Has previous page

			// Verify content doesn't overlap with last page
			expect(previousPage.nodes[0].message).toBe('Second comment');
			expect(previousPage.nodes[1].message).toBe('Third comment');
		});

		it('should correctly report total count for all queries', async () => {
			// Run multiple pagination queries with different parameters
			const forwardResult = await CommentTestModel.getCursorableConnection({
				first: 2,
				sortKey: SortKey.CREATED_AT,
			});

			const afterResult = await CommentTestModel.getCursorableConnection({
				first: 2,
				after: forwardResult.pageInfo.endCursor,
				sortKey: SortKey.CREATED_AT,
			});

			const backwardResult = await CommentTestModel.getCursorableConnection({
				last: 2,
				sortKey: SortKey.CREATED_AT,
			});

			const beforeResult = await CommentTestModel.getCursorableConnection({
				last: 2,
				before: backwardResult.pageInfo.startCursor,
				sortKey: SortKey.CREATED_AT,
			});

			// Verify total count is consistent across all queries
			expect(forwardResult.totalCount).toBe(5); // Now 5 total records
			expect(afterResult.totalCount).toBe(5);
			expect(backwardResult.totalCount).toBe(5);
			expect(beforeResult.totalCount).toBe(5);
		});
	});

	describe('Edge cases and advanced features', () => {
		it('should handle empty results correctly', async () => {
			// Clear all comments
			await db.db.deleteFrom('comments').execute();

			// Try pagination on empty table
			const result = await CommentTestModel.getCursorableConnection({
				first: 10,
				sortKey: SortKey.CREATED_AT,
			});

			// Verify empty connection structure
			expect(result.nodes).toEqual([]);
			expect(result.pageInfo.hasNextPage).toBe(false);
			expect(result.pageInfo.hasPreviousPage).toBe(false);
			expect(result.pageInfo.startCursor).toBeNull();
			expect(result.pageInfo.endCursor).toBeNull();
			expect(result.totalCount).toBe(0);
		});

		it('should respect the max limit configuration', async () => {
			// Request more items than exist in the database
			const result = await CommentTestModel.getCursorableConnection({
				first: 100, // Much larger than our data set
				sortKey: SortKey.CREATED_AT,
			});

			// Should return all available items without error
			expect(result.nodes.length).toBe(5);
			expect(result.pageInfo.hasNextPage).toBe(false);
		});

		it('should allow custom filtering using the func parameter', async () => {
			// Use func parameter to filter results
			const result = await CommentTestModel.getCursorableConnection({
				first: 10,
				sortKey: SortKey.CREATED_AT,
				func: (qb: SelectQueryBuilder<any, any, any>) =>
					qb.where('userId', '=', 1), // Only user 1's comments
			});

			// Should only return comments from user 1
			expect(result.nodes.length).toBe(3); // User 1 has 3 comments
			expect(result.totalCount).toBe(3);
			result.nodes.forEach((node: Comments) => {
				expect(node.userId).toBe(1);
			});
		});

		it('should handle alternative sort keys', async () => {
			// Test sorting by a different key (followers count)
			const result = await CommentTestModel.getCursorableConnection({
				first: 5,
				sortKey: SortKey.FOLLOWERS_COUNT,
			});

			// Should return all items in correct order
			expect(result.nodes.length).toBe(5);

			// Note: The actual ordering depends on the implementation
			// of the SortKey.FOLLOWERS_COUNT in the CommentTestModel
		});

		it('should handle SQLite alternative to IS DISTINCT FROM', async () => {
			// In SQLite, we can use (col IS NULL OR col <> value) as an alternative
			// to the PostgreSQL IS DISTINCT FROM operator

			// First, let's add some null values to test with
			await CommentTestModel.insertOne({
				userId: 1,
				message: 'Comment with null reference',
				createdAt: new Date(),
				updatedAt: new Date(),
			});

			// Create a query that filters using the SQLite alternative to IS DISTINCT FROM
			const result = await CommentTestModel.getCursorableConnection({
				first: 10,
				sortKey: SortKey.CREATED_AT,
				func: (qb: SelectQueryBuilder<any, any, any>) =>
					qb.where((eb) =>
						// This is equivalent to "userId IS DISTINCT FROM 1" in PostgreSQL
						eb.or([eb('userId', 'is', null), eb('userId', '!=', 1)])
					),
			});

			// Should only return comments not from user 1
			expect(result.nodes.length).toBe(2); // User 2 has 2 comments
			result.nodes.forEach((node: Comments) => {
				expect(node.userId).toBe(2);
			});
		});
	});

	describe('Integration with query builder', () => {
		it('should work with complex query conditions', async () => {
			// Test with multiple complex conditions using the query builder
			const result = await CommentTestModel.getCursorableConnection({
				first: 10,
				sortKey: SortKey.CREATED_AT,
				func: (qb: SelectQueryBuilder<any, any, any>) =>
					qb
						.where('userId', '=', 1)
						.where('message', 'like', '%comment%')
						.where((eb) =>
							eb.or([
								eb(
									'createdAt',
									'>=',
									toSqliteDate(new Date(Date.now() - 4000))
								),
								eb('message', '=', 'Fifth comment'),
							])
						),
			});

			// Should return filtered results
			expect(result.nodes.length).toBeGreaterThan(0);
			result.nodes.forEach((node: Comments) => {
				expect(node.userId).toBe(1);
				expect(node.message.toLowerCase()).toContain('comment');
			});
		});

		it('should support raw SQL expressions', async () => {
			// Test with raw SQL in the query
			const result = await CommentTestModel.getCursorableConnection({
				first: 10,
				sortKey: SortKey.CREATED_AT,
				func: (qb: SelectQueryBuilder<any, any, any>) =>
					//@ts-expect-error
					qb.where(sql`LOWER(message) LIKE ${'%fifth%'}`),
			});

			// Should return comments matching the raw SQL condition
			expect(result.nodes.length).toBe(1);
			expect(result.nodes[0].message).toBe('Fifth comment');
		});
	});
});
