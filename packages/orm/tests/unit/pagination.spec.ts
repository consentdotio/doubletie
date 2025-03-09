import { beforeEach, describe, expect, it, vi } from 'vitest';
import createModel from '~/model';

describe('unit: pagination functionality', () => {
	// Define test database types
	interface TestDB {
		users: {
			id: number;
			name: string;
			email: string;
			created_at: Date;
		};
	}

	let mockDb;
	let userModel;

	beforeEach(() => {
		// Set up mock database and query builders
		const mockExecute = vi.fn().mockResolvedValue([]);
		const mockExecuteTakeFirst = vi.fn().mockResolvedValue(null);

		mockDb = {
			selectFrom: vi.fn().mockReturnThis(),
			select: vi.fn().mockReturnThis(),
			where: vi.fn().mockReturnThis(),
			orderBy: vi.fn().mockReturnThis(),
			limit: vi.fn().mockReturnThis(),
			offset: vi.fn().mockReturnThis(),
			execute: mockExecute,
			executeTakeFirst: mockExecuteTakeFirst,
		};

		// Create model with mock db
		userModel = createModel<TestDB, 'users', 'id'>(mockDb, 'users', 'id');
	});

	describe('offset-based pagination', () => {
		it('should apply limit and offset to queries', async () => {
			await userModel.paginate({ limit: 10, offset: 20 });

			expect(mockDb.limit).toHaveBeenCalledWith(10);
			expect(mockDb.offset).toHaveBeenCalledWith(20);
			expect(mockDb.execute).toHaveBeenCalled();
		});

		it('should use default values if not provided', async () => {
			await userModel.paginate({});

			// Check if default values were applied
			expect(mockDb.limit).toHaveBeenCalledWith(expect.any(Number));
			expect(mockDb.offset).toHaveBeenCalledWith(expect.any(Number));
		});

		it('should handle invalid pagination params', async () => {
			await userModel.paginate({ limit: -10, offset: -5 });

			// Should apply minimum values instead of negative ones
			expect(mockDb.limit).toHaveBeenCalledWith(expect.any(Number));
			expect(mockDb.limit).not.toHaveBeenCalledWith(-10);
			expect(mockDb.offset).not.toHaveBeenCalledWith(-5);
		});
	});

	describe('page-based pagination', () => {
		it('should convert page and pageSize to limit and offset', async () => {
			await userModel.paginateByPage({ page: 3, pageSize: 15 });

			expect(mockDb.limit).toHaveBeenCalledWith(15);
			expect(mockDb.offset).toHaveBeenCalledWith(30); // (page-1) * pageSize
			expect(mockDb.execute).toHaveBeenCalled();
		});

		it('should use default page values if not provided', async () => {
			await userModel.paginateByPage({});

			// Should use default values (typically page 1 with some default page size)
			expect(mockDb.limit).toHaveBeenCalled();
			expect(mockDb.offset).toHaveBeenCalled();
		});
	});

	describe('cursor-based pagination', () => {
		it('should apply cursor to where clause', async () => {
			await userModel.paginateWithCursor({
				cursor: { id: 100 },
				limit: 10,
				orderBy: { column: 'id', direction: 'asc' },
			});

			expect(mockDb.where).toHaveBeenCalledWith('id', '>', 100);
			expect(mockDb.limit).toHaveBeenCalledWith(10);
			expect(mockDb.orderBy).toHaveBeenCalledWith('id', 'asc');
		});

		it('should handle descending order with cursor', async () => {
			await userModel.paginateWithCursor({
				cursor: { id: 100 },
				limit: 10,
				orderBy: { column: 'id', direction: 'desc' },
			});

			expect(mockDb.where).toHaveBeenCalledWith('id', '<', 100);
			expect(mockDb.orderBy).toHaveBeenCalledWith('id', 'desc');
		});

		it('should handle complex cursor with multiple fields', async () => {
			await userModel.paginateWithCursor({
				cursor: { created_at: new Date('2023-01-01'), id: 100 },
				limit: 10,
				orderBy: [
					{ column: 'created_at', direction: 'desc' },
					{ column: 'id', direction: 'desc' },
				],
			});

			// Should handle complex cursor logic
			expect(mockDb.where).toHaveBeenCalled();
			expect(mockDb.orderBy).toHaveBeenCalledTimes(2);
		});
	});

	describe('pagination metadata', () => {
		beforeEach(() => {
			// Mock count query response
			mockDb.executeTakeFirst.mockResolvedValue({ count: '100' });

			// Mock results
			mockDb.execute.mockResolvedValue([
				{ id: 1, name: 'User 1' },
				{ id: 2, name: 'User 2' },
			]);
		});

		it('should include total count in pagination result', async () => {
			const result = await userModel.paginateWithMeta({ limit: 10, offset: 0 });

			expect(result).toHaveProperty('data');
			expect(result).toHaveProperty('meta');
			expect(result.meta).toHaveProperty('totalCount', 100);
		});

		it('should calculate pagination metadata correctly', async () => {
			const result = await userModel.paginateWithMeta({
				page: 3,
				pageSize: 10,
			});

			expect(result.meta).toHaveProperty('totalCount', 100);
			expect(result.meta).toHaveProperty('totalPages', 10);
			expect(result.meta).toHaveProperty('currentPage', 3);
			expect(result.meta).toHaveProperty('hasNextPage', true);
			expect(result.meta).toHaveProperty('hasPreviousPage', true);
		});

		it('should handle last page', async () => {
			const result = await userModel.paginateWithMeta({
				page: 10,
				pageSize: 10,
			});

			expect(result.meta).toHaveProperty('hasNextPage', false);
			expect(result.meta).toHaveProperty('hasPreviousPage', true);
		});

		it('should handle empty results', async () => {
			mockDb.executeTakeFirst.mockResolvedValue({ count: '0' });
			mockDb.execute.mockResolvedValue([]);

			const result = await userModel.paginateWithMeta({ limit: 10, offset: 0 });

			expect(result.data).toHaveLength(0);
			expect(result.meta).toHaveProperty('totalCount', 0);
		});
	});
});
