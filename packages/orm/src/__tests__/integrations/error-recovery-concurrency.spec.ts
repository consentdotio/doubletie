import { sql } from 'kysely';
import type { Kysely } from 'kysely';
import {
	setupTestDatabase,
	teardownTestDatabase,
} from 'tests/fixtures/test-db';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import createModel from '~/model';

describe('integration: error recovery and concurrency', () => {
	// Define test database schema
	interface TestDB {
		users: {
			id: number;
			name: string;
			email: string;
			balance: number;
			version: number;
		};
		transactions: {
			id: number;
			user_id: number;
			recipient_id: number | null;
			amount: number;
			type: string;
			status: string;
			created_at: Date;
		};
	}

	let db: Kysely<TestDB>;
	let UserModel;
	let TransactionModel;

	beforeEach(async () => {
		// Set up test database
		db = (await setupTestDatabase()) as Kysely<TestDB>;

		// Create test tables
		await db.schema
			.createTable('users')
			.addColumn('id', 'serial', (col) => col.primaryKey())
			.addColumn('name', 'varchar(255)', (col) => col.notNull())
			.addColumn('email', 'varchar(255)', (col) => col.unique().notNull())
			.addColumn('balance', 'numeric', (col) => col.notNull().defaultTo(0))
			.addColumn('version', 'integer', (col) => col.notNull().defaultTo(1))
			.execute();

		await db.schema
			.createTable('transactions')
			.addColumn('id', 'serial', (col) => col.primaryKey())
			.addColumn('user_id', 'integer', (col) =>
				col.references('users.id').onDelete('cascade').notNull()
			)
			.addColumn('recipient_id', 'integer', (col) =>
				col.references('users.id').onDelete('restrict')
			)
			.addColumn('amount', 'numeric', (col) => col.notNull())
			.addColumn('type', 'varchar(50)', (col) => col.notNull())
			.addColumn('status', 'varchar(50)', (col) => col.notNull())
			.addColumn('created_at', 'timestamp', (col) =>
				col.defaultTo(db.fn.now()).notNull()
			)
			.execute();

		// Create models
		UserModel = createModel<TestDB, 'users', 'id'>(db, 'users', 'id');
		TransactionModel = createModel<TestDB, 'transactions', 'id'>(
			db,
			'transactions',
			'id'
		);

		// Seed test data
		await db
			.insertInto('users')
			.values([
				{ id: 1, name: 'John Doe', email: 'john@example.com', balance: 1000 },
				{ id: 2, name: 'Jane Smith', email: 'jane@example.com', balance: 500 },
			])
			.execute();
	});

	afterEach(async () => {
		await teardownTestDatabase(db);
	});

	describe('error handling', () => {
		it('should handle unique constraint violations', async () => {
			// Try to insert a user with an email that already exists
			const insertWithDuplicateEmail = async () => {
				try {
					await UserModel.insertInto()
						.values({
							name: 'New User',
							email: 'john@example.com', // Already exists
						})
						.execute();
					return { success: true };
				} catch (error) {
					return { error: error.message };
				}
			};

			const result = await insertWithDuplicateEmail();

			expect(result).toHaveProperty('error');
			expect(result.error).toContain('unique'); // Error message should mention uniqueness
		});

		it('should handle foreign key constraint violations', async () => {
			// Try to insert a transaction with a non-existent user
			const insertWithInvalidUserId = async () => {
				try {
					await TransactionModel.insertInto()
						.values({
							user_id: 999, // Doesn't exist
							amount: 100,
							type: 'deposit',
							status: 'completed',
						})
						.execute();
					return { success: true };
				} catch (error) {
					return { error: error.message };
				}
			};

			const result = await insertWithInvalidUserId();

			expect(result).toHaveProperty('error');
			expect(result.error).toContain('foreign key'); // Error message should mention foreign key
		});
	});

	describe('transaction isolation', () => {
		it('should maintain consistency during transactions', async () => {
			// Define a function to transfer funds between users
			const transferFunds = async (
				fromUserId: number,
				toUserId: number,
				amount: number
			) => {
				return db.transaction().execute(async (trx) => {
					// Get initial balances
					const fromUser = await trx
						.selectFrom('users')
						.where('id', '=', fromUserId)
						.executeTakeFirst();

					const toUser = await trx
						.selectFrom('users')
						.where('id', '=', toUserId)
						.executeTakeFirst();

					if (!fromUser || !toUser) {
						throw new Error('User not found');
					}

					if (fromUser.balance < amount) {
						throw new Error('Insufficient funds');
					}

					// Update balances
					await trx
						.updateTable('users')
						.set({ balance: fromUser.balance - amount })
						.where('id', '=', fromUserId)
						.execute();

					await trx
						.updateTable('users')
						.set({ balance: toUser.balance + amount })
						.where('id', '=', toUserId)
						.execute();

					// Record the transaction
					return trx
						.insertInto('transactions')
						.values({
							user_id: fromUserId,
							recipient_id: toUserId,
							amount,
							type: 'transfer',
							status: 'completed',
						})
						.returning(['*'])
						.executeTakeFirst();
				});
			};

			// Perform a valid transfer
			const transaction = await transferFunds(1, 2, 200);

			// Verify the transaction was created
			expect(transaction).toHaveProperty('id');
			expect(transaction).toHaveProperty('amount', 200);

			// Verify balances were updated correctly
			const john = await UserModel.findById(1);
			const jane = await UserModel.findById(2);

			expect(john.balance).toBe(800); // 1000 - 200
			expect(jane.balance).toBe(700); // 500 + 200
		});

		it('should roll back on error', async () => {
			// Get initial balances
			const initialJohn = await UserModel.findById(1);
			const initialJane = await UserModel.findById(2);

			// Define a function that will fail during transaction
			const transferThenFail = async (
				fromUserId: number,
				toUserId: number,
				amount: number
			) => {
				try {
					return await db.transaction().execute(async (trx) => {
						// Update balances
						await trx
							.updateTable('users')
							.set({ balance: sql`balance - ${amount}` })
							.where('id', '=', fromUserId)
							.execute();

						await trx
							.updateTable('users')
							.set({ balance: sql`balance + ${amount}` })
							.where('id', '=', toUserId)
							.execute();

						// Force an error
						throw new Error('Simulated failure');
					});
				} catch (error) {
					return { error: error.message };
				}
			};

			// Perform a transfer that will fail
			const result = await transferThenFail(1, 2, 200);

			// Verify the error was returned
			expect(result).toHaveProperty('error', 'Simulated failure');

			// Verify balances remain unchanged
			const john = await UserModel.findById(1);
			const jane = await UserModel.findById(2);

			expect(john.balance).toBe(initialJohn.balance);
			expect(jane.balance).toBe(initialJane.balance);
		});
	});

	describe('optimistic concurrency control', () => {
		it('should handle concurrent updates with version numbers', async () => {
			// Define a function that updates a user with version check
			const updateUserWithVersion = async (id: number, data: any) => {
				// First get the current user with version
				const user = await UserModel.findById(id);
				if (!user) {
					return { error: 'User not found' };
				}

				const currentVersion = user.version;

				// Attempt to update with version check
				const result = await db
					.updateTable('users')
					.set({
						...data,
						version: currentVersion + 1,
					})
					.where('id', '=', id)
					.where('version', '=', currentVersion)
					.execute();

				if (result.numUpdatedRows === 0n) {
					return { error: 'Concurrent update detected' };
				}

				return { success: true, user: await UserModel.findById(id) };
			};

			// Perform the first update
			const firstUpdate = await updateUserWithVersion(1, {
				name: 'John Updated',
			});

			expect(firstUpdate).toHaveProperty('success', true);
			expect(firstUpdate.user).toHaveProperty('name', 'John Updated');
			expect(firstUpdate.user).toHaveProperty('version', 2);

			// Try to update with stale version
			const staleUpdate = await db
				.updateTable('users')
				.set({
					name: 'Stale Update',
					version: 2, // But the version is already 2 now
				})
				.where('id', '=', 1)
				.where('version', '=', 1) // This is stale
				.execute();

			expect(staleUpdate.numUpdatedRows).toBe(0n); // No rows should be updated

			// Verify the user wasn't changed by the stale update
			const user = await UserModel.findById(1);
			expect(user.name).toBe('John Updated');
			expect(user.version).toBe(2);
		});
	});

	describe('custom error recovery', () => {
		it('should handle custom retry logic for failed operations', async () => {
			// Define a retry function
			const withRetry = async <T>(
				operation: () => Promise<T>,
				{
					maxRetries = 3,
					retryCondition,
				}: {
					maxRetries?: number;
					retryCondition?: (error: Error) => boolean;
				} = {}
			): Promise<T> => {
				let lastError: Error;

				for (let attempt = 1; attempt <= maxRetries; attempt++) {
					try {
						return await operation();
					} catch (error) {
						lastError = error;

						// Check if we should retry based on the error
						if (retryCondition && !retryCondition(error)) {
							throw error; // Don't retry if condition isn't met
						}

						if (attempt === maxRetries) {
							throw error; // Max retries reached
						}

						// Wait before retrying (simple exponential backoff)
						await new Promise((resolve) =>
							setTimeout(resolve, 50 * Math.pow(2, attempt - 1))
						);
					}
				}

				throw lastError;
			};

			// Create a function that will fail temporarily
			let attemptCount = 0;
			const temporarilyFailingOperation = async () => {
				attemptCount++;

				if (attemptCount < 2) {
					throw new Error('Temporary failure');
				}

				return { success: true, attemptCount };
			};

			// Execute with retry
			const result = await withRetry(temporarilyFailingOperation, {
				maxRetries: 3,
				retryCondition: (error) => error.message.includes('Temporary'),
			});

			expect(result).toHaveProperty('success', true);
			expect(result).toHaveProperty('attemptCount', 2);
		});
	});

	describe('specialized query functions', () => {
		it('should handle filtered queries with error handling', async () => {
			// Define a function to get users by status
			const getUsersByStatus = (status: string) => {
				return UserModel.selectFrom()
					.where('status', '=', status)
					.execute()
					.catch((error) => {
						console.error('Error fetching users by status:', error);
						return [];
					});
			};

			// Set a status for testing
			await db
				.updateTable('users')
				.set({ status: 'active' })
				.where('id', '=', 1)
				.execute();

			// Test with valid status
			const activeUsers = await getUsersByStatus('active');
			expect(activeUsers).toHaveLength(1);
			expect(activeUsers[0]).toHaveProperty('id', 1);

			// Test with non-existent status
			const inactiveUsers = await getUsersByStatus('inactive');
			expect(inactiveUsers).toHaveLength(0);
		});

		it('should support complex search with parameters and error handling', async () => {
			// Define a search function with multiple parameters
			const searchUsers = (params: {
				minBalance?: number;
				status?: string;
				nameLike?: string;
			}) => {
				try {
					let query = UserModel.selectFrom();

					if (params.minBalance !== undefined) {
						query = query.where('balance', '>=', params.minBalance);
					}

					if (params.status) {
						query = query.where('status', '=', params.status);
					}

					if (params.nameLike) {
						query = query.where('name', 'like', `%${params.nameLike}%`);
					}

					return query.execute();
				} catch (error) {
					console.error('Search error:', error);
					return [];
				}
			};

			// Update users with status for testing
			await db
				.updateTable('users')
				.set({ status: 'active' })
				.where('id', 'in', [1])
				.execute();

			await db
				.updateTable('users')
				.set({ status: 'inactive' })
				.where('id', 'in', [2])
				.execute();

			// Test search with different parameters
			const richUsers = await searchUsers({ minBalance: 800 });
			expect(richUsers).toHaveLength(1);
			expect(richUsers[0]).toHaveProperty('id', 1);

			const activeUsers = await searchUsers({ status: 'active' });
			expect(activeUsers).toHaveLength(1);
			expect(activeUsers[0]).toHaveProperty('id', 1);

			const johnUsers = await searchUsers({ nameLike: 'John' });
			expect(johnUsers).toHaveLength(1);
			expect(johnUsers[0]).toHaveProperty('id', 1);

			// Combine parameters
			const richActiveJohns = await searchUsers({
				minBalance: 800,
				status: 'active',
				nameLike: 'John',
			});
			expect(richActiveJohns).toHaveLength(1);

			// No matches
			const noMatches = await searchUsers({
				minBalance: 2000,
				status: 'active',
			});
			expect(noMatches).toHaveLength(0);
		});
	});
});
