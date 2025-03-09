/**
 * Mock database utilities for testing
 *
 * This file contains mock implementations of the Database class and related utilities
 * to simplify testing and provide type-compatible mocks for Kysely and the Database class.
 */

import {
	Kysely,
	OperandValueExpressionOrList,
	OrderByDirectionExpression,
	ReferenceExpression,
	SelectExpression,
	SelectQueryBuilder,
} from 'kysely';
import { vi } from 'vitest';
import type { MockInstance } from 'vitest';
import { Database } from '../../database';
import { ModelRegistry } from '../../database';

// Define helper types for mocks
export type MockFn = MockInstance;
export type MockReturnThis = MockFn & { mockReturnThis: () => MockReturnThis };

/**
 * Create a mock function that returns itself, useful for chainable method mocks
 */
export function createMockReturnThis(): MockReturnThis {
	const fn = vi.fn() as MockReturnThis;
	fn.mockReturnThis = () => fn;
	fn.mockReturnThis();
	return fn;
}

/**
 * Mock database interface that extends Kysely's types for testing
 * This provides better type safety and intellisense in tests
 */
export interface TestMockDatabase<TDatabase = any> {
	// Core query building methods
	selectFrom: MockReturnThis & {
		<TTable extends keyof TDatabase & string>(
			table: TTable
		): SelectQueryBuilder<TDatabase, TTable, {}>;
	};

	select: MockReturnThis & {
		<
			TTable extends keyof TDatabase & string,
			TSelectedFields extends SelectExpression<TDatabase, TTable>[],
		>(
			fields: TSelectedFields
		): any;
	};

	where: MockReturnThis & {
		<
			TTable extends keyof TDatabase & string,
			TColumn extends keyof TDatabase[TTable] & string,
		>(
			column: TColumn | string,
			operator: string,
			value: OperandValueExpressionOrList<TDatabase, TTable, TColumn>
		): any;
	};

	orderBy: MockReturnThis & {
		<TTable extends keyof TDatabase & string>(
			column: ReferenceExpression<TDatabase, TTable>,
			direction?: OrderByDirectionExpression
		): any;
	};

	limit: MockReturnThis & { (limit: number): any };
	offset: MockReturnThis & { (offset: number): any };
	execute: MockFn & { (): Promise<any[]> };
	executeTakeFirst: MockFn & { (): Promise<any> };

	// Additional mock methods as needed
	whereIn?: MockReturnThis;
	whereLike?: MockReturnThis;
	whereNotNull?: MockReturnThis;
	whereNull?: MockReturnThis;
	orWhere?: MockReturnThis;
	andWhere?: MockReturnThis;
	innerJoin?: MockReturnThis;
	leftJoin?: MockReturnThis;
	on?: MockReturnThis;
	groupBy?: MockReturnThis;
	having?: MockReturnThis;
	fn?: {
		count: MockFn;
		avg: MockFn;
		sum: MockFn;
	};
	$dynamic?: MockFn;
}

/**
 * Base interface for common query builder methods
 */
export interface MockQueryBuilder {
	selectFrom: MockReturnThis;
	select: MockReturnThis;
	where: MockReturnThis;
	execute: MockFn;
	executeTakeFirst: MockFn;
	// Optional common methods
	whereIn?: MockReturnThis;
	whereLike?: MockReturnThis;
	whereNotNull?: MockReturnThis;
	whereNull?: MockReturnThis;
	orWhere?: MockReturnThis;
	andWhere?: MockReturnThis;
	innerJoin?: MockReturnThis;
	leftJoin?: MockReturnThis;
	on?: MockReturnThis;
	orderBy?: MockReturnThis;
	groupBy?: MockReturnThis;
	having?: MockReturnThis;
	limit?: MockReturnThis;
	offset?: MockReturnThis;
	$dynamic?: MockFn;
	updateTable?: MockReturnThis;
	set?: MockReturnThis;
}

/**
 * A generic mock database class for testing
 *
 * This class provides a reusable implementation of a mock Database
 * that can be used with our ORM models in tests.
 */
export class MockDatabase<TDatabaseSchema = any> {
	// Required Database properties
	dialect: any = {};
	kysely: any = {};
	asyncLocalDb: any = { getStore: () => null };
	isolated = false;
	log?: any;
	debug?: boolean;

	// Query builder methods
	selectFrom: MockReturnThis;
	select: MockReturnThis;
	where: MockReturnThis;
	whereIn?: MockReturnThis;
	whereLike?: MockReturnThis;
	whereNotNull?: MockReturnThis;
	whereNull?: MockReturnThis;
	orWhere?: MockReturnThis;
	andWhere?: MockReturnThis;
	innerJoin?: MockReturnThis;
	leftJoin?: MockReturnThis;
	on?: MockReturnThis;
	orderBy?: MockReturnThis;
	groupBy?: MockReturnThis;
	having?: MockReturnThis;
	limit?: MockReturnThis;
	offset?: MockReturnThis;
	execute: MockFn;
	executeTakeFirst: MockFn;
	$dynamic?: MockFn;
	transaction: MockFn;

