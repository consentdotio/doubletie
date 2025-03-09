import {
	InsertResult,
	Kysely,
	SelectQueryBuilder,
	Selectable,
	UpdateResult,
} from 'kysely';
import { expectTypeOf, test } from 'vitest/node';
import createModel from '~/model';

// Define a test database schema
interface TestDB {
	users: {
		id: number;
		email: string;
		name: string;
		username: string;
		password: string;
		followersCount: number;
		createdAt: string;
		updatedAt: string;
	};
	posts: {
		id: number;
		title: string;
		content: string;
		userId: number;
		createdAt: string;
		updatedAt: string;
	};
	comments: {
		id: number;
		userId: number;
		postId: number;
		content: string;
		createdAt: string;
	};
}

test('create operations have correct types', () => {
	// Create a mock DB
	const db = {} as Kysely<TestDB>;

	// Create a user model
	const UserModel = createModel<TestDB, 'users', 'id'>(db, 'users', 'id');

	// Test insert operation
	const insertUser = async (userData: Omit<TestDB['users'], 'id'>) => {
		return db
			.insertInto('users')
			.values(userData)
			.returning(['id', 'email', 'name'])
			.executeTakeFirst();
	};

	// Test parameter types
	expectTypeOf(insertUser)
		.parameter(0)
		.toMatchTypeOf<Omit<TestDB['users'], 'id'>>();

	// Test return types
	expectTypeOf(insertUser).returns.resolves.toMatchTypeOf<
		Pick<TestDB['users'], 'id' | 'email' | 'name'> | undefined
	>();

	// Test with model
	const modelInsert = async (userData: Omit<TestDB['users'], 'id'>) => {
		return UserModel.insert(userData);
	};

	expectTypeOf(modelInsert)
		.parameter(0)
		.toMatchTypeOf<Omit<TestDB['users'], 'id'>>();
	expectTypeOf(modelInsert).returns.toBePromise();
});

test('read operations have correct types', () => {
	// Create a mock DB
	const db = {} as Kysely<TestDB>;

	// Create a user model
	const UserModel = createModel<TestDB, 'users', 'id'>(db, 'users', 'id');

	// Test select operation
	const getUserByEmail = async (email: string) => {
		return db
			.selectFrom('users')
			.where('email', '=', email)
			.selectAll()
			.executeTakeFirst();
	};

	// Test parameter types
	expectTypeOf(getUserByEmail).parameter(0).toBeString();

	// Test return types
	expectTypeOf(getUserByEmail).returns.resolves.toMatchTypeOf<
		Selectable<TestDB['users']> | undefined
	>();

	// Test model find method
	const findById = async (id: number) => {
		return UserModel.findById(id);
	};

	expectTypeOf(findById).parameter(0).toBeNumber();
	expectTypeOf(findById).returns.resolves.toMatchTypeOf<
		Selectable<TestDB['users']> | undefined
	>();

	// Test with select query builder
	const getUsers = () => {
		return db.selectFrom('users').selectAll();
	};

	expectTypeOf(getUsers).returns.toMatchTypeOf<
		SelectQueryBuilder<TestDB, 'users', Record<string, unknown>>
	>();

	// Test query with join
	const getUserWithPosts = async (userId: number) => {
		return db
			.selectFrom('users')
			.where('users.id', '=', userId)
			.innerJoin('posts', 'posts.userId', 'users.id')
			.select([
				'users.id',
				'users.name',
				'posts.id as postId',
				'posts.title as postTitle',
			])
			.execute();
	};

	// Test return type of join query
	expectTypeOf(getUserWithPosts).returns.resolves.toMatchTypeOf<
		Array<{
			id: number;
			name: string;
			postId: number;
			postTitle: string;
		}>
	>();
});

