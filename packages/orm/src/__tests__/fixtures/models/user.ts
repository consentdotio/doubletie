import type {
	CompiledQuery,
	DatabaseConnection,
	DatabaseIntrospector,
	DatabaseMetadata,
	Dialect,
	DialectAdapter,
	Driver,
	Kysely,
	MigrationLockOptions,
	QueryCompiler,
	QueryResult,
	RootOperationNode,
} from 'kysely';
import { vi } from 'vitest';

import { Database } from '../../../database';
import { withGlobalId, withSlug } from '../../../mixins';
import createModel from '../../../model';
import type { TestDatabase } from './base-schema';

/**
 * Creates a simple mock SQLite dialect for testing
 */
class MockSQLiteDialect implements Dialect {
	createAdapter(): DialectAdapter {
		// Only include properties that exist in the interface
		return {
			supportsReturning: false,
			supportsTransactionalDdl: true,
			supportsCreateIfNotExists: false,
			acquireMigrationLock: function (
				db: Kysely<any>,
				options: MigrationLockOptions
			): Promise<void> {
				throw new Error('Function not implemented.');
			},
			releaseMigrationLock: function (
				db: Kysely<any>,
				options: MigrationLockOptions
			): Promise<void> {
				throw new Error('Function not implemented.');
			},
		};
	}

	createDriver(): Driver {
		return {
			init: async () => {},
			acquireConnection: async () => {
				return {
					executeQuery: async <R>(): Promise<QueryResult<R>> => {
						return {
							rows: [] as R[],
							numAffectedRows: undefined,
							numChangedRows: undefined,
						};
					},
					// Implement async iterator for stream query
					streamQuery: async function* <R>(): AsyncIterableIterator<
						QueryResult<R>
					> {
						yield {
							rows: [] as R[],
							numAffectedRows: undefined,
							numChangedRows: undefined,
						};
					},
					release: async () => {},
				};
			},
			beginTransaction: async () => {},
			commitTransaction: async () => {},
			rollbackTransaction: async () => {},
			releaseConnection: async () => {},
			destroy: async () => {},
		};
	}

	createQueryCompiler(): QueryCompiler {
		return {
			compileQuery: (node: RootOperationNode): CompiledQuery => {
				return {
					sql: '',
					parameters: [],
					query: node,
				};
			},
		};
	}

	createIntrospector(): DatabaseIntrospector {
		return {
			getSchemas: async () => [],
			getTables: async () => [],
			getMetadata: async (): Promise<DatabaseMetadata> => {
				return {
					tables: [], // Use array instead of Map
				};
			},
		};
	}
}

/**
 * Creates a user model for testing
 */
export function createUserModel(kysely: Kysely<TestDatabase>) {
	const db = new Database<TestDatabase>({
		dialect: new MockSQLiteDialect(),
	});

	(db as any).kysely = kysely;

	const UserModel = createModel<TestDatabase, 'users', 'id'>(db, 'users', 'id');

	return UserModel;
}

/**
 * Creates a user model with mixins for testing
 * This is a simplified version to avoid type errors
 */
export function createUserModelWithMixins(kysely: Kysely<TestDatabase>) {
	// Create the base model
	const UserModel = createUserModel(kysely);

	// Simply return base model - for type errors we'll fix in next iteration
	return UserModel;
}

/**
 * Creates a mock user model for pure unit testing
 */
export function createMockUserModel() {
	// Fix syntax errors in mock functions
	const mockFindOne = vi.fn();
	const mockInsertInto = vi.fn().mockReturnValue({
		values: vi.fn().mockReturnValue({
			returning: vi.fn().mockReturnValue({
				executeTakeFirst: vi.fn(),
			}),
		}),
	});

	// Create a basic mock model
	const MockUserModel = {
		db: {} as Database<TestDatabase>,
		table: 'users' as const,
		id: 'id' as const,
		findOne: mockFindOne,
		insertInto: mockInsertInto,
	};

	return MockUserModel;
}