	// Additional properties
	fn?: {
		count: MockFn;
		avg: MockFn;
		sum: MockFn;
		// Add other function mocks as needed
	};

	constructor(
		options: Partial<MockQueryBuilder> & { transaction?: MockFn; fn?: any } = {}
	) {
		// Set up base query methods
		this.selectFrom = options.selectFrom || createMockReturnThis();
		this.select = options.select || createMockReturnThis();
		this.where = options.where || createMockReturnThis();
		this.execute = options.execute || vi.fn().mockResolvedValue([]);
		this.executeTakeFirst =
			options.executeTakeFirst || vi.fn().mockResolvedValue(null);
		this.transaction = options.transaction || vi.fn();

		// Copy any other methods if provided
		if (options.whereIn) this.whereIn = options.whereIn;
		if (options.whereLike) this.whereLike = options.whereLike;
		if (options.whereNotNull) this.whereNotNull = options.whereNotNull;
		if (options.whereNull) this.whereNull = options.whereNull;
		if (options.orWhere) this.orWhere = options.orWhere;
		if (options.andWhere) this.andWhere = options.andWhere;
		if (options.innerJoin) this.innerJoin = options.innerJoin;
		if (options.leftJoin) this.leftJoin = options.leftJoin;
		if (options.on) this.on = options.on;
		if (options.orderBy) this.orderBy = options.orderBy;
		if (options.groupBy) this.groupBy = options.groupBy;
		if (options.having) this.having = options.having;
		if (options.limit) this.limit = options.limit;
		if (options.offset) this.offset = options.offset;
		if (options.$dynamic) this.$dynamic = options.$dynamic;
		if (options.updateTable) (this as any).updateTable = options.updateTable;
		if (options.set) (this as any).set = options.set;

		// Set up function mocks if provided
		if (options.fn) {
			this.fn = options.fn;
		}
	}

	// Implement required getters/methods to match Database interface
	get dynamic() {
		return {
			$dynamic: this.$dynamic || vi.fn(),
			// Add other dynamic methods as needed
			ref: vi.fn(),
		};
	}

	get db() {
		// Return a mock Kysely instance
		return {
			// Minimal implementation to satisfy the type
			schema: {},
			// Add other properties as needed
		};
	}

	get isTransaction() {
		return false;
	}

	// Minimal implementation of standard Database methods
	isSqlite() {
		return false;
	}

	isMysql() {
		return false;
	}

	isPostgres() {
		return true;
	}

	model() {
		return {};
	}

	destroy() {
		return Promise.resolve();
	}
}

/**
 * Create a fully mocked Database instance for testing
 *
 * @param options Additional mock configuration
 * @returns A mocked Database instance that can be passed to createModel
 */
export function createMockDatabase<TDatabaseSchema = any>(
	options: Partial<MockQueryBuilder> & {
		transaction?: MockFn;
		fn?: any;
		isTransaction?: boolean;
	} = {}
): TestMockDatabase<TDatabaseSchema> &
	Database<TDatabaseSchema, ModelRegistry<TDatabaseSchema>> {
	const mockDb = new MockDatabase<TDatabaseSchema>(options);

	// Set up any additional mocks or configuration

	// Return with type assertion to make TypeScript happy
	return mockDb as unknown as TestMockDatabase<TDatabaseSchema> &
		Database<TDatabaseSchema, ModelRegistry<TDatabaseSchema>>;
}

/**
 * Create a mock implementation of the transaction method that properly handles callbacks
 *
 * @param executeTakeFirst Mock for executeTakeFirst to use in transaction context
 * @returns A mock transaction function
 */
export function createMockTransaction(
	executeTakeFirst: MockFn = vi.fn()
): MockFn {
	return vi.fn().mockReturnValue({
		execute: vi.fn().mockImplementation(async (callback: any) => {
			// Create a mock transaction database
			const trxDb = createMockDatabase({
				selectFrom: createMockReturnThis(),
				where: createMockReturnThis(),
				executeTakeFirst,
				updateTable: createMockReturnThis(),
				set: createMockReturnThis(),
				isTransaction: true,
			});

			// Call the callback with the transaction database
			return callback(trxDb);
		}),
	});
}

/**
 * Create a mock Database that will throw an error during transaction execution
 *
 * @param errorMessage The error message to throw
 * @returns A mock Database that will throw during transaction
 */
export function createErrorMockDatabase(
	errorMessage = 'Transaction error'
): Database<any> {
	return createMockDatabase({
		transaction: vi.fn().mockReturnValue({
			execute: vi.fn().mockImplementation(() => {
				throw new Error(errorMessage);
			}),
		}),
	}) as unknown as Database<any>;
}
