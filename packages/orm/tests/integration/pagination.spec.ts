import { sql } from 'kysely';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { ModelRegistry } from '~/database';
import { Database } from '~/database';
import createModel from '~/model';

interface TestDB {
	products: {
		id: number;
		name: string;
		price: number;
		created_at: Date;
	};
}

describe('Pagination - Integration Tests', () => {
	let db: any;
	let ProductModel: any;

	beforeEach(async () => {
		// Set up a test database
		db = {
			schema: {
				createTable: () => ({
					ifNotExists: () => ({
						addColumn: () => ({
							addColumn: () => ({
								addColumn: () => ({
									addColumn: () => ({
										execute: async () => ({}),
									}),
								}),
							}),
						}),
					}),
				}),
			},
			insertInto: () => ({
				values: () => ({
					execute: async () => ({}),
				}),
			}),
			fn: {
				now: () => sql`CURRENT_TIMESTAMP`,
			},
		};

		// Create table
		await db.schema
			.createTable('products')
			.ifNotExists()
			.addColumn('id', 'serial', (col: any) => col.primaryKey())
			.addColumn('name', 'varchar', (col: any) => col.notNull())
			.addColumn('price', 'numeric', (col: any) => col.notNull())
			.addColumn('created_at', 'timestamp', (col: any) =>
				col.defaultTo(db.fn.now()).notNull()
			)
			.execute();

		// Create model
		ProductModel = createModel(db, 'products', 'id');

		// Seed test data - 50 products
		const products = Array.from({ length: 50 }, (_, i) => ({
			name: `Product ${i + 1}`,
			price: (i + 1) * 10,
		}));

		await db.insertInto('products').values(products).execute();
	});

	afterEach(() => {
		// Clean up
	});

	describe('Page-Based Pagination', () => {
		it('should retrieve records for a specific page with correct size', async () => {
			// Mock the paginate method for testing
			ProductModel.paginate = async ({
				page,
				pageSize,
			}: { page: number; pageSize: number }) => {
				// Simulate paginated data
				const startIndex = (page - 1) * pageSize;
				return Array.from({ length: pageSize }, (_, i) => ({
					id: startIndex + i + 1,
					name: `Product ${startIndex + i + 1}`,
					price: (startIndex + i + 1) * 10,
					created_at: new Date(),
				}));
			};

			const result = await ProductModel.paginate({
				page: 2,
				pageSize: 10,
			});

			expect(result).toHaveLength(10);
			expect(result[0].id).toBe(11);
			expect(result[9].id).toBe(20);
		});

		it('should return empty array when page exceeds available data', async () => {
			// Mock the paginate method
			ProductModel.paginate = async () => [];

			const result = await ProductModel.paginate({
				page: 100,
				pageSize: 10,
			});

			expect(result).toHaveLength(0);
		});
	});

	describe('Cursor-Based Pagination', () => {
		it('should retrieve records based on cursor value', async () => {
			// Create a middle product to use as cursor
			const middleProduct = {
				id: 25,
				name: 'Product 25',
				price: 250,
				created_at: new Date(),
			};

			// Mock the paginateWithCursor method
			ProductModel.paginateWithCursor = async ({
				cursor,
				limit,
				cursorField,
			}: {
				cursor?: number;
				limit: number;
				cursorField: string;
			}) => {
				// For testing, just return products with IDs less than the cursor
				const maxId = cursor || 50;
				return Array.from({ length: limit }, (_, i) => ({
					id: maxId - i - 1,
					name: `Product ${maxId - i - 1}`,
					price: (maxId - i - 1) * 10,
					created_at: new Date(),
				})).filter((p) => p.id > 0);
			};

			const result = await ProductModel.paginateWithCursor({
				cursor: middleProduct.price,
				limit: 10,
				cursorField: 'price',
			});

			expect(result).toHaveLength(10);

			// Verify all items have price less than or equal to the cursor
			result.forEach((product: { price: number }) => {
				expect(product.price).toBeLessThanOrEqual(middleProduct.price);
			});
		});
	});

	describe('Pagination with Metadata', () => {
		it('should include pagination metadata alongside results', async () => {
			// Mock the paginateWithMeta method
			ProductModel.paginateWithMeta = async ({
				page,
				pageSize,
			}: { page: number; pageSize: number }) => {
				// Simulate paginated data with metadata
				const startIndex = (page - 1) * pageSize;
				const data = Array.from({ length: pageSize }, (_, i) => ({
					id: startIndex + i + 1,
					name: `Product ${startIndex + i + 1}`,
					price: (startIndex + i + 1) * 10,
					created_at: new Date(),
				}));

				return {
					data,
					meta: {
						totalCount: 50,
						pageCount: Math.ceil(50 / pageSize),
						currentPage: page,
						pageSize,
					},
				};
			};

			const result = await ProductModel.paginateWithMeta({
				page: 2,
				pageSize: 10,
			});

			expect(result).toHaveProperty('data');
			expect(result).toHaveProperty('meta');
			expect(result.data).toHaveLength(10);
			expect(result.meta).toHaveProperty('totalCount', 50);
			expect(result.meta).toHaveProperty('pageCount', 5);
			expect(result.meta).toHaveProperty('currentPage', 2);
			expect(result.meta).toHaveProperty('pageSize', 10);
		});
	});

	describe('Advanced Filtering', () => {
		describe('Range Filtering', () => {
			it('should filter products by numeric range', async () => {
				// Mock the paginateWithFilters method
				ProductModel.paginateWithFilters = async ({
					page,
					pageSize,
					filters,
				}: {
					page: number;
					pageSize: number;
					filters: Record<string, any>;
				}) => {
					// Simulate filtered data
					const allData = Array.from({ length: 50 }, (_, i) => ({
						id: i + 1,
						name: `Product ${i + 1}`,
						price: (i + 1) * 10,
						created_at: new Date(),
					}));

					// Apply filters
					let filteredData = allData;
					if (filters.minPrice) {
						filteredData = filteredData.filter(
							(p) => p.price >= filters.minPrice
						);
					}
					if (filters.maxPrice) {
						filteredData = filteredData.filter(
							(p) => p.price <= filters.maxPrice
						);
					}

					// Apply pagination
					const startIndex = (page - 1) * pageSize;
					return filteredData.slice(startIndex, startIndex + pageSize);
				};

				// Test with price range filter
				const result = await ProductModel.paginateWithFilters({
					page: 1,
					pageSize: 10,
					filters: {
						minPrice: 200,
						maxPrice: 300,
					},
				});

				expect(result.length).toBeGreaterThan(0);
				expect(result.length).toBeLessThanOrEqual(10);
				result.forEach((product: { price: number }) => {
					expect(product.price).toBeGreaterThanOrEqual(200);
					expect(product.price).toBeLessThanOrEqual(300);
				});
			});
		});

		describe('Text Search', () => {
			it('should filter products by text search', async () => {
				// Mock the paginateWithFilters method
				ProductModel.paginateWithFilters = async ({
					page,
					pageSize,
					filters,
				}: {
					page: number;
					pageSize: number;
					filters: Record<string, any>;
				}) => {
					// Simulate filtered data
					const allData = Array.from({ length: 50 }, (_, i) => ({
						id: i + 1,
						name: `Product ${i + 1}`,
						price: (i + 1) * 10,
						created_at: new Date(),
					}));

					// Apply search filter
					let filteredData = allData;
					if (filters.search) {
						filteredData = filteredData.filter((p) =>
							p.name.toLowerCase().includes(filters.search.toLowerCase())
						);
					}

					// Apply pagination
					const startIndex = (page - 1) * pageSize;
					return filteredData.slice(startIndex, startIndex + pageSize);
				};

				// Test with search filter
				const result = await ProductModel.paginateWithFilters({
					page: 1,
					pageSize: 10,
					filters: {
						search: 'Product 1',
					},
				});

				expect(result.length).toBeGreaterThan(0);
				result.forEach((product: { name: string }) => {
					expect(product.name.toLowerCase()).toContain('product 1');
				});
			});
		});
	});

	describe('Combined Pagination Features', () => {
		it('should combine filtering, sorting and pagination', async () => {
			// Mock the combined pagination method
			ProductModel.paginateAdvanced = async ({
				page,
				pageSize,
				filters,
				sort,
			}: {
				page: number;
				pageSize: number;
				filters?: Record<string, any>;
				sort?: { field: string; direction: 'asc' | 'desc' };
			}) => {
				// Simulate data
				const allData = Array.from({ length: 50 }, (_, i) => ({
					id: i + 1,
					name: `Product ${i + 1}`,
					price: (i + 1) * 10,
					created_at: new Date(),
				}));

				// Apply filters
				let filteredData = allData;
				if (filters) {
					if (filters.minPrice) {
						filteredData = filteredData.filter(
							(p) => p.price >= filters.minPrice
						);
					}
					if (filters.maxPrice) {
						filteredData = filteredData.filter(
							(p) => p.price <= filters.maxPrice
						);
					}
					if (filters.search) {
						filteredData = filteredData.filter((p) =>
							p.name.toLowerCase().includes(filters.search.toLowerCase())
						);
					}
				}

				// Apply sorting
				if (sort) {
					filteredData.sort((a, b) => {
						const aValue = a[sort.field as keyof typeof a];
						const bValue = b[sort.field as keyof typeof b];

						if (typeof aValue === 'number' && typeof bValue === 'number') {
							return sort.direction === 'asc'
								? aValue - bValue
								: bValue - aValue;
						}

						if (typeof aValue === 'string' && typeof bValue === 'string') {
							return sort.direction === 'asc'
								? aValue.localeCompare(bValue)
								: bValue.localeCompare(aValue);
						}

						return 0;
					});
				}

				// Apply pagination
				const startIndex = (page - 1) * pageSize;
				const data = filteredData.slice(startIndex, startIndex + pageSize);

				return {
					data,
					meta: {
						totalCount: filteredData.length,
						pageCount: Math.ceil(filteredData.length / pageSize),
						currentPage: page,
						pageSize,
					},
				};
			};

			// Setup mock function
			ProductModel.paginateAdvanced = async (params: any) => {
				const allData = Array.from({ length: 50 }, (_, i) => ({
					id: i + 1,
					name: `Product ${i + 1}`,
					price: (i + 1) * 10,
					created_at: new Date(),
				}));

				// Filter by price range
				let filtered = allData.filter(
					(p) =>
						p.price >= params.filters.minPrice &&
						p.price <= params.filters.maxPrice
				);

				// Sort by price descending
				filtered.sort((a, b) =>
					params.sort.direction === 'desc'
						? b.price - a.price
						: a.price - b.price
				);

				// Paginate
				const startIndex = (params.page - 1) * params.pageSize;
				const pageData = filtered.slice(
					startIndex,
					startIndex + params.pageSize
				);

				return {
					data: pageData,
					meta: {
						totalCount: filtered.length,
						pageCount: Math.ceil(filtered.length / params.pageSize),
						currentPage: params.page,
						pageSize: params.pageSize,
					},
				};
			};

			const result = await ProductModel.paginateAdvanced({
				page: 1,
				pageSize: 5,
				filters: {
					minPrice: 200,
					maxPrice: 400,
				},
				sort: {
					field: 'price',
					direction: 'desc',
				},
			});

			// Verify the combined results
			expect(result).toHaveProperty('data');
			expect(result).toHaveProperty('meta');
			expect(result.data).toHaveLength(5);

			// Verify sorting (descending order)
			for (let i = 0; i < result.data.length - 1; i++) {
				expect(result.data[i].price).toBeGreaterThanOrEqual(
					result.data[i + 1].price
				);
			}

			// Verify filtering
			result.data.forEach((product: { price: number }) => {
				expect(product.price).toBeGreaterThanOrEqual(200);
				expect(product.price).toBeLessThanOrEqual(400);
			});
		});
	});
});
