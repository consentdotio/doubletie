import { beforeEach, describe, expect, it, vi } from 'vitest';
import { Database } from '../../database';
import createModel from '../../model';
import { createMockDatabase, createMockReturnThis } from '../fixtures/mock-db';

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

	let mockDb: any;
	let userModel: any;

	beforeEach(() => {
		// Set up all the mock methods
		const mockMethods = {
			selectFrom: createMockReturnThis(),
			select: createMockReturnThis(),
			where: createMockReturnThis(),
			whereIn: createMockReturnThis(),
			whereLike: createMockReturnThis(),
			whereNotNull: createMockReturnThis(),
			whereNull: createMockReturnThis(),
			orWhere: createMockReturnThis(),
			andWhere: createMockReturnThis(),
			innerJoin: createMockReturnThis(),
			leftJoin: createMockReturnThis(),
			on: createMockReturnThis(),
			orderBy: createMockReturnThis(),
			groupBy: createMockReturnThis(),
			having: createMockReturnThis(),
			limit: createMockReturnThis(),
			offset: createMockReturnThis(),
			execute: vi.fn().mockResolvedValue([]),
			executeTakeFirst: vi.fn().mockResolvedValue(null),
			$dynamic: vi.fn(),
			fn: {
				count: vi.fn().mockReturnValue('COUNT expression'),
				avg: vi.fn().mockReturnValue('AVG expression'),
				sum: vi.fn().mockReturnValue('SUM expression'),
			},
		};

		// Create a mock database with all our methods
		mockDb = createMockDatabase<TestDB>(mockMethods);

		// Create model with mock db - explicitly provide type parameters
		userModel = createModel<TestDB, 'users', 'id'>(
			mockDb as unknown as Database<TestDB>,
			'users',
			'id'
		);
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
				new Date('2023-01-01')
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
			// Set up some test filters
			const filters = {
				status: 'active',
				createdAfter: new Date('2023-01-01'),
			};

			mockDb.$dynamic.mockImplementation((callback: any) => {
				// Mock implementation that handles the callback
				const mockExpressionBuilder = {
					and: vi.fn().mockReturnValue('AND expression'),
				};

				// but returns something that can be added to conditions array
				const eb: any = vi.fn().mockReturnValue('condition');
				// Add and method to the mock function
				eb.and = mockExpressionBuilder.and;

				return callback(eb);
			});

			await userModel
				.selectFrom()
				.where((eb: any) => {
					const conditions = [];

					if (filters.status) {
						conditions.push(eb('status', '=', filters.status));
					}

					if (filters.createdAfter) {
						conditions.push(eb('created_at', '>', filters.createdAfter));
					}

					return eb.and(conditions);
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
			mockDb.innerJoin.mockImplementation((table: any, callback: any) => {
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
				.innerJoin('posts', (join: any) =>
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
			mockDb.select.mockImplementation((callback: any) => {
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
				.select((eb: any) => ['status', eb.fn.count('id').as('user_count')])
				.groupBy(['status'])
				.execute();

			expect(mockDb.fn.count).toHaveBeenCalledWith('id');
			expect(mockDb.groupBy).toHaveBeenCalledWith(['status']);
		});

		it('should build a query with having clause', async () => {
			mockDb.having.mockImplementation((callback: any) => {
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
				.select((eb: any) => ['status', eb.fn.count('id').as('user_count')])
				.groupBy(['status'])
				.having((eb: any) => eb.fn.count('id'), '>', 10)
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

		it('should allow building complex search queries', async () => {
			// Mock the implementation of a search function
			const searchUsers = async (searchTerm: string, limit = 10) => {
				return userModel
					.selectFrom()
					.where((eb: any) =>
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

	describe('raw SQL', () => {
		it('should allow using raw SQL expressions', async () => {
			const sqlSpy = vi.fn().mockReturnValue('RAW SQL EXPRESSION');

			await userModel
				.selectFrom()
				.where(() =>
					sqlSpy('status = ? and created_at > ?', ['active', new Date()])
				)
				.execute();

			expect(sqlSpy).toHaveBeenCalled();
		});
	});
});
