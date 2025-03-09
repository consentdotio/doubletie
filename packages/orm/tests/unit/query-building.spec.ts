import { beforeEach, describe, expect, it, vi } from 'vitest';
import createModel from '~/model';

describe('unit: query building functionality', () => {
	// Define test database types
	interface TestDB {
		users: {
			id: number;
			name: string;
			email: string;
			status: string;
			created_at: Date;
		};
		posts: {
			id: number;
			user_id: number;
			title: string;
			content: string;
			published: boolean;
			created_at: Date;
		};
		categories: {
			id: number;
			name: string;
		};
		post_categories: {
			post_id: number;
			category_id: number;
		};
	}

	let mockDb;
	let mockUserBuilder;
	let userModel;

	beforeEach(() => {
		// Set up mock query builder with chaining methods
		mockUserBuilder = {
			selectFrom: vi.fn().mockReturnThis(),
			select: vi.fn().mockReturnThis(),
			where: vi.fn().mockReturnThis(),
			whereIn: vi.fn().mockReturnThis(),
			whereLike: vi.fn().mockReturnThis(),
			whereNotNull: vi.fn().mockReturnThis(),
			whereNull: vi.fn().mockReturnThis(),
			orWhere: vi.fn().mockReturnThis(),
			andWhere: vi.fn().mockReturnThis(),
			innerJoin: vi.fn().mockReturnThis(),
			leftJoin: vi.fn().mockReturnThis(),
			on: vi.fn().mockReturnThis(),
			orderBy: vi.fn().mockReturnThis(),
			groupBy: vi.fn().mockReturnThis(),
			having: vi.fn().mockReturnThis(),
			limit: vi.fn().mockReturnThis(),
			offset: vi.fn().mockReturnThis(),
			execute: vi.fn().mockResolvedValue([]),
			executeTakeFirst: vi.fn().mockResolvedValue(null),
			$dynamic: vi.fn(),
		};

		// Set up mock database
		mockDb = {
			...mockUserBuilder,
			fn: {
				count: vi.fn().mockReturnValue('COUNT expression'),
				avg: vi.fn().mockReturnValue('AVG expression'),
				sum: vi.fn().mockReturnValue('SUM expression'),
			},
		};

		// Create model with mock db
		userModel = createModel<TestDB, 'users', 'id'>(mockDb, 'users', 'id');
	});

	describe('basic query building', () => {
		it('should build a simple select query', async () => {
			await userModel.selectFrom().select(['id', 'name']).execute();

			expect(mockDb.selectFrom).toHaveBeenCalledWith('users');
			expect(mockDb.select).toHaveBeenCalledWith(['id', 'name']);
			expect(mockDb.execute).toHaveBeenCalled();
		});

		it('should build a query with simple where clause', async () => {
			await userModel.selectFrom().where('status', '=', 'active').execute();

			expect(mockDb.where).toHaveBeenCalledWith('status', '=', 'active');
		});

		it('should build a query with compound where clauses', async () => {
			await userModel
				.selectFrom()
				.where('status', '=', 'active')
				.where('created_at', '>', new Date('2023-01-01'))
				.execute();

			expect(mockDb.where).toHaveBeenCalledTimes(2);
			expect(mockDb.where).toHaveBeenNthCalledWith(1, 'status', '=', 'active');
			expect(mockDb.where).toHaveBeenNthCalledWith(
				2,
				'created_at',
				'>',
				expect.any(Date)
			);
		});

		it('should build a query with OR conditions', async () => {
			await userModel
				.selectFrom()
				.where('status', '=', 'active')
				.orWhere('status', '=', 'pending')
				.execute();

			expect(mockDb.where).toHaveBeenCalledWith('status', '=', 'active');
			expect(mockDb.orWhere).toHaveBeenCalledWith('status', '=', 'pending');
		});
	});

	describe('complex query building', () => {
		it('should build a query with whereIn clause', async () => {
			await userModel.selectFrom().whereIn('id', [1, 2, 3]).execute();

			expect(mockDb.whereIn).toHaveBeenCalledWith('id', [1, 2, 3]);
		});

		it('should build a query with LIKE operator', async () => {
			await userModel.selectFrom().whereLike('name', '%John%').execute();

			expect(mockDb.whereLike).toHaveBeenCalledWith('name', '%John%');
		});

		it('should build a query with NULL checks', async () => {
			await userModel
				.selectFrom()
				.whereNotNull('email')
				.whereNull('deleted_at')
				.execute();

			expect(mockDb.whereNotNull).toHaveBeenCalledWith('email');
			expect(mockDb.whereNull).toHaveBeenCalledWith('deleted_at');
		});

		it('should build a query with dynamic conditions', async () => {
			const filters = {
				status: 'active',
				name: 'John',
			};

			mockDb.$dynamic.mockImplementation((callback) => {
				// Mock implementation that handles the callback
				const mockExpressionBuilder = {
					and: vi.fn().mockReturnValue('AND expression'),
				};

				// Create a simple version of eb that doesn't really use the parameters
				// but returns something that can be added to conditions array
				const eb = vi.fn().mockReturnValue('condition');
				eb.and = mockExpressionBuilder.and;

				return callback(eb);
			});

			await userModel
				.selectFrom()
				.where((eb) => {
					const conditions = [];

					if (filters.status) {
						conditions.push(eb('status', '=', filters.status));
					}

					if (filters.name) {
						conditions.push(eb('name', 'like', `%${filters.name}%`));
					}

					return conditions.length ? eb.and(conditions) : undefined;
				})
				.execute();

			expect(mockDb.$dynamic).toHaveBeenCalled();
			expect(mockDb.where).toHaveBeenCalled();
		});
	});

	describe('joins and relations', () => {
		it('should build a query with inner join', async () => {
			await userModel
				.selectFrom()
				.select(['users.id', 'users.name', 'posts.title'])
				.innerJoin('posts', 'posts.user_id', 'users.id')
				.execute();

			expect(mockDb.innerJoin).toHaveBeenCalledWith(
				'posts',
				'posts.user_id',
				'users.id'
			);
		});

		it('should build a query with left join', async () => {
			await userModel
				.selectFrom()
				.leftJoin('posts', 'posts.user_id', 'users.id')
				.execute();

			expect(mockDb.leftJoin).toHaveBeenCalledWith(
				'posts',
				'posts.user_id',
				'users.id'
			);
		});

		it('should build a query with complex join conditions', async () => {
			// Mock the callback for complex joins
			mockDb.innerJoin.mockImplementation((table, callback) => {
				if (typeof callback === 'function') {
					const mockJoinBuilder = {
						onRef: vi.fn().mockReturnThis(),
						on: vi.fn().mockReturnThis(),
					};
					callback(mockJoinBuilder);
				}
				return mockDb;
			});

			await userModel
				.selectFrom()
				.innerJoin('posts', (join) =>
					join
						.onRef('posts.user_id', '=', 'users.id')
						.on('posts.published', '=', true)
				)
				.execute();

			expect(mockDb.innerJoin).toHaveBeenCalled();
		});
	});

	describe('aggregations and grouping', () => {
		it('should build a query with count aggregation', async () => {
			mockDb.select.mockImplementation((callback) => {
				if (typeof callback === 'function') {
					const mockExpressionBuilder = {
						fn: mockDb.fn,
					};
					callback(mockExpressionBuilder);
				}
				return mockDb;
			});

			await userModel
				.selectFrom()
				.select((eb) => ['status', eb.fn.count('id').as('user_count')])
				.groupBy(['status'])
				.execute();

			expect(mockDb.fn.count).toHaveBeenCalledWith('id');
			expect(mockDb.groupBy).toHaveBeenCalledWith(['status']);
		});

		it('should build a query with having clause', async () => {
			mockDb.having.mockImplementation((callback) => {
				if (typeof callback === 'function') {
					const mockExpressionBuilder = {
						fn: mockDb.fn,
					};
					callback(mockExpressionBuilder);
				}
				return mockDb;
			});

			await userModel
				.selectFrom()
				.select((eb) => ['status', eb.fn.count('id').as('user_count')])
				.groupBy(['status'])
				.having((eb) => eb.fn.count('id'), '>', 10)
				.execute();

			expect(mockDb.having).toHaveBeenCalled();
		});
	});

	describe('ordering and pagination', () => {
		it('should build a query with orderBy clause', async () => {
			await userModel.selectFrom().orderBy('created_at', 'desc').execute();

			expect(mockDb.orderBy).toHaveBeenCalledWith('created_at', 'desc');
		});

		it('should build a query with multiple orderBy clauses', async () => {
			await userModel
				.selectFrom()
				.orderBy('status', 'asc')
				.orderBy('created_at', 'desc')
				.execute();

			expect(mockDb.orderBy).toHaveBeenCalledTimes(2);
			expect(mockDb.orderBy).toHaveBeenNthCalledWith(1, 'status', 'asc');
			expect(mockDb.orderBy).toHaveBeenNthCalledWith(2, 'created_at', 'desc');
		});

		it('should build a query with limit and offset', async () => {
			await userModel.selectFrom().limit(10).offset(20).execute();

			expect(mockDb.limit).toHaveBeenCalledWith(10);
			expect(mockDb.offset).toHaveBeenCalledWith(20);
		});
	});

	describe('search functionality', () => {
		it('should implement a search function', async () => {
			// Mock the implementation of a search function
			const searchUsers = async (searchTerm: string, limit = 10) => {
				return userModel
					.selectFrom()
					.where((eb) =>
						eb.or([
							eb('name', 'like', `%${searchTerm}%`),
							eb('email', 'like', `%${searchTerm}%`),
						])
					)
					.limit(limit)
					.execute();
			};

			await searchUsers('john');

			expect(mockDb.limit).toHaveBeenCalledWith(10);
		});
	});

	describe('raw SQL expressions', () => {
		it('should support raw SQL expressions', async () => {
			// Mock SQL implementation
			const sqlSpy = vi.fn().mockReturnValue('RAW SQL EXPRESSION');

			await userModel
				.selectFrom()
				.where(() =>
					sqlSpy('status = ? AND created_at > ?', ['active', new Date()])
				)
				.execute();

			expect(sqlSpy).toHaveBeenCalled();
		});
	});
});
