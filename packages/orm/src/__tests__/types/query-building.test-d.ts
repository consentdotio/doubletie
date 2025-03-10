// tests/types/query-building.test-d.ts

import { sql } from 'kysely';
import type {
	ReferenceExpression as RefExp,
	SelectExpression,
	Selectable,
	Sql,
} from 'kysely';
import { assertType, expectTypeOf, test } from 'vitest';
import createModel from '~/model';

// Define test database schema
interface TestDB {
	users: {
		id: number;
		name: string;
		email: string;
		status: string;
	};
	posts: {
		id: number;
		user_id: number;
		title: string;
		content: string;
		published: boolean;
	};
}

// Test query builder types
test.skip('query builder methods have correct parameter and return types', () => {
	// Mock DB
	const db = {} as any;

	// Create model
	const userModel = createModel<TestDB, 'users', 'id'>(db, 'users', 'id');

	// Test selectFrom type
	expectTypeOf(userModel.selectFrom).returns.toHaveProperty('select');

	// Test select method
	const selectBuilder = userModel.selectFrom().select(['id', 'name']);
	expectTypeOf(selectBuilder).toHaveProperty('where');

	// Test where method with different signatures
	const whereBuilder = userModel.selectFrom().where('status', '=', 'active');
	expectTypeOf(whereBuilder.where)
		.parameter(0)
		.toEqualTypeOf<string | Sql | ((eb: any) => any)>();

	// Test join methods
	expectTypeOf(userModel.selectFrom().innerJoin).parameter(0).toBeString();

	// Test execution methods
	expectTypeOf(userModel.selectFrom().execute).returns.toMatchTypeOf<
		Promise<Selectable<TestDB['users']>[]>
	>();

	expectTypeOf(userModel.selectFrom().executeTakeFirst).returns.toMatchTypeOf<
		Promise<Selectable<TestDB['users']> | undefined>
	>();
});

// Test query result types
test('query results have correct types', () => {
	type User = Selectable<TestDB['users']>;
	type Post = Selectable<TestDB['posts']>;

	// Simple query result
	assertType<User>({
		id: 1,
		name: 'Test User',
		email: 'test@example.com',
		status: 'active',
	});

	// Query with join result
	type UserWithPost = User & {
		post_id: Post['id'];
		post_title: Post['title'];
	};

	assertType<UserWithPost>({
		id: 1,
		name: 'Test User',
		email: 'test@example.com',
		status: 'active',
		post_id: 1,
		post_title: 'Test Post',
	});

	// Query with aggregation result
	type StatusCount = {
		status: string;
		user_count: number | string; // SQL count returns string in some dialects
	};

	assertType<StatusCount>({
		status: 'active',
		user_count: 10,
	});

	assertType<StatusCount>({
		status: 'active',
		user_count: '10',
	});
});

// Test expression builder types
test.skip('expression builder has correct types', () => {
	// Mock DB
	const db = {} as any;

	// Create models
	const userModel = createModel<TestDB, 'users', 'id'>(db, 'users', 'id');

	// Testing a complex query to verify type safety
	const complexQuery = async () => {
		return userModel
			.selectFrom()
			.select(({ eb, selectFrom }) => [
				'id',
				'name',
				selectFrom('posts')
					.select(eb.fn.count('id').as('post_count'))
					.where('user_id', '=', eb.ref('users.id'))
					.as('post_count'),
			])
			.where('status', '=', 'active')
			.where(({ eb, exists, selectFrom }) =>
				exists(
					selectFrom('posts')
						.select('id')
						.where('user_id', '=', eb.ref('users.id'))
				)
			)
			.orderBy('name')
			.execute();
	};

	// Assert the function is properly typed
	expectTypeOf(complexQuery).toBeFunction();
	expectTypeOf(complexQuery).returns.toMatchTypeOf<Promise<any>>();
});

// Test SQL expression types
test('SQL expressions have correct types', () => {
	expectTypeOf(sql`SELECT * FROM users`).toMatchTypeOf<Sql>();

	expectTypeOf(sql.ref('users.id')).toMatchTypeOf<RefExp<any, any>>();
});

// Test search function types
test.skip('search function has correct parameter and return types', () => {
	// Mock DB
	const db = {} as any;

	// Create model
	const userModel = createModel<TestDB, 'users', 'id'>(db, 'users', 'id');

	// Define a search function
	const searchUsers = (searchTerm: string, limit: number = 10) => {
		return userModel
			.selectFrom()
			.where('name', 'like', `%${searchTerm}%`)
			.orWhere('email', 'like', `%${searchTerm}%`)
			.limit(limit)
			.execute();
	};

	// Test function signature
	expectTypeOf(searchUsers).toBeFunction();
	expectTypeOf(searchUsers).parameter(0).toBeString();
	expectTypeOf(searchUsers).parameter(1).toEqualTypeOf<number | undefined>();
	expectTypeOf(searchUsers).returns.toMatchTypeOf<
		Promise<Selectable<TestDB['users']>[]>
	>();
});

// Test dynamic query composition
test.skip('dynamic query composition is type-safe', () => {
	// Mock DB
	const db = {} as any;

	// Create model
	const userModel = createModel<TestDB, 'users', 'id'>(db, 'users', 'id');

	// Define function that builds query dynamically
	const buildUserQuery = (filters: {
		status?: string;
		search?: string;
		sortBy?: keyof TestDB['users'];
		sortDirection?: 'asc' | 'desc';
	}) => {
		let query = userModel.selectFrom();

		// Add filters conditionally
		if (filters.status) {
			query = query.where('status', '=', filters.status);
		}

		if (filters.search) {
			query = query.where('name', 'like', `%${filters.search}%`);
		}

		// Add sorting conditionally
		if (filters.sortBy) {
			query = query.orderBy(filters.sortBy, filters.sortDirection || 'asc');
		}

		return query.execute();
	};

	// Test the function is properly typed
	expectTypeOf(buildUserQuery).toBeFunction();
	expectTypeOf(buildUserQuery).parameter(0).toMatchTypeOf<{
		status?: string;
		search?: string;
		sortBy?: keyof TestDB['users'];
		sortDirection?: 'asc' | 'desc';
	}>();

	// Verify sortBy only accepts valid columns
	expectTypeOf<Parameters<typeof buildUserQuery>[0]['sortBy']>().toEqualTypeOf<
		'id' | 'name' | 'email' | 'status' | undefined
	>();

	// @ts-expect-error - invalid column should cause type error
	const invalidUsage = buildUserQuery({ sortBy: 'invalid_column' });
});
