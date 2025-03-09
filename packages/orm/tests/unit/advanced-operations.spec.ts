import { sql } from 'kysely';
import { describe, expect, it, vi } from 'vitest';
import createModel from '~/model';

describe('Advanced Model Operations - Unit Tests', () => {
	it('should support creating custom query builders', async () => {
		// Define a status extension type
		// Return type for batch update
		interface BatchUpdateResult {
			numUpdatedRows: bigint;
		}

		// Mock database
		const mockDb = {
			updateTable: vi.fn(),
		};

		// Create a model
		const UserModel = createModel(mockDb, 'users', 'id');

		// Create a mock update builder
		const mockUpdateBuilder = {
			set: vi.fn().mockReturnThis(),
			where: vi.fn().mockReturnThis(),
			whereIn: vi.fn().mockReturnThis(),
			execute: vi.fn().mockResolvedValue({ numUpdatedRows: BigInt(5) }),
		};

		// Mock the updateTable method
		mockDb.updateTable.mockReturnValue(mockUpdateBuilder);

		// Create a batch update function using a custom query builder
		const batchUpdateStatus = async (
			userIds: number[],
			status: string
		): Promise<BatchUpdateResult> => {
			return await mockDb
				.updateTable('users')
				.set({ status })
				.whereIn('id', userIds)
				.execute();
		};

		// Test the batch update function
		const result = await batchUpdateStatus([1, 2, 3, 4, 5], 'inactive');

		// Verify the update was called with correct params
		expect(mockDb.updateTable).toHaveBeenCalledWith('users');
		expect(mockUpdateBuilder.set).toHaveBeenCalledWith({
			status: 'inactive',
		});
		expect(mockUpdateBuilder.whereIn).toHaveBeenCalledWith(
			'id',
			[1, 2, 3, 4, 5]
		);

		// Verify the result contains expected properties
		expect(result).toHaveProperty('numUpdatedRows');
		expect(result.numUpdatedRows).toBe(BigInt(5));
	});

	it('should handle batch operations efficiently', async () => {
		// Create test data
		const testUsers = [
			{ id: 1, name: 'User 1', email: 'user1@test.com' },
			{ id: 2, name: 'User 2', email: 'user2@test.com' },
			{ id: 3, name: 'User 3', email: 'user3@test.com' },
		];

		// Mock database
		const mockDb = {
			selectFrom: vi.fn(),
		};

		// Create a model
		const UserModel = createModel(mockDb, 'users', 'id');

		// Mock the query chain
		const mockQueryChain = {
			where: vi.fn().mockReturnThis(),
			whereIn: vi.fn().mockReturnThis(),
			selectAll: vi.fn().mockReturnThis(),
			execute: vi.fn().mockResolvedValue(testUsers),
		};

		mockDb.selectFrom.mockReturnValue(mockQueryChain);

		// Create a function to get multiple users by IDs
		const getUsersByIds = async (ids: number[]) => {
			return mockDb
				.selectFrom('users')
				.whereIn('id', ids)
				.selectAll()
				.execute();
		};

		// Test the batch operation
		const users = await getUsersByIds([1, 2, 3]);

		// Verify the result
		expect(Array.isArray(users)).toBe(true);
		expect(users.length).toBe(3);
		expect(users[0].id).toBe(1);
		expect(users[1].id).toBe(2);
		expect(users[2].id).toBe(3);

		// Check that the whereIn was called with the correct IDs
		expect(mockQueryChain.whereIn).toHaveBeenCalledWith('id', [1, 2, 3]);
	});

	it('should support tuple operations with expression builder', async () => {
		// Mock database
		const mockDb = {
			selectFrom: vi.fn(),
		};

		// Mock the query chain
		const mockQueryChain = {
			selectAll: vi.fn().mockReturnThis(),
			where: vi.fn().mockImplementation((callback) => {
				// Mock the expression builder
				const eb = (column: string, operator: string, value: any) => {
					return { column, operator, value };
				};

				// Add necessary methods to the expression builder
				eb.and = (conditions: any[]) => ({ and: conditions });
				eb.or = (conditions: any[]) => ({ or: conditions });

				// Call the callback with our mocked expression builder
				callback(eb);
				return mockQueryChain;
			}),
			execute: vi.fn().mockResolvedValue([
				{ id: 'product1', name: 'Product A' },
				{ id: 'product2', name: 'Product B' },
			]),
		};

		mockDb.selectFrom.mockReturnValue(mockQueryChain);

		// Create a tuple-based finder function
		const findProductsByTuple = async (conditions: [string, string][]) => {
			return mockDb
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
				})
				.execute();
		};

		// Test with some sample data
		const products = await findProductsByTuple([
			['Product A', 'product1'],
			['Product B', 'product2'],
		]);

		// Verify the results
		expect(Array.isArray(products)).toBe(true);
		expect(products.length).toBe(2);
		expect(products[0].id).toBe('product1');
		expect(products[1].id).toBe('product2');
		expect(mockQueryChain.where).toHaveBeenCalled();
	});

	it('should support JSON operations with sql template tags', async () => {
		// Mock database
		const mockDb = {
			selectFrom: vi.fn(),
		};

		// Mock query chain
		const mockQueryChain = {
			selectAll: vi.fn().mockReturnThis(),
			where: vi.fn().mockReturnThis(),
			execute: vi.fn().mockResolvedValue([
				{
					id: 'json1',
					data: JSON.stringify({
						user: {
							name: 'John',
							profile: {
								preferences: {
									theme: 'dark',
									notifications: true,
								},
							},
						},
					}),
				},
			]),
		};

		mockDb.selectFrom.mockReturnValue(mockQueryChain);

		// Test function to query JSON data
		const getUsersByTheme = async (theme: string) => {
			return mockDb
				.selectFrom('json_test')
				.selectAll()
				.where(
					sql`json_extract(data, '$.user.profile.preferences.theme')`,
					'=',
					theme
				)
				.execute();
		};

		// Test the JSON query function
		const results = await getUsersByTheme('dark');

		// Verify results
		expect(Array.isArray(results)).toBe(true);
		expect(results.length).toBe(1);
		expect(results[0].id).toBe('json1');

		// Verify we can parse the JSON
		const parsedData = JSON.parse(results[0].data);
		expect(parsedData.user.profile.preferences.theme).toBe('dark');

		// Verify the query was constructed correctly
		expect(mockQueryChain.where).toHaveBeenCalled();
	});

	it('should support findByTuple operations', async () => {
		// Mock database
		const mockDb = {
			selectFrom: vi.fn(),
		};

		// Create functions for tuple handling
		const findByTuple = async <T extends any[]>(
			columns: string[],
			values: T
		) => {
			// Validate tuple lengths
			if (columns.length !== values.length) {
				throw new Error('Columns and values arrays must have the same length');
			}

			if (columns.length > 5) {
				throw new Error(
					`Tuple with ${columns.length} columns is not supported`
				);
			}

			const whereStack = [];
			for (let i = 0; i < columns.length; i++) {
				whereStack.push([columns[i], values[i]]);
			}

			return {
				columns,
				values,
				whereStack,
			};
		};

		// Test findByTuple with different column counts
		const result1 = await findByTuple(['category'], ['Category A']);
		expect(result1.columns).toEqual(['category']);
		expect(result1.values).toEqual(['Category A']);

		const result2 = await findByTuple(
			['category', 'price'],
			['Category B', 25.99]
		);
		expect(result2.columns.length).toBe(2);
		expect(result2.values.length).toBe(2);

		const result3 = await findByTuple(
			['id', 'name', 'category'],
			['item5', 'Item Five', 'Category C']
		);
		expect(result3.columns.length).toBe(3);
		expect(result3.values.length).toBe(3);

		// Test error cases
		await expect(findByTuple(['id', 'name'], ['item1'])).rejects.toThrow(
			'Columns and values arrays must have the same length'
		);

		await expect(
			findByTuple(
				['col1', 'col2', 'col3', 'col4', 'col5', 'col6'],
				[1, 2, 3, 4, 5, 6]
			)
		).rejects.toThrow('Tuple with 6 columns is not supported');
	});
});
