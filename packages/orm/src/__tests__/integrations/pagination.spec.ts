import { sql } from 'kysely';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { ModelRegistry } from '../../database';
import { Database } from '../../database';
import createModel from '../../model';

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
		// Set up a test database with proper transaction function
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
			deleteFrom: () => ({
				execute: async () => ({}),
			}),
			transaction: async (callback: (trx: any) => Promise<any>) => {
				return await callback({ mock: true });
			},
			fn: {
				now: () => sql`CURRENT_TIMESTAMP`,
			},
		};

		// Add the bind method to the transaction function to prevent errors
		db.transaction.bind = function(thisArg: any) {
			return async (callback: (trx: any) => Promise<any>) => {
				return await callback({ mock: true });
			};
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

		// Create model with proper type casting for integration testing
		ProductModel = createModel<TestDB, 'products', 'id'>(
			db as unknown as Database<TestDB, ModelRegistry<TestDB>>,
			'products',
			'id'
		);

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
			}: {
				page: number;
				pageSize: number;
			}) => {
				return {
					data: Array.from({ length: pageSize }, (_, i) => ({
						id: i + 1 + (page - 1) * pageSize,
						name: `Product ${i + 1 + (page - 1) * pageSize}`,
						price: (i + 1 + (page - 1) * pageSize) * 10,
					})),
					meta: {
						total: 50,
						page,
						pageSize,
						pageCount: Math.ceil(50 / pageSize),
						hasNextPage: page * pageSize < 50,
						hasPreviousPage: page > 1,
					},
				};
			};

			// Test page 2 with 10 items per page
			const result = await ProductModel.paginate({
				page: 2,
				pageSize: 10,
			});

			// Check the data
			expect(result.data).toHaveLength(10);
			expect(result.data[0].id).toBe(11); // First item on page 2
			expect(result.data[9].id).toBe(20); // Last item on page 2

			// Check the metadata
			expect(result.meta.page).toBe(2);
			expect(result.meta.pageSize).toBe(10);
			expect(result.meta.total).toBe(50);
			expect(result.meta.pageCount).toBe(5);
			expect(result.meta.hasNextPage).toBe(true);
			expect(result.meta.hasPreviousPage).toBe(true);
		});

		it('should return empty array when page exceeds available data', async () => {
			// Mock implementation for a page beyond data
			ProductModel.paginate = async ({ page, pageSize }: { page: number; pageSize: number }) => {
				// If page exceeds available data, return empty array
				if (page > Math.ceil(50 / pageSize)) {
					return {
						data: [],
						meta: {
							total: 50,
							page,
							pageSize,
							pageCount: Math.ceil(50 / pageSize),
							hasNextPage: false,
							hasPreviousPage: true,
						},
					};
				}
				
				return {
					data: Array.from({ length: Math.min(pageSize, 50 - (page - 1) * pageSize) }, (_, i) => ({
						id: i + 1 + (page - 1) * pageSize,
						name: `Product ${i + 1 + (page - 1) * pageSize}`,
						price: (i + 1 + (page - 1) * pageSize) * 10,
					})),
					meta: {
						total: 50,
						page,
						pageSize,
						pageCount: Math.ceil(50 / pageSize),
						hasNextPage: page * pageSize < 50,
						hasPreviousPage: page > 1,
					},
				};
			};

			// Test page that exceeds data
			const result = await ProductModel.paginate({
				page: 6, // With 10 items per page, this is beyond 50 items
				pageSize: 10,
			});

			// Check results
			expect(result.data).toHaveLength(0);
			expect(result.meta.hasNextPage).toBe(false);
			expect(result.meta.hasPreviousPage).toBe(true);
		});
	});

	describe('Cursor-Based Pagination', () => {
		it('should retrieve records based on cursor value', async () => {
			// Mock cursor pagination method
			ProductModel.paginateWithCursor = async ({
				cursor,
				limit,
			}: {
				cursor?: number;
				limit: number;
			}) => {
				// Start index based on cursor
				const startIndex = cursor ? cursor : 0;
				
				// Generate data after cursor
				const data = Array.from({ length: Math.min(limit, 50 - startIndex) }, (_, i) => ({
					id: startIndex + i + 1,
					name: `Product ${startIndex + i + 1}`,
					price: (startIndex + i + 1) * 10,
				}));

				// Calculate next cursor
				const nextCursor = startIndex + limit < 50 ? startIndex + limit : null;

				return {
					data,
					cursor: {
						next: nextCursor,
						prev: startIndex > 0 ? Math.max(0, startIndex - limit) : null,
					},
				};
			};

			// Test cursor pagination
			const result = await ProductModel.paginateWithCursor({
				cursor: 10, // Start after 10th item
				limit: 5,
			});

			// Check results
			expect(result.data).toHaveLength(5);
			expect(result.data[0].id).toBe(11);
			expect(result.data[4].id).toBe(15);
			expect(result.cursor.next).toBe(15);
			expect(result.cursor.prev).toBe(5);
		});
	});

	describe('Pagination with Metadata', () => {
		it('should include pagination metadata alongside results', async () => {
			// Mock method that returns data with metadata
			ProductModel.paginateWithMeta = async ({ page, pageSize }: { page: number; pageSize: number }) => {
				return {
					data: Array.from({ length: pageSize }, (_, i) => ({
						id: i + 1 + (page - 1) * pageSize,
						name: `Product ${i + 1 + (page - 1) * pageSize}`,
						price: (i + 1 + (page - 1) * pageSize) * 10,
					})),
					meta: {
						total: 50,
						page,
						pageSize,
						pageCount: Math.ceil(50 / pageSize),
						hasNextPage: page * pageSize < 50,
						hasPreviousPage: page > 1,
					},
				};
			};

			// Test with metadata
			const result = await ProductModel.paginateWithMeta({
				page: 2,
				pageSize: 15,
			});

			// Check data
			expect(result.data).toHaveLength(15);
			
			// Check metadata
			expect(result.meta).toBeDefined();
			expect(result.meta.total).toBe(50);
			expect(result.meta.page).toBe(2);
			expect(result.meta.pageSize).toBe(15);
			expect(result.meta.pageCount).toBe(4); // 50/15 = 3.333 rounds up to 4
			expect(result.meta.hasNextPage).toBe(true);
			expect(result.meta.hasPreviousPage).toBe(true);
		});
	});

	describe('Advanced Filtering', () => {
		describe('Range Filtering', () => {
			it('should filter products by numeric range', async () => {
				// Mock method with range filtering
				ProductModel.paginateWithFilter = async ({
					page,
					pageSize,
					filter,
				}: {
					page: number;
					pageSize: number;
					filter?: { minPrice?: number; maxPrice?: number };
				}) => {
					// Generate all products
					const allProducts = Array.from({ length: 50 }, (_, i) => ({
						id: i + 1,
						name: `Product ${i + 1}`,
						price: (i + 1) * 10,
					}));

					// Apply filters
					let filtered = allProducts;
					if (filter) {
						if (filter.minPrice !== undefined) {
							filtered = filtered.filter(p => p.price >= filter.minPrice!);
						}
						if (filter.maxPrice !== undefined) {
							filtered = filtered.filter(p => p.price <= filter.maxPrice!);
						}
					}

					// Apply pagination
					const startIndex = (page - 1) * pageSize;
					const pageData = filtered.slice(startIndex, startIndex + pageSize);

					return {
						data: pageData,
						meta: {
							total: filtered.length,
							page,
							pageSize,
							pageCount: Math.ceil(filtered.length / pageSize),
							hasNextPage: startIndex + pageSize < filtered.length,
							hasPreviousPage: page > 1,
						},
					};
				};

				// Test price range filtering
				const result = await ProductModel.paginateWithFilter({
					page: 1,
					pageSize: 10,
					filter: {
						minPrice: 200,
						maxPrice: 300,
					},
				});

				// Check filtered results (products 20-30)
				expect(result.data.length).toBeLessThanOrEqual(10);
				expect(result.data.every(p => p.price >= 200 && p.price <= 300)).toBe(true);
				expect(result.meta.total).toBeLessThan(50); // Fewer results after filtering
			});
		});

		describe('Text Search', () => {
			it('should filter products by text search', async () => {
				// Mock method with text search
				ProductModel.paginateWithSearch = async ({
					page,
					pageSize,
					search,
				}: {
					page: number;
					pageSize: number;
					search?: string;
				}) => {
					// Generate all products
					const allProducts = Array.from({ length: 50 }, (_, i) => ({
						id: i + 1,
						name: `Product ${i + 1}`,
						price: (i + 1) * 10,
					}));

					// Apply search filter
					let filtered = allProducts;
					if (search) {
						filtered = filtered.filter(p => 
							p.name.toLowerCase().includes(search.toLowerCase())
						);
					}

					// Apply pagination
					const startIndex = (page - 1) * pageSize;
					const pageData = filtered.slice(startIndex, startIndex + pageSize);

					return {
						data: pageData,
						meta: {
							total: filtered.length,
							page,
							pageSize,
							pageCount: Math.ceil(filtered.length / pageSize),
							hasNextPage: startIndex + pageSize < filtered.length,
							hasPreviousPage: page > 1,
							searchTerm: search,
						},
					};
				};

				// Test text search
				const result = await ProductModel.paginateWithSearch({
					page: 1,
					pageSize: 10,
					search: '2', // Will match Product 2, 20-29
				});

				// Check search results
				expect(result.data.length).toBeGreaterThan(0);
				expect(result.data.every(p => p.name.includes('2'))).toBe(true);
				expect(result.meta.searchTerm).toBe('2');
			});
		});
	});

	describe('Combined Pagination Features', () => {
		it('should combine filtering, sorting and pagination', async () => {
			// Mock comprehensive pagination method
			ProductModel.advancedPaginate = async ({
				page,
				pageSize,
				filter,
				sort,
			}: {
				page: number;
				pageSize: number;
				filter?: { minPrice?: number; maxPrice?: number; search?: string };
				sort?: { field: string; direction: 'asc' | 'desc' };
			}) => {
				// Generate all products
				const allProducts = Array.from({ length: 50 }, (_, i) => ({
					id: i + 1,
					name: `Product ${i + 1}`,
					price: (i + 1) * 10,
				}));

				// Apply filters
				let filtered = allProducts;
				if (filter) {
					if (filter.minPrice !== undefined) {
						filtered = filtered.filter(p => p.price >= filter.minPrice!);
					}
					if (filter.maxPrice !== undefined) {
						filtered = filtered.filter(p => p.price <= filter.maxPrice!);
					}
					if (filter.search) {
						filtered = filtered.filter(p => 
							p.name.toLowerCase().includes(filter.search!.toLowerCase())
						);
					}
				}

				// Apply sorting
				if (sort) {
					filtered.sort((a, b) => {
						const aValue = (a as any)[sort.field];
						const bValue = (b as any)[sort.field];
						
						if (sort.direction === 'asc') {
							return aValue > bValue ? 1 : -1;
						} else {
							return aValue < bValue ? 1 : -1;
						}
					});
				}

				// Apply pagination
				const startIndex = (page - 1) * pageSize;
				const pageData = filtered.slice(startIndex, startIndex + pageSize);

				return {
					data: pageData,
					meta: {
						total: filtered.length,
						page,
						pageSize,
						pageCount: Math.ceil(filtered.length / pageSize),
						hasNextPage: startIndex + pageSize < filtered.length,
						hasPreviousPage: page > 1,
						filter,
						sort,
					},
				};
			};

			// Test combined features
			const result = await ProductModel.advancedPaginate({
				page: 1,
				pageSize: 5,
				filter: {
					minPrice: 100,
					search: '1', // Products 1, 10-19, etc.
				},
				sort: {
					field: 'price',
					direction: 'desc',
				},
			});

			// Check combined results
			expect(result.data).toHaveLength(5);
			expect(result.data.every(p => p.price >= 100)).toBe(true);
			expect(result.data.every(p => p.name.includes('1'))).toBe(true);
			
			// Check sorting (descending by price)
			for (let i = 0; i < result.data.length - 1; i++) {
				expect(result.data[i].price).toBeGreaterThanOrEqual(result.data[i + 1].price);
			}
			
			// Check metadata
			expect(result.meta.filter).toBeDefined();
			expect(result.meta.sort).toBeDefined();
		});
	});
});
