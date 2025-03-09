import {
	ExpressionBuilder,
	Kysely,
	QueryResult,
	ReferenceExpression,
	SelectQueryBuilder,
	sql,
} from 'kysely';
import { expectTypeOf, test } from 'vitest/node';
import createModel from '~/model';

test('batch update types are correct', () => {
	// Define the structure for test DB
	interface TestDB {
		users: {
			id: number;
			email: string;
			name: string;
			status: string;
			createdAt: string;
		};
	}

	// Create mock DB and model
	const db = {} as Kysely<TestDB>;
	const UserModel = createModel<TestDB, 'users', 'id'>(db, 'users', 'id');

	// Define the return type for batch update
	interface BatchUpdateResult {
		numUpdatedRows: bigint;
	}

	// Define the batch update function
	const batchUpdateStatus = async (
		userIds: number[],
		status: string
	): Promise<BatchUpdateResult> => {
		const result = await UserModel.updateTable()
			.set({ status })
			.whereIn('id', userIds)
			.execute();

		return { numUpdatedRows: result.numUpdatedRows };
	};

	// Test parameter types
	expectTypeOf(batchUpdateStatus).parameter(0).toMatchTypeOf<number[]>();
	expectTypeOf(batchUpdateStatus).parameter(1).toMatchTypeOf<string>();

	// Test return type
	expectTypeOf(batchUpdateStatus).returns.toMatchTypeOf<
		Promise<BatchUpdateResult>
	>();
	expectTypeOf(batchUpdateStatus([], '')).resolves.toHaveProperty(
		'numUpdatedRows'
	);
});

test('getUsersByIds has correct types', () => {
	// Define the structure for test DB
	interface TestDB {
		users: {
			id: number;
			email: string;
			name: string;
			createdAt: string;
		};
	}

	// Create mock DB and model
	const db = {} as Kysely<TestDB>;
	const UserModel = createModel<TestDB, 'users', 'id'>(db, 'users', 'id');

	// Define get users by IDs function
	const getUsersByIds = async (ids: number[]) => {
		return UserModel.selectFrom().whereIn('id', ids).selectAll().execute();
	};

	// Test parameter types
	expectTypeOf(getUsersByIds).parameter(0).toMatchTypeOf<number[]>();

	// Test return type - should be an array of users
	expectTypeOf(getUsersByIds).returns.resolves.toMatchTypeOf<
		Array<{
			id: number;
			email: string;
			name: string;
			createdAt: string;
		}>
	>();
});

test('tuple operations have correct types', () => {
	// Define a more complex test database structure
	interface TestDB {
		products: {
			id: string;
			name: string;
			category: string;
			price: number;
			created_at: string;
		};
	}

	const db = {} as Kysely<TestDB>;

	// Define findByTuple function with proper generic typing
	function findByTuple<T extends any[]>(columns: string[], values: T) {
		// Type validation
		if (columns.length !== values.length) {
			throw new Error('Columns and values arrays must have the same length');
		}

		if (columns.length > 5) {
			throw new Error(`Tuple with ${columns.length} columns is not supported`);
		}

		// Just for type testing - no implementation needed
		return {
			columns,
			values,
		};
	}

	// Test parameter types
	expectTypeOf(findByTuple).parameter(0).toMatchTypeOf<string[]>();
	expectTypeOf(findByTuple).parameter(1).toBeAny();

	// Test with different numbers of parameters
	expectTypeOf(findByTuple(['category'], ['Electronics'])).toMatchTypeOf<{
		columns: string[];
		values: [string];
	}>();

	expectTypeOf(
		findByTuple(['category', 'price'], ['Electronics', 999.99])
	).toMatchTypeOf<{ columns: string[]; values: [string, number] }>();

	expectTypeOf(
		findByTuple(
			['id', 'name', 'category'],
			['prod1', 'Product 1', 'Electronics']
		)
	).toMatchTypeOf<{ columns: string[]; values: [string, string, string] }>();

	// Test that we're maintaining tuple types, not just arrays
	const singleColumn = findByTuple(['category'], ['Electronics']);
	expectTypeOf(singleColumn.values).toMatchTypeOf<[string]>();
	expectTypeOf(singleColumn.values[0]).toBeString();

	const threeColumns = findByTuple(
		['id', 'name', 'price'],
		['prod1', 'Product 1', 999.99]
	);
	expectTypeOf(threeColumns.values).toMatchTypeOf<[string, string, number]>();
	expectTypeOf(threeColumns.values[2]).toBeNumber();
});

