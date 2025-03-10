import { sql } from 'kysely';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import createModel from '~/model';
import { setupTestDatabase, teardownTestDatabase } from '../fixtures/test-db';

describe('Error Handling - Integration Tests', () => {
	// Setup test database
	let db: any;
	let UserModel: any;

	beforeEach(async () => {
		// Set up fresh database for each test
		db = await setupTestDatabase();

		// Create User model
		UserModel = createModel(db, 'users', 'id');

		// Create users table
		await db.schema
			.createTable('users')
			.ifNotExists()
			.addColumn('id', 'integer', (col) => col.primaryKey().autoIncrement())
			.addColumn('email', 'text', (col) => col.notNull().unique())
			.addColumn('name', 'text', (col) => col.notNull())
			.addColumn('username', 'text', (col) => col.notNull())
			.addColumn('password', 'text', (col) => col.notNull())
			.addColumn('followersCount', 'integer', (col) => col.defaultTo(0))
			.addColumn('createdAt', 'text', (col) => col.notNull())
			.addColumn('updatedAt', 'text', (col) => col.notNull())
			.execute();

		// Insert test data
		await db
			.insertInto('users')
			.values({
				email: 'test@example.com',
				name: 'Test User',
				username: 'testuser',
				password: 'password123',
				followersCount: 0,
				createdAt: new Date().toISOString(),
				updatedAt: new Date().toISOString(),
			})
			.execute();
	});

	afterEach(async () => {
		await teardownTestDatabase(db);
	});

	it.skip('should throw appropriate error when record not found', async () => {
		let errorCaught = false;
		try {
			await UserModel.findById(9999);
		} catch (err) {
			errorCaught = true;
			expect(err.message).toContain('no result');
		}
		expect(errorCaught).toBe(true);
	});

	it.skip('should handle custom error types', async () => {
		// Create custom error class
		class CustomNotFoundError extends Error {
			constructor(message: string) {
				super(message);
				this.name = 'CustomNotFoundError';
			}
		}

		// Function that throws custom error
		const findWithCustomError = async (email: string) => {
			// Try to find the user by email
			const result = await db
				.selectFrom('users')
				.where('email', '=', email)
				.selectAll()
				.executeTakeFirst();

			if (!result) {
				throw new CustomNotFoundError(`User with email ${email} not found`);
			}

			return result;
		};

		// Insert test data
		await db
			.insertInto('users')
			.values({
				email: 'custom@example.com',
				name: 'Custom Error User',
				username: 'customerror',
				password: 'password123',
				followersCount: 0,
				createdAt: new Date().toISOString(),
				updatedAt: new Date().toISOString(),
			})
			.execute();

		// Test with valid email (should return user)
		const user = await findWithCustomError('custom@example.com');
		expect(user).toBeDefined();
		expect(user.email).toBe('custom@example.com');

		// Test with invalid email (should throw custom error)
		try {
			await findWithCustomError('nonexistent@example.com');
			expect(true).toBe(false); // This line should not be reached
		} catch (error) {
			expect(error).toBeInstanceOf(CustomNotFoundError);
			expect(error.message).toBe(
				'User with email nonexistent@example.com not found'
			);
		}
	});

	it.skip('should handle database constraint violations', async () => {
		// Test unique constraint violation
		try {
			await db
				.insertInto('users')
				.values({
					email: 'test@example.com', // This email already exists
					name: 'Duplicate User',
					username: 'duplicate',
					password: 'password123',
					followersCount: 0,
					createdAt: new Date().toISOString(),
					updatedAt: new Date().toISOString(),
				})
				.execute();

			expect(true).toBe(false); // This line should not be reached
		} catch (error) {
			expect(error.message).toContain('UNIQUE constraint failed');
		}
	});

	it.skip('should handle transaction rollbacks on error', async () => {
		// Create a function that uses a transaction
		const createUserWithTransaction = async (userData: any) => {
			return await db.transaction().execute(async (trx) => {
				// First insert the user
				const result = await trx
					.insertInto('users')
					.values(userData)
					.returning(['id'])
					.executeTakeFirst();

				// Then try to insert a record that will fail
				await trx
					.insertInto('users')
					.values({
						...userData,
						email: 'test@example.com', // This will cause a unique constraint error
					})
					.execute();

				return result;
			});
		};

		// Attempt to create a user with a transaction that will fail
		try {
			await createUserWithTransaction({
				email: 'new@example.com',
				name: 'New User',
				username: 'newuser',
				password: 'password123',
				followersCount: 0,
				createdAt: new Date().toISOString(),
				updatedAt: new Date().toISOString(),
			});

			expect(true).toBe(false); // This line should not be reached
		} catch (error) {
			expect(error.message).toContain('UNIQUE constraint failed');
		}

		// Verify that the first insert was rolled back
		const user = await db
			.selectFrom('users')
			.where('email', '=', 'new@example.com')
			.executeTakeFirst();

		expect(user).toBeUndefined();
	});

	it.skip('should support error recovery with retry', async () => {
		// Create a table with a counter for testing retries
		await db.schema
			.createTable('retry_test')
			.ifNotExists()
			.addColumn('id', 'integer', (col) => col.primaryKey().autoIncrement())
			.addColumn('counter', 'integer', (col) => col.notNull())
			.execute();

		await db.insertInto('retry_test').values({ counter: 0 }).execute();

		// Create a function that fails initially but succeeds after retries
		const updateWithRetry = async (maxRetries = 3, delay = 10) => {
			let attempts = 0;
			let lastError: Error | null = null;

			while (attempts < maxRetries) {
				try {
					// Get current counter
					const record = await db
						.selectFrom('retry_test')
						.where('id', '=', 1)
						.select(['counter'])
						.executeTakeFirst();

					// Increment counter
					attempts++;

					// Simulate failure for the first few attempts
					if (attempts < 2) {
						throw new Error(`Simulated failure on attempt ${attempts}`);
					}

					// Success on later attempts
					await db
						.updateTable('retry_test')
						.set({ counter: record.counter + 1 })
						.where('id', '=', 1)
						.execute();

					return { success: true, attempts };
				} catch (error) {
					lastError = error;

					// In a real implementation, we would wait here
					// await new Promise(resolve => setTimeout(resolve, delay));
				}
			}

			throw lastError || new Error('Max retries exceeded');
		};

		// Test retry logic
		const result = await updateWithRetry();
		expect(result.success).toBe(true);
		expect(result.attempts).toBe(2); // Succeeded on the second attempt

		// Verify the counter was updated
		const record = await db
			.selectFrom('retry_test')
			.where('id', '=', 1)
			.select(['counter'])
			.executeTakeFirst();

		expect(record.counter).toBe(1);
	});
});
