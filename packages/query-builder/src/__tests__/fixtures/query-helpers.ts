/**
 * Query mocking helpers for standardized test setups
 *
 * This file provides utilities for creating common query patterns
 * and mocking their behavior consistently across tests.
 */

import { vi } from 'vitest';
import type { MockFn } from './mock-db.js';

/**
 * Standard mock return values for common database operations
 */
export const standardMockReturnValues = {
	// Single record results
	user: { id: 1, name: 'Test User', email: 'test@example.com' },
	post: { id: 1, title: 'Test Post', content: 'Test content', user_id: 1 },
	comment: { id: 1, message: 'Test comment', user_id: 1, post_id: 1 },

	// Collection results
	users: [
		{ id: 1, name: 'User 1', email: 'user1@example.com' },
		{ id: 2, name: 'User 2', email: 'user2@example.com' },
	],
	posts: [
		{ id: 1, title: 'Post 1', content: 'Content 1', user_id: 1 },
		{ id: 2, title: 'Post 2', content: 'Content 2', user_id: 1 },
	],

	// Operation results
	insert: { id: 42 },
	update: { numUpdatedRows: BigInt(1) },
	delete: { numDeletedRows: BigInt(1) },

	// Error results
	notFound: null,
	error: new Error('Database error'),
};

/**
 * Creates a chain of mocks for select query operations
 */
export function createSelectQueryMock(returnValue: any = []) {
	return {
		selectFrom: vi.fn().mockReturnThis(),
		selectAll: vi.fn().mockReturnThis(),
		select: vi.fn().mockReturnThis(),
		where: vi.fn().mockReturnThis(),
		whereIn: vi.fn().mockReturnThis(),
		orderBy: vi.fn().mockReturnThis(),
		limit: vi.fn().mockReturnThis(),
		offset: vi.fn().mockReturnThis(),
		innerJoin: vi.fn().mockReturnThis(),
		leftJoin: vi.fn().mockReturnThis(),
		on: vi.fn().mockReturnThis(),
		execute: vi.fn().mockResolvedValue(returnValue),
		executeTakeFirst: vi
			.fn()
			.mockResolvedValue(
				Array.isArray(returnValue) && returnValue.length > 0
					? returnValue[0]
					: returnValue
			),
		$if: vi.fn().mockImplementation((condition, thenCallback) => {
			return thenCallback();
		}),
	};
}

/**
 * Creates a chain of mocks for insert query operations
 */
export function createInsertQueryMock(returnValue: any = { id: 1 }) {
	return {
		insertInto: vi.fn().mockReturnThis(),
		values: vi.fn().mockReturnThis(),
		returning: vi.fn().mockReturnThis(),
		execute: vi.fn().mockResolvedValue([returnValue]),
		executeTakeFirst: vi.fn().mockResolvedValue(returnValue),
	};
}

/**
 * Creates a chain of mocks for update query operations
 */
export function createUpdateQueryMock(numUpdated: number = 1) {
	return {
		updateTable: vi.fn().mockReturnThis(),
		set: vi.fn().mockReturnThis(),
		where: vi.fn().mockReturnThis(),
		whereIn: vi.fn().mockReturnThis(),
		returning: vi.fn().mockReturnThis(),
		execute: vi.fn().mockResolvedValue({ numUpdatedRows: BigInt(numUpdated) }),
		executeTakeFirst: vi
			.fn()
			.mockResolvedValue({ numUpdatedRows: BigInt(numUpdated) }),
	};
}

/**
 * Creates a chain of mocks for delete query operations
 */
export function createDeleteQueryMock(numDeleted: number = 1) {
	return {
		deleteFrom: vi.fn().mockReturnThis(),
		where: vi.fn().mockReturnThis(),
		whereIn: vi.fn().mockReturnThis(),
		execute: vi.fn().mockResolvedValue({ numDeletedRows: BigInt(numDeleted) }),
		executeTakeFirst: vi
			.fn()
			.mockResolvedValue({ numDeletedRows: BigInt(numDeleted) }),
	};
}

/**
 * Sets up a mock for a paginated query that returns both data and metadata
 */