test('update operations have correct types', () => {
	// Create a mock DB
	const db = {} as Kysely<TestDB>;

	// Create a user model
	const UserModel = createModel<TestDB, 'users', 'id'>(db, 'users', 'id');

	// Test update operation
	const updateUserName = async (id: number, name: string) => {
		return db
			.updateTable('users')
			.set({
				name,
				updatedAt: new Date().toISOString(),
			})
			.where('id', '=', id)
			.executeTakeFirst();
	};

	// Test parameter types
	expectTypeOf(updateUserName).parameter(0).toBeNumber();
	expectTypeOf(updateUserName).parameter(1).toBeString();

	// Test return types
	expectTypeOf(updateUserName).returns.resolves.toMatchTypeOf<{
		numUpdatedRows: bigint;
	}>();

	// Test direct column update
	const updateSingleColumn = async (id: number, email: string) => {
		return db
			.updateTable('users')
			.set('email', email)
			.where('id', '=', id)
			.execute();
	};

	expectTypeOf(updateSingleColumn).parameter(1).toBeString();
	expectTypeOf(
		updateSingleColumn
	).returns.resolves.toMatchTypeOf<UpdateResult>();

	// Test model update method
	const modelUpdate = async (
		id: number,
		userData: Partial<Omit<TestDB['users'], 'id'>>
	) => {
		return UserModel.update(id, userData);
	};

	expectTypeOf(modelUpdate).parameter(0).toBeNumber();
	expectTypeOf(modelUpdate)
		.parameter(1)
		.toMatchTypeOf<Partial<Omit<TestDB['users'], 'id'>>>();
	expectTypeOf(modelUpdate).returns.toBePromise();
});

test('delete operations have correct types', () => {
	// Create a mock DB
	const db = {} as Kysely<TestDB>;

	// Create a user model
	const UserModel = createModel<TestDB, 'users', 'id'>(db, 'users', 'id');

	// Test delete operation
	const deleteUser = async (id: number) => {
		return db.deleteFrom('users').where('id', '=', id).executeTakeFirst();
	};

	// Test parameter types
	expectTypeOf(deleteUser).parameter(0).toBeNumber();

	// Test return types
	expectTypeOf(deleteUser).returns.resolves.toMatchTypeOf<{
		numDeletedRows: bigint;
	}>();

	// Test model delete method
	const modelDelete = async (id: number) => {
		return UserModel.delete(id);
	};

	expectTypeOf(modelDelete).parameter(0).toBeNumber();
	expectTypeOf(modelDelete).returns.toBePromise();
});

test('complex query types', () => {
	// Create a mock DB
	const db = {} as Kysely<TestDB>;

	// Create models
	const UserModel = createModel<TestDB, 'users', 'id'>(db, 'users', 'id');
	const PostModel = createModel<TestDB, 'posts', 'id'>(db, 'posts', 'id');
	const CommentModel = createModel<TestDB, 'comments', 'id'>(
		db,
		'comments',
		'id'
	);

	// Test paginated query
	interface PaginatedQuery {
		page: number;
		limit: number;
		search?: string;
	}

	interface PaginatedResult<T> {
		data: T[];
		metadata: {
			total: number;
			page: number;
			limit: number;
			totalPages: number;
		};
	}

	// Function to get paginated posts
	const getPaginatedPosts = async ({
		page,
		limit,
		search,
	}: PaginatedQuery): Promise<PaginatedResult<Selectable<TestDB['posts']>>> => {
		const offset = (page - 1) * limit;

		// Get posts query
		let postsQuery = db.selectFrom('posts').selectAll();

		// Add search if provided
		if (search) {
			postsQuery = postsQuery.where('title', 'like', `%${search}%`);
		}

		// Execute with pagination
		const posts = await postsQuery.limit(limit).offset(offset).execute();

		// Get total count
		const totalResult = await db
			.selectFrom('posts')
			.select((eb) => [eb.fn.count<number>('id').as('total')])
			.executeTakeFirst();

		const total = totalResult?.total || 0;
		const totalPages = Math.ceil(total / limit);

		// Return paginated result
		return {
			data: posts,
			metadata: {
				total,
				page,
				limit,
				totalPages,
			},
		};
	};

	// Test parameter types
	expectTypeOf(getPaginatedPosts).parameter(0).toMatchTypeOf<PaginatedQuery>();

	// Test return types
	expectTypeOf(getPaginatedPosts).returns.resolves.toMatchTypeOf<
		PaginatedResult<Selectable<TestDB['posts']>>
	>();

	// Test complex join with aggregation
	const getPostStats = async () => {
		return db
			.selectFrom('posts as p')
			.leftJoin('comments as c', 'c.postId', 'p.id')
			.select((eb) => [
				'p.id',
				'p.title',
				eb.fn.count<number>('c.id').as('commentCount'),
			])
			.groupBy(['p.id', 'p.title'])
			.execute();
	};

	// Test return type with aggregation
	expectTypeOf(getPostStats).returns.resolves.toMatchTypeOf<
		Array<{
			id: number;
			title: string;
			commentCount: number;
		}>
	>();
});

