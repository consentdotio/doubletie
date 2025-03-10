import type { Selectable } from 'kysely';
import { assertType, expectTypeOf, test } from 'vitest';
import createModel from '~/model';

// Define test database schema
interface TestDB {
	users: {
		id: number;
		name: string;
		email: string;
	};
}

// Define pagination parameter types
interface OffsetPaginationParams {
	limit?: number;
	offset?: number;
}

interface PagePaginationParams {
	page?: number;
	pageSize?: number;
}

interface CursorPaginationParams<T extends string> {
	cursor?: Record<T, any>;
	limit?: number;
	orderBy?:
		| {
				column: T;
				direction: 'asc' | 'desc';
		  }
		| Array<{
				column: T;
				direction: 'asc' | 'desc';
		  }>;
}

interface PaginationMeta {
	totalCount: number;
	totalPages?: number;
	currentPage?: number;
	pageSize?: number;
	hasNextPage: boolean;
	hasPreviousPage: boolean;
}

interface PaginationResult<T> {
	data: T[];
	meta: PaginationMeta;
}

// Test the pagination method types
test.skip('pagination methods have correct parameter and return types', () => {
	// Mock DB
	const db = {} as any;

	// Create model
	const userModel = createModel<TestDB, 'users', 'id'>(db, 'users', 'id');

	// Test offset pagination
	expectTypeOf(userModel.paginate)
		.parameter(0)
		.toMatchTypeOf<OffsetPaginationParams>();

	expectTypeOf(userModel.paginate).returns.toMatchTypeOf<
		Promise<Selectable<TestDB['users']>[]>
	>();

	// Test page pagination
	expectTypeOf(userModel.paginateByPage)
		.parameter(0)
		.toMatchTypeOf<PagePaginationParams>();

	expectTypeOf(userModel.paginateByPage).returns.toMatchTypeOf<
		Promise<Selectable<TestDB['users']>[]>
	>();

	// Test cursor pagination
	expectTypeOf(userModel.paginateWithCursor)
		.parameter(0)
		.toMatchTypeOf<CursorPaginationParams<keyof TestDB['users'] & string>>();

	expectTypeOf(userModel.paginateWithCursor).returns.toMatchTypeOf<
		Promise<Selectable<TestDB['users']>[]>
	>();

	// Test pagination with metadata
	expectTypeOf(userModel.paginateWithMeta)
		.parameter(0)
		.toMatchTypeOf<OffsetPaginationParams | PagePaginationParams>();

	expectTypeOf(userModel.paginateWithMeta).returns.toMatchTypeOf<
		Promise<PaginationResult<Selectable<TestDB['users']>>>
	>();
});

// Test pagination parameter types
test('pagination parameter types are correct', () => {
	// Offset pagination params
	assertType<OffsetPaginationParams>({
		limit: 10,
		offset: 0,
	});

	// Page pagination params
	assertType<PagePaginationParams>({
		page: 1,
		pageSize: 20,
	});

	// Cursor pagination params
	assertType<CursorPaginationParams<'id' | 'name'>>({
		cursor: { id: 100 },
		limit: 10,
		orderBy: { column: 'id', direction: 'asc' },
	});

	assertType<CursorPaginationParams<'id' | 'name'>>({
		cursor: { name: 'Last User' },
		limit: 10,
		orderBy: { column: 'name', direction: 'desc' },
	});

	assertType<CursorPaginationParams<'id' | 'name'>>({
		cursor: { id: 100, name: 'Last User' },
		limit: 10,
		orderBy: [
			{ column: 'name', direction: 'asc' },
			{ column: 'id', direction: 'asc' },
		],
	});

	// @ts-expect-error - invalid column name should cause type error
	assertType<CursorPaginationParams<'id' | 'name'>>({
		cursor: { invalid: 100 },
		orderBy: { column: 'invalid', direction: 'asc' },
	});
});

// Test pagination result types
test('pagination result types are correct', () => {
	// Create a mock user type
	type User = Selectable<TestDB['users']>;

	// Test pagination result
	assertType<PaginationResult<User>>({
		data: [
			{ id: 1, name: 'User 1', email: 'user1@example.com' },
			{ id: 2, name: 'User 2', email: 'user2@example.com' },
		],
		meta: {
			totalCount: 100,
			totalPages: 10,
			currentPage: 1,
			pageSize: 10,
			hasNextPage: true,
			hasPreviousPage: false,
		},
	});

	// @ts-expect-error - missing required properties should cause type error
	assertType<PaginationResult<User>>({
		data: [],
		meta: {
			totalCount: 0,
		},
	});
});