export function createPaginationQueryMock(
	results: any[] = [],
	totalCount: number = 100,
	pageSize: number = 10
) {
	const mockChain = createSelectQueryMock(results);

	// Add count query result
	const mockCountChain = {
		...mockChain,
		executeTakeFirst: vi
			.fn()
			.mockResolvedValue({ count: totalCount.toString() }),
	};

	// Pagination metadata
	const paginationMeta = {
		total: totalCount,
		page: 1,
		pageSize,
		pageCount: Math.ceil(totalCount / pageSize),
		hasNextPage: totalCount > pageSize,
		hasPreviousPage: false,
	};

	return {
		mockChain,
		mockCountChain,
		paginationMeta,
		combinedResult: {
			data: results,
			meta: paginationMeta,
		},
	};
}

/**
 * Creates a mock for relational queries (joins)
 */
export function createRelationalQueryMock(
	mainData: any = { id: 1, name: 'Main' },
	relatedData: any[] = [{ id: 1, main_id: 1, name: 'Related' }]
) {
	return {
		selectFrom: vi.fn().mockReturnThis(),
		selectAll: vi.fn().mockReturnThis(),
		innerJoin: vi.fn().mockReturnThis(),
		leftJoin: vi.fn().mockReturnThis(),
		on: vi.fn().mockReturnThis(),
		where: vi.fn().mockReturnThis(),
		execute: vi.fn().mockResolvedValue([
			{
				...mainData,
				related: relatedData,
			},
		]),
		executeTakeFirst: vi.fn().mockResolvedValue({
			...mainData,
			related: relatedData,
		}),
	};
}

/**
 * Creates an expression builder mock for use in where callbacks
 */
export function createExpressionBuilderMock() {
	const eb = vi.fn((column, operator, value) => ({
		column,
		operator,
		value,
	})) as MockFn & {
		and: MockFn;
		or: MockFn;
		not: MockFn;
		between: MockFn;
		exists: MockFn;
		isNull: MockFn;
		isNotNull: MockFn;
		jsonPath: MockFn;
		jsonExtract: MockFn;
	};

	eb.and = vi.fn((conditions) => ({ and: conditions }));
	eb.or = vi.fn((conditions) => ({ or: conditions }));
	eb.not = vi.fn((condition) => ({ not: condition }));
	eb.between = vi.fn((column, from, to) => ({
		between: { column, from, to },
	}));
	eb.exists = vi.fn((subquery) => ({ exists: subquery }));
	eb.isNull = vi.fn((column) => ({ isNull: column }));
	eb.isNotNull = vi.fn((column) => ({ isNotNull: column }));
	eb.jsonPath = vi.fn((column, path) => ({ jsonPath: { column, path } }));
	eb.jsonExtract = vi.fn((column, path) => ({ jsonExtract: { column, path } }));

	return eb;
}

/**
 * Creates a batch update mock for updating multiple records
 */
export function createBatchUpdateMock(numUpdated: number = 5) {
	return {
		updateTable: vi.fn().mockReturnThis(),
		set: vi.fn().mockReturnThis(),
		whereIn: vi.fn().mockReturnThis(),
		execute: vi.fn().mockResolvedValue({ numUpdatedRows: BigInt(numUpdated) }),
	};
}

/**
 * Creates a transaction mock with common methods
 */
export function createTransactionMock(returnValue: any = null) {
	// Create a mock transaction object that can be passed to callbacks
	const mockTransaction = {
		selectFrom: vi.fn().mockReturnThis(),
		selectAll: vi.fn().mockReturnThis(),
		where: vi.fn().mockReturnThis(),
		executeTakeFirst: vi.fn().mockResolvedValue(returnValue),
		insertInto: vi.fn().mockReturnThis(),
		values: vi.fn().mockReturnThis(),
		returning: vi.fn().mockReturnThis(),
		updateTable: vi.fn().mockReturnThis(),
		set: vi.fn().mockReturnThis(),
		deleteFrom: vi.fn().mockReturnThis(),
		execute: vi.fn().mockResolvedValue([]),
	};

	// Create a mock transaction function that executes the callback with the transaction
	const mockTransactionFn = vi
		.fn()
		.mockImplementation(async (callback: (trx: any) => Promise<any>) => {
			return await callback(mockTransaction);
		});

	// Add bind method to support transaction.bind(db) pattern
	mockTransactionFn.bind = vi.fn(
		(thisArg: any) => (cb: (trx: any) => Promise<any>) => {
			return mockTransactionFn(cb);
		}
	);

	return {
		transaction: mockTransactionFn,
		mockTransaction,
	};
}
