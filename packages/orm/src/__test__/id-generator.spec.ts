import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { db, resetDatabase, toSqliteDate } from './utils/migration';

// Product model implementation specific to this test
const ProductModel = {
	getGlobalId: (id: string) => `PRD_${id}`,
	parseGlobalId: (globalId: string) => {
		if (!globalId || typeof globalId !== 'string') {
			return null;
		}
		if (globalId.startsWith('PRD_')) {
			return globalId.substring(4);
		}
		return globalId;
	},
	insertTable: () => db.db.insertInto('products'),
	selectFrom: () => db.db.selectFrom('products'),
	// Use a counter to ensure unique IDs
	_counter: 0,
	insertWithGlobalId: async function (data: any) {
		// Use counter to ensure unique ID
		this._counter++;
		const numericId = `${Date.now()}_${this._counter}`;
		const globalId = this.getGlobalId(numericId);

		const result = await this.insertTable()
			.values({
				...data,
				id: globalId,
				createdAt: toSqliteDate(data.createdAt || new Date()),
				updatedAt: toSqliteDate(data.updatedAt || new Date()),
			})
			// Specify columns explicitly instead of using returning('*')
			.returning(['id', 'name', 'createdAt', 'updatedAt'])
			.executeTakeFirst();

		return result;
	},
};

describe('ID Generator Integration', () => {
	// Reset the database before each test
	beforeEach(async () => {
		await resetDatabase();
		// Reset counter for each test
		ProductModel._counter = 0;
	});

	// Reset the database after each test to avoid affecting other tests
	afterEach(async () => {
		await resetDatabase();
	});

	it('should generate IDs with the configured prefix', async () => {
		try {
			// Test ID generation
			const id = ProductModel.getGlobalId('12345');
			expect(id).toBe('PRD_12345');

			// Test ID parsing
			const parsed = ProductModel.parseGlobalId('PRD_12345');
			expect(parsed).toBe('12345');

			// Test with invalid inputs
			expect(ProductModel.parseGlobalId('')).toBeNull();
			expect(ProductModel.parseGlobalId(null as any)).toBeNull();

			// Test with non-matching prefix
			expect(ProductModel.parseGlobalId('ABC_12345')).toBe('ABC_12345');
		} catch (error) {
			console.error('ID generation test error:', error);
			throw error;
		}
	});

	it('should auto-generate IDs when inserting data', async () => {
		try {
			// Insert a product with auto-generated ID
			const product = await ProductModel.insertWithGlobalId({
				name: 'Test Product',
			});

			// Verify the product was created with a global ID
			expect(product).toBeDefined();
			expect(product?.id).toBeDefined();
			expect(product?.id.startsWith('PRD_')).toBe(true);

			// Check that we can query the product
			if (product?.id) {
				const fetchedProduct = await ProductModel.selectFrom()
					.where('id', '=', product.id as any)
					.selectAll()
					.executeTakeFirst();

				expect(fetchedProduct).toBeDefined();
				expect(fetchedProduct?.id).toBe(product.id);
				expect(fetchedProduct?.name).toBe('Test Product');
			} else {
				expect(product).not.toBeNull();
				expect(product?.id).toBeDefined();
			}
		} catch (error) {
			console.error('Auto-ID generation test error:', error);
			throw error;
		}
	});

	it('should provide a convenient way to insert with generated IDs', async () => {
		try {
			// Insert a batch of products with auto-generated IDs
			const products: any[] = [];

			for (let i = 1; i <= 3; i++) {
				const product = await ProductModel.insertWithGlobalId({
					name: `Batch Product ${i}`,
				});
				products.push(product);

				// Add a small delay to ensure unique timestamps
				await new Promise((resolve) => setTimeout(resolve, 10));
			}

			// Verify all products were created with global IDs
			expect(products).toHaveLength(3);

			for (const product of products) {
				expect(product?.id.startsWith('PRD_')).toBe(true);
			}

			// Check that we can query all the products
			const retrievedProducts = await ProductModel.selectFrom()
				.where('name', 'like', 'Batch Product%')
				.selectAll()
				.execute();

			expect(retrievedProducts).toHaveLength(3);
		} catch (error) {
			console.error('Batch ID generation test error:', error);
			throw error;
		}
	});
});
