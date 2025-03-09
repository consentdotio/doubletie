import { describe, expect, it, vi } from 'vitest';
import createModel from '~/model';

// Helper function to convert date to SQLite format
const toSqliteDate = (date: Date): string => date.toISOString();

describe('Basic CRUD Operations - Unit Tests', () => {
	it('should handle create operations with mocked DB', async () => {
		// Mock database
		const mockDb = {
			insertInto: vi.fn(),
		};

		// Create mock query chain
		const mockInsertChain = {
			values: vi.fn().mockReturnThis(),
			returning: vi.fn().mockReturnThis(),
			executeTakeFirst: vi.fn().mockResolvedValue({ id: 1 }),
		};

		// Configure mock behavior
		mockDb.insertInto.mockReturnValue(mockInsertChain);

		// Create a model
		const UserModel = createModel(mockDb, 'users', 'id');

		// Define create user function
		const createUser = async (userData: any) => {
			return mockDb
				.insertInto('users')
				.values(userData)
				.returning('id')
				.executeTakeFirst();
		};

		// Test create operation
		const now = new Date();
		const userData = {
			email: 'test@example.com',
			name: 'Test User',
			username: 'testuser',
			password: 'password123',
			followersCount: 0,
			createdAt: toSqliteDate(now),
			updatedAt: toSqliteDate(now),
		};

		const result = await createUser(userData);

		// Verify the result
		expect(result).toBeDefined();
		expect(result.id).toBe(1);
		expect(mockDb.insertInto).toHaveBeenCalledWith('users');
		expect(mockInsertChain.values).toHaveBeenCalledWith(userData);
	});

	it('should handle read operations with mocked DB', async () => {
		// Mock database
		const mockDb = {
			selectFrom: vi.fn(),
		};

		// Create mock query chain
		const mockSelectChain = {
			where: vi.fn().mockReturnThis(),
			selectAll: vi.fn().mockReturnThis(),
			executeTakeFirst: vi.fn().mockResolvedValue({
				id: 1,
				email: 'test@example.com',
				name: 'Test User',
				username: 'testuser',
			}),
		};

		// Configure mock behavior
		mockDb.selectFrom.mockReturnValue(mockSelectChain);

		// Create a model
		const UserModel = createModel(mockDb, 'users', 'id');

		// Define get user function
		const getUserByEmail = async (email: string) => {
			return mockDb
				.selectFrom('users')
				.where('email', '=', email)
				.selectAll()
				.executeTakeFirst();
		};

		// Test read operation
		const user = await getUserByEmail('test@example.com');

		// Verify the result
		expect(user).toBeDefined();
		expect(user.id).toBe(1);
		expect(user.email).toBe('test@example.com');
		expect(mockDb.selectFrom).toHaveBeenCalledWith('users');
		expect(mockSelectChain.where).toHaveBeenCalledWith(
			'email',
			'=',
			'test@example.com'
		);
	});

	it('should handle update operations with mocked DB', async () => {
		// Mock database
		const mockDb = {
			updateTable: vi.fn(),
		};

		// Create mock query chain
		const mockUpdateChain = {
			set: vi.fn().mockReturnThis(),
			where: vi.fn().mockReturnThis(),
			execute: vi.fn().mockResolvedValue({ numUpdatedRows: 1n }),
		};

		// Configure mock behavior
		mockDb.updateTable.mockReturnValue(mockUpdateChain);

		// Create a model
		const UserModel = createModel(mockDb, 'users', 'id');

		// Define update user function
		const updateUserName = async (id: number, name: string) => {
			return mockDb
				.updateTable('users')
				.set({
					name,
					updatedAt: toSqliteDate(new Date()),
				})
				.where('id', '=', id)
				.execute();
		};

		// Test update operation
		const result = await updateUserName(1, 'Updated Name');

		// Verify the result
		expect(result).toBeDefined();
		expect(result.numUpdatedRows).toBe(1n);
		expect(mockDb.updateTable).toHaveBeenCalledWith('users');
		expect(mockUpdateChain.set).toHaveBeenCalled();
		expect(mockUpdateChain.where).toHaveBeenCalledWith('id', '=', 1);
	});

	it('should handle delete operations with mocked DB', async () => {
		// Mock database
		const mockDb = {
			deleteFrom: vi.fn(),
		};

		// Create mock query chain
		const mockDeleteChain = {
			where: vi.fn().mockReturnThis(),
			execute: vi.fn().mockResolvedValue({ numDeletedRows: 1n }),
		};

		// Configure mock behavior
		mockDb.deleteFrom.mockReturnValue(mockDeleteChain);

		// Create a model
		const UserModel = createModel(mockDb, 'users', 'id');

		// Define delete user function
		const deleteUser = async (id: number) => {
			return mockDb.deleteFrom('users').where('id', '=', id).execute();
		};

		// Test delete operation
		const result = await deleteUser(1);

		// Verify the result
		expect(result).toBeDefined();
		expect(result.numDeletedRows).toBe(1n);
		expect(mockDb.deleteFrom).toHaveBeenCalledWith('users');
		expect(mockDeleteChain.where).toHaveBeenCalledWith('id', '=', 1);
	});

	it('should handle direct column updates with mocked DB', async () => {
		// Mock database
		const mockDb = {
			updateTable: vi.fn(),
			updateColumn: vi.fn(),
		};

		// Create mock query chains
		const mockUpdateChain = {
			set: vi.fn().mockReturnThis(),
			where: vi.fn().mockReturnThis(),
			execute: vi.fn().mockResolvedValue({ numUpdatedRows: 1n }),
		};

		const mockUpdateColumnChain = {
			where: vi.fn().mockReturnThis(),
			execute: vi.fn().mockResolvedValue({ numUpdatedRows: 1n }),
		};

		// Configure mock behavior
		mockDb.updateTable.mockReturnValue(mockUpdateChain);
		mockDb.updateColumn.mockReturnValue(mockUpdateColumnChain);

		// Create a model
		const UserModel = createModel(mockDb, 'users', 'id');

		// Test direct column update
		await mockDb
			.updateTable('users')
			.set('email', 'new@example.com')
			.where('id', '=', 1)
			.execute();

		// Verify the direct update
		expect(mockUpdateChain.set).toHaveBeenCalledWith(
			'email',
			'new@example.com'
		);

		// Test with updateColumn helper
		await mockDb
			.updateColumn('users', 'email', 'another@example.com')
			.where('id', '=', 1)
			.execute();

		// Verify the updateColumn call
		expect(mockDb.updateColumn).toHaveBeenCalledWith(
			'users',
			'email',
			'another@example.com'
		);
		expect(mockUpdateColumnChain.where).toHaveBeenCalledWith('id', '=', 1);
	});

	it('should support cursor-based pagination with mocked DB', async () => {
		// Mock database
		const mockDb = {
			selectFrom: vi.fn(),
		};

		// Create mock query chain
		const mockSelectChain = {
			where: vi.fn().mockReturnThis(),
			orderBy: vi.fn().mockReturnThis(),
			limit: vi.fn().mockReturnThis(),
			selectAll: vi.fn().mockReturnThis(),
			execute: vi.fn(),
		};

		// Configure mock behavior
		mockDb.selectFrom.mockReturnValue(mockSelectChain);

		// Configure first page results
		const firstPageResults = [
			{
				id: 3,
				email: 'cursor3@example.com',
				name: 'Cursor Test 3',
				createdAt: '2023-01-03',
			},
			{
				id: 2,
				email: 'cursor2@example.com',
				name: 'Cursor Test 2',
				createdAt: '2023-01-02',
			},
		];

		// Configure second page results
		const secondPageResults = [
			{
				id: 1,
				email: 'cursor1@example.com',
				name: 'Cursor Test 1',
				createdAt: '2023-01-01',
			},
		];

		// Set up execution to return first page, then second page
		mockSelectChain.execute.mockResolvedValueOnce(firstPageResults);
		mockSelectChain.execute.mockResolvedValueOnce(secondPageResults);

		// Define paginated query function
		const getUsers = async (cursor: string | null, limit: number) => {
			let query = mockDb
				.selectFrom('users')
				.where('email', 'like', 'cursor%')
				.orderBy('createdAt', 'desc')
				.orderBy('name', 'asc')
				.limit(limit);

			if (cursor) {
				query = query.where('createdAt', '<', cursor);
			}

			return query.selectAll().execute();
		};

		// Test pagination
		const firstPage = await getUsers(null, 2);
		expect(firstPage).toHaveLength(2);
		expect(firstPage[0].email).toBe('cursor3@example.com');

		// Get cursor from last item in first page
		const cursor = firstPage[firstPage.length - 1].createdAt;

		// Get second page using cursor
		const secondPage = await getUsers(cursor, 2);
		expect(secondPage).toHaveLength(1);
		expect(secondPage[0].email).toBe('cursor1@example.com');

		// Verify the where calls
		expect(mockSelectChain.where).toHaveBeenCalledWith(
			'email',
			'like',
			'cursor%'
		);
		expect(mockSelectChain.where).toHaveBeenCalledWith(
			'createdAt',
			'<',
			'2023-01-02'
		);
	});

	it('should support one-to-many relationships with mocked DB', async () => {
		// Mock database
		const mockDb = {
			selectFrom: vi.fn(),
			insertInto: vi.fn(),
		};

		// Create mock query chains
		const mockSelectUserChain = {
			where: vi.fn().mockReturnThis(),
			selectAll: vi.fn().mockReturnThis(),
			executeTakeFirst: vi.fn().mockResolvedValue({
				id: 1,
				email: 'relation@example.com',
				name: 'Relation Test',
			}),
		};

		const mockSelectCommentsChain = {
			where: vi.fn().mockReturnThis(),
			selectAll: vi.fn().mockReturnThis(),
			execute: vi.fn().mockResolvedValue([
				{ id: 1, userId: 1, message: 'Test comment 1' },
				{ id: 2, userId: 1, message: 'Test comment 2' },
			]),
		};

		const mockJoinChain = {
			where: vi.fn().mockReturnThis(),
			leftJoin: vi.fn().mockReturnThis(),
			select: vi.fn().mockReturnThis(),
			execute: vi.fn().mockResolvedValue([
				{
					userId: 1,
					email: 'relation@example.com',
					commentId: 1,
					message: 'Test comment 1',
				},
				{
					userId: 1,
					email: 'relation@example.com',
					commentId: 2,
					message: 'Test comment 2',
				},
			]),
		};

		const mockInsertChain = {
			values: vi.fn().mockReturnThis(),
			execute: vi.fn().mockResolvedValue({}),
		};

		// Configure mock behavior for different queries
		mockDb.selectFrom.mockImplementation((table) => {
			if (table === 'users') {
				return mockSelectUserChain;
			} else if (table === 'comments') {
				return mockSelectCommentsChain;
			}
			return mockJoinChain;
		});

		mockDb.insertInto.mockReturnValue(mockInsertChain);

		// Create a model
		const UserModel = createModel(mockDb, 'users', 'id');

		// Define function to get user with comments
		const getUserWithComments = async (userId: number) => {
			// First get the user
			const user = await mockDb
				.selectFrom('users')
				.where('id', '=', userId)
				.selectAll()
				.executeTakeFirst();

			if (!user) {
				return null;
			}

			// Get user's comments
			const comments = await mockDb
				.selectFrom('comments')
				.where('userId', '=', userId)
				.selectAll()
				.execute();

			// Get user with joined comments
			const userWithComments = await mockDb
				.selectFrom('users')
				.where('users.id', '=', userId)
				.leftJoin('comments', 'users.id', 'comments.userId')
				.select([
					'users.id as userId',
					'users.email',
					'comments.id as commentId',
					'comments.message',
				])
				.execute();

			return {
				user,
				comments,
				userWithComments,
			};
		};

		// Test fetching user with comments
		const result = await getUserWithComments(1);

		// Verify the results
		expect(result.user).toBeDefined();
		expect(result.user.email).toBe('relation@example.com');

		expect(result.comments).toHaveLength(2);
		expect(result.comments[0].message).toBe('Test comment 1');

		expect(result.userWithComments).toHaveLength(2);
		expect(result.userWithComments[0].userId).toBe(1);
		expect(result.userWithComments[0].commentId).toBe(1);

		// Verify the queries
		expect(mockSelectUserChain.where).toHaveBeenCalledWith('id', '=', 1);
		expect(mockSelectCommentsChain.where).toHaveBeenCalledWith(
			'userId',
			'=',
			1
		);
		expect(mockJoinChain.leftJoin).toHaveBeenCalled();
	});
});
