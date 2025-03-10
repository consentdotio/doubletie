// tests/e2e/transactions.spec.ts

import type { Kysely } from 'kysely';
import { sql } from 'kysely';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import createModel from '~/model';
import { setupRealDatabase, teardownRealDatabase } from '../fixtures/test-db';

// Test database schema
interface TestDB {
	users: {
		id: number;
		name: string;
		email: string;
	};
	products: {
		id: number;
		name: string;
		price: number;
		stock: number;
	};
	orders: {
		id: number;
		user_id: number;
		total: number;
		status: string;
		created_at: Date;
	};
	order_items: {
		id: number;
		order_id: number;
		product_id: number;
		quantity: number;
		price: number;
	};
}

describe('e2e: complex transaction scenarios', () => {
	let db: Kysely<TestDB>;
	let UserModel: any;
	let ProductModel: any;
	let OrderModel: any;
	let OrderItemModel: any;

	beforeEach(async () => {
		// Set up test database
		db = (await setupRealDatabase()) as Kysely<TestDB>;

		// Create test tables
		await db.schema
			.createTable('users')
			.addColumn('id', 'serial', (col) => col.primaryKey())
			.addColumn('name', 'varchar(255)', (col) => col.notNull())
			.addColumn('email', 'varchar(255)', (col) => col.unique().notNull())
			.execute();

		await db.schema
			.createTable('products')
			.addColumn('id', 'serial', (col) => col.primaryKey())
			.addColumn('name', 'varchar(255)', (col) => col.notNull())
			.addColumn('price', 'numeric', (col) => col.notNull())
			.addColumn('stock', 'integer', (col) => col.notNull())
			.execute();

		await db.schema
			.createTable('orders')
			.addColumn('id', 'serial', (col) => col.primaryKey())
			.addColumn('user_id', 'integer', (col) =>
				col.references('users.id').onDelete('cascade').notNull()
			)
			.addColumn('total', 'numeric', (col) => col.notNull())
			.addColumn('status', 'varchar(50)', (col) => col.notNull())
			.addColumn('created_at', 'timestamp', (col) =>
				col.defaultTo(db.fn.now()).notNull()
			)
			.execute();

		await db.schema
			.createTable('order_items')
			.addColumn('id', 'serial', (col) => col.primaryKey())
			.addColumn('order_id', 'integer', (col) =>
				col.references('orders.id').onDelete('cascade').notNull()
			)
			.addColumn('product_id', 'integer', (col) =>
				col.references('products.id').onDelete('restrict').notNull()
			)
			.addColumn('quantity', 'integer', (col) => col.notNull())
			.addColumn('price', 'numeric', (col) => col.notNull())
			.execute();

		// Create models
		UserModel = createModel<TestDB, 'users', 'id'>(db, 'users', 'id');
		ProductModel = createModel<TestDB, 'products', 'id'>(db, 'products', 'id');
		OrderModel = createModel<TestDB, 'orders', 'id'>(db, 'orders', 'id');
		OrderItemModel = createModel<TestDB, 'order_items', 'id'>(
			db,
			'order_items',
			'id'
		);

		// Seed with test data
		await UserModel.insertInto()
			.values([
				{ id: 1, name: 'Customer One', email: 'customer1@example.com' },
				{ id: 2, name: 'Customer Two', email: 'customer2@example.com' },
			])
			.execute();

		await ProductModel.insertInto()
			.values([
				{ id: 1, name: 'Product A', price: 10.99, stock: 100 },
				{ id: 2, name: 'Product B', price: 24.99, stock: 50 },
				{ id: 3, name: 'Product C', price: 5.99, stock: 200 },
			])
			.execute();
	});

	afterEach(async () => {
		await teardownRealDatabase(db);
	});

	it.skip('should process an order with multiple items in a transaction', async () => {
		// Create a function to place an order
		const placeOrder = async (
			userId: number,
			items: Array<{ productId: number; quantity: number }>
		) => {
			return db.transaction().execute(async (trx) => {
				// Fetch the products to get their prices and check stock
				const productIds = items.map((item) => item.productId);
				const products = await trx
					.selectFrom('products')
					.where('id', 'in', productIds)
					.execute();

				// Create a map of products by id for easy lookup
				const productsById = new Map(
					products.map((product) => [product.id, product])
				);

				// Check stock and calculate total
				let orderTotal = 0;
				for (const item of items) {
					const product = productsById.get(item.productId);
					if (!product) throw new Error(`Product ${item.productId} not found`);
					if (product.stock < item.quantity)
						throw new Error(`Insufficient stock for product ${item.productId}`);

					orderTotal += product.price * item.quantity;
				}

				// Create the order
				const orderResult = await trx
					.insertInto('orders')
					.values({
						user_id: userId,
						total: orderTotal,
						status: 'pending',
					})
					.returning(['id'])
					.executeTakeFirst();

				if (!orderResult || !orderResult.id)
					throw new Error('Failed to create order');

				// Create order items
				const orderItems = items.map((item) => {
					const product = productsById.get(item.productId)!;
					return {
						order_id: orderResult.id,
						product_id: item.productId,
						quantity: item.quantity,
						price: product.price,
					};
				});

				await trx.insertInto('order_items').values(orderItems).execute();

				// Update product stock
				for (const item of items) {
					await trx
						.updateTable('products')
						.set({
							stock: sql`stock - ${item.quantity}`,
						})
						.where('id', '=', item.productId)
						.execute();
				}

				// Return the created order with items
				const order = await trx
					.selectFrom('orders')
					.where('id', '=', orderResult.id)
					.executeTakeFirst();

				const orderItemsResult = await trx
					.selectFrom('order_items')
					.where('order_id', '=', orderResult.id)
					.execute();

				return {
					order,
					items: orderItemsResult,
				};
			});
		};

		// Place an order
		const orderResult = await placeOrder(1, [
			{ productId: 1, quantity: 2 },
			{ productId: 3, quantity: 5 },
		]);

		// Verify order was created correctly
		expect(orderResult.order).toHaveProperty('id');
		expect(orderResult.order.total).toBe(10.99 * 2 + 5.99 * 5);
		expect(orderResult.order.user_id).toBe(1);
		expect(orderResult.order.status).toBe('pending');

		// Verify order items
		expect(orderResult.items).toHaveLength(2);

		// Verify product stock was updated
		const product1 = await ProductModel.findById(1);
		const product3 = await ProductModel.findById(3);

		expect(product1.stock).toBe(98);
		expect(product3.stock).toBe(195);
	});

	it.skip('should rollback order if stock is insufficient', async () => {
		// Get initial stock
		const initialProduct2 = await ProductModel.findById(2);

		// Try to place an order with more items than stock
		try {
			await db.transaction().execute(async (trx) => {
				// Create the order
				const orderResult = await trx
					.insertInto('orders')
					.values({
						user_id: 2,
						total: 24.99 * 100,
						status: 'pending',
					})
					.returning(['id'])
					.executeTakeFirst();

				// Create order item
				await trx
					.insertInto('order_items')
					.values({
						order_id: orderResult!.id,
						product_id: 2,
						quantity: 100, // Only 50 in stock
						price: 24.99,
					})
					.execute();

				// Update product stock - will fail due to check
				if (initialProduct2.stock < 100) {
					throw new Error('Insufficient stock');
				}

				await trx
					.updateTable('products')
					.set({
						stock: sql`stock - ${100}`,
					})
					.where('id', '=', 2)
					.execute();
			});

			fail('Should have thrown an error');
		} catch (error) {
			expect(error.message).toBe('Insufficient stock');
		}

		// Verify order was not created
		const orders = await OrderModel.selectFrom().execute();
		expect(orders).toHaveLength(0);

		// Verify product stock was not changed
		const product2 = await ProductModel.findById(2);
		expect(product2.stock).toBe(initialProduct2.stock);
	});

	it.skip('should perform a complete order cycle with multiple updates in a transaction', async () => {
		// Create order processing function
		const processOrderCycle = async (
			userId: number,
			items: Array<{ productId: number; quantity: number }>
		) => {
			// 1. Place the order
			const placedOrder = await db.transaction().execute(async (trx) => {
				// Calculate total
				let total = 0;
				for (const item of items) {
					const product = await trx
						.selectFrom('products')
						.where('id', '=', item.productId)
						.executeTakeFirst();

					if (!product) throw new Error(`Product ${item.productId} not found`);
					total += product.price * item.quantity;
				}

				// Create order
				const orderResult = await trx
					.insertInto('orders')
					.values({
						user_id: userId,
						total,
						status: 'created',
					})
					.returning(['*'])
					.executeTakeFirst();

				return orderResult;
			});

			// 2. Add items to the order
			const orderWithItems = await db.transaction().execute(async (trx) => {
				const orderItems = [];

				// Add each item
				for (const item of items) {
					const product = await trx
						.selectFrom('products')
						.where('id', '=', item.productId)
						.executeTakeFirst();

					if (!product) throw new Error(`Product ${item.productId} not found`);

					// Add order item
					const orderItem = await trx
						.insertInto('order_items')
						.values({
							order_id: placedOrder!.id,
							product_id: item.productId,
							quantity: item.quantity,
							price: product.price,
						})
						.returning(['*'])
						.executeTakeFirst();

					orderItems.push(orderItem);
				}

				// Update order status
				await trx
					.updateTable('orders')
					.set({ status: 'pending' })
					.where('id', '=', placedOrder!.id)
					.execute();

				return {
					order: await trx
						.selectFrom('orders')
						.where('id', '=', placedOrder!.id)
						.executeTakeFirst(),
					items: orderItems,
				};
			});

			// 3. Process payment and update inventory
			return db.transaction().execute(async (trx) => {
				// Update inventory
				for (const item of orderWithItems.items) {
					await trx
						.updateTable('products')
						.set({
							stock: sql`stock - ${item!.quantity}`,
						})
						.where('id', '=', item!.product_id)
						.execute();
				}

				// Complete the order
				await trx
					.updateTable('orders')
					.set({ status: 'completed' })
					.where('id', '=', placedOrder!.id)
					.execute();

				return {
					order: await trx
						.selectFrom('orders')
						.where('id', '=', placedOrder!.id)
						.executeTakeFirst(),
					items: await trx
						.selectFrom('order_items')
						.where('order_id', '=', placedOrder!.id)
						.execute(),
				};
			});
		};

		// Execute the complete order cycle
		const result = await processOrderCycle(1, [
			{ productId: 1, quantity: 3 },
			{ productId: 2, quantity: 1 },
		]);

		// Verify final order state
		expect(result.order.status).toBe('completed');
		expect(result.items).toHaveLength(2);

		// Verify inventory was updated
		const product1 = await ProductModel.findById(1);
		const product2 = await ProductModel.findById(2);

		expect(product1.stock).toBe(97);
		expect(product2.stock).toBe(49);
	});
});