test('expression builder in query has correct types', () => {
	// Define the structure for test DB
	interface TestDB {
		products: {
			id: string;
			name: string;
			category: string;
			price: number;
		};
	}

	// Create mock DB
	const db = {} as Kysely<TestDB>;

	type ProductTuple = [string, string]; // [name, id]

	// Define a tuple-based finder function using expression builder
	const findProductsByTuple = (conditions: ProductTuple[]) => {
		return db
			.selectFrom('products')
			.selectAll()
			.where((eb) => {
				// Generate dynamic OR conditions for tuples
				const tupleConditions = conditions.map(([name, id]) =>
					// Using a simpler approach without tuples
					eb.and([eb('name', '=', name), eb('id', '=', id)])
				);

				// Combine conditions with OR
				return eb.or(tupleConditions);
			});
	};

	// Test parameter types
	expectTypeOf(findProductsByTuple)
		.parameter(0)
		.toMatchTypeOf<ProductTuple[]>();

	// Test return type - should be a select query builder
	expectTypeOf(findProductsByTuple).returns.toMatchTypeOf<
		SelectQueryBuilder<TestDB, 'products', Record<string, unknown>>
	>();

	// Test with real tuples
	const query = findProductsByTuple([
		['Product A', 'product1'],
		['Product B', 'product2'],
	]);

	expectTypeOf(query.execute).toBeFunction();
});

test('JSON operations with sql template tag have correct types', () => {
	// Define the structure for test DB with JSON column
	interface TestDB {
		json_test: {
			id: string;
			data: string; // JSON stored as text
		};
	}

	// Create mock DB
	const db = {} as Kysely<TestDB>;

	// Define a function to query JSON data
	const getUsersByTheme = (theme: string) => {
		return db
			.selectFrom('json_test')
			.selectAll()
			.where(
				sql<boolean>`json_extract(data, '$.user.profile.preferences.theme')`,
				'=',
				theme
			);
	};

	// Test parameter types
	expectTypeOf(getUsersByTheme).parameter(0).toBeString();

	// Test return type
	expectTypeOf(getUsersByTheme).returns.toMatchTypeOf<
		SelectQueryBuilder<TestDB, 'json_test', Record<string, unknown>>
	>();

	// Verify sql tag type safety
	expectTypeOf(sql<boolean>`json_extract(data, '$.theme')`).toMatchTypeOf<
		ReferenceExpression<boolean>
	>();
});

test('streaming operations have correct types', () => {
	// Define the structure for test DB
	interface TestDB {
		stream_test: {
			id: number;
			value: string;
		};
	}

	// Create mock DB
	const db = {} as Kysely<TestDB>;

	// Define a function that uses streaming
	const streamAllItems = async () => {
		const stream = await db.selectFrom('stream_test').selectAll().stream();

		const items: Array<{ id: number; value: string }> = [];

		for await (const item of stream) {
			items.push(item);
		}

		return items;
	};

	// Test return type
	expectTypeOf(streamAllItems).returns.resolves.toMatchTypeOf<
		Array<{ id: number; value: string }>
	>();
});

test('complex relationships have correct types', () => {
	// Define structure for a blog with relationships
	interface TestDB {
		users: {
			id: number;
			name: string;
			email: string;
		};
		articles: {
			id: string;
			title: string;
			content: string;
			userId: number;
		};
		comments: {
			id: number;
			content: string;
			articleId: string;
			userId: number;
		};
		user_favorites: {
			user_id: number;
			article_id: string;
		};
	}

	// Create mock DB
	const db = {} as Kysely<TestDB>;

	// Define a function to get articles with relationships
	const getArticleWithRelations = async (articleId: string) => {
		// Get article with author
		const article = await db
			.selectFrom('articles as a')
			.innerJoin('users as u', 'u.id', 'a.userId')
			.select([
				'a.id as articleId',
				'a.title',
				'a.content',
				'u.id as authorId',
				'u.name as authorName',
			])
			.where('a.id', '=', articleId)
			.executeTakeFirst();

		if (!article) return null;

		// Get comments with commenters
		const comments = await db
			.selectFrom('comments as c')
			.innerJoin('users as u', 'u.id', 'c.userId')
			.select([
				'c.id as commentId',
				'c.content',
				'u.id as userId',
				'u.name as userName',
			])
			.where('c.articleId', '=', articleId)
			.execute();

		// Get favorite count
		const favoriteCount = await db
			.selectFrom('user_favorites')
			.select((eb) => [eb.fn.count('user_id').as('favoriteCount')])
			.where('article_id', '=', articleId)
			.executeTakeFirst();

		// Return complete article data
		return {
			...article,
			comments,
			favoriteCount: Number(favoriteCount?.favoriteCount || 0),
		};
	};

	// Test parameter type
	expectTypeOf(getArticleWithRelations).parameter(0).toBeString();

	// Test return type
	// Complex type with nested objects
	type ArticleWithRelations = {
		articleId: string;
		title: string;
		content: string;
		authorId: number;
		authorName: string;
		comments: Array<{
			commentId: number;
			content: string;
			userId: number;
			userName: string;
		}>;
		favoriteCount: number;
	} | null;

	expectTypeOf(
		getArticleWithRelations
	).returns.resolves.toMatchTypeOf<ArticleWithRelations>();
});