test('relationship operations have correct types', () => {
	// Create a mock DB
	const db = {} as Kysely<TestDB>;

	// Define complex result types
	interface UserWithPosts {
		id: number;
		name: string;
		email: string;
		posts: Array<{
			id: number;
			title: string;
			content: string;
		}>;
	}

	// Function to get user with posts
	const getUserWithPosts = async (
		userId: number
	): Promise<UserWithPosts | null> => {
		// Get the user
		const user = await db
			.selectFrom('users')
			.where('id', '=', userId)
			.select(['id', 'name', 'email'])
			.executeTakeFirst();

		if (!user) {
			return null;
		}

		// Get the user's posts
		const posts = await db
			.selectFrom('posts')
			.where('userId', '=', userId)
			.select(['id', 'title', 'content'])
			.execute();

		// Combine user and posts
		return {
			...user,
			posts,
		};
	};

	// Test parameter types
	expectTypeOf(getUserWithPosts).parameter(0).toBeNumber();

	// Test return type
	expectTypeOf(
		getUserWithPosts
	).returns.resolves.toMatchTypeOf<UserWithPosts | null>();
});

test('cursor-based pagination has correct types', () => {
	// Create a mock DB
	const db = {} as Kysely<TestDB>;

	// Define cursor pagination types
	interface CursorPaginationParams {
		cursor?: string;
		limit?: number;
		orderBy?: 'createdAt' | 'id';
		direction?: 'asc' | 'desc';
	}

	interface CursorPaginationResult<T> {
		data: T[];
		pagination: {
			hasMore: boolean;
			nextCursor?: string;
		};
	}

	// Function for cursor-based pagination
	const getPostsWithCursor = async ({
		cursor,
		limit = 10,
		orderBy = 'createdAt',
		direction = 'desc',
	}: CursorPaginationParams): Promise<
		CursorPaginationResult<Selectable<TestDB['posts']>>
	> => {
		let query = db
			.selectFrom('posts')
			.selectAll()
			.orderBy(orderBy, direction)
			.limit(limit + 1); // Fetch one extra to determine if there are more

		// Apply cursor if provided
		if (cursor) {
			const operator = direction === 'desc' ? '<' : '>';
			query = query.where(orderBy, operator, cursor);
		}

		// Execute query
		const posts = await query.execute();

		// Check if there are more results
		const hasMore = posts.length > limit;

		// Remove the extra item if there are more
		const data = hasMore ? posts.slice(0, limit) : posts;

		// Get next cursor from the last item
		const nextCursor =
			hasMore && data.length > 0
				? (data[data.length - 1][orderBy] as string)
				: undefined;

		return {
			data,
			pagination: {
				hasMore,
				nextCursor,
			},
		};
	};

	// Test parameter types
	expectTypeOf(getPostsWithCursor)
		.parameter(0)
		.toMatchTypeOf<CursorPaginationParams>();

	// Test return type
	expectTypeOf(getPostsWithCursor).returns.resolves.toMatchTypeOf<
		CursorPaginationResult<Selectable<TestDB['posts']>>
	>();
});
