import { beforeEach, describe, expect, it, vi } from 'vitest';
import createModel from '../../model';
import type { Database } from '../../database';
import type { ModelFunctions } from '../../model';
import type { Transaction } from 'kysely';

// Define custom types for mocks
interface MockTransaction {
	execute: (callback: (trx: any) => Promise<any>) => Promise<any>;
	[key: string]: any;
}

interface MockDB {
	transaction: () => MockTransaction;
	selectFrom: MockFn;
	where?: MockFn;
	execute: MockFn;
	executeTakeFirst: MockFn;
	insertInto: MockFn;
	updateTable?: MockFn;
	[key: string]: any;
}

type MockFn = ReturnType<typeof vi.fn>;

describe('unit: error recovery and concurrency handling', () => {
	// Define test database types
	interface TestDB {
		users: {
			id: number;
			name: string;
			email: string;
			status: string;
			version: number;
		};
		transactions: {
			id: number;
			user_id: number;
			amount: number;
			status: string;
		};
	}

	// Properly type the variables
	let mockDb: MockDB;
	let userModel: ModelFunctions<TestDB, 'users', 'id'> & {
		transaction: (callback: (trx: any) => Promise<any>) => Promise<any>;
		updateTable: () => any;
		[key: string]: any;
	};
	let transactionModel: ModelFunctions<TestDB, 'transactions', 'id'>;

	beforeEach(() => {
		// Set up mock database
		mockDb = {
			transaction: vi.fn().mockReturnValue({
				execute: vi.fn().mockImplementation(async (callback: (trx: any) => Promise<any>) => {
					const trx = {
						selectFrom: vi.fn().mockReturnThis(),
						where: vi.fn().mockReturnThis(),
						execute: vi.fn().mockResolvedValue([]),
						executeTakeFirst: vi.fn().mockResolvedValue(null),
						insertInto: vi.fn().mockReturnThis(),
						values: vi.fn().mockReturnThis(),
						returning: vi.fn().mockReturnThis(),
						updateTable: vi.fn().mockReturnThis(),
						set: vi.fn().mockReturnThis(),
					};
					return await callback(trx);
				}),
			}),
			selectFrom: vi.fn().mockReturnThis(),
			where: vi.fn().mockReturnThis(),
			execute: vi.fn().mockResolvedValue([]),
			executeTakeFirst: vi.fn().mockResolvedValue(null),
			insertInto: vi.fn().mockReturnThis(),
		} as MockDB;

		// Create models with mock db
		userModel = {
			...createModel({} as Database<TestDB>, 'users', 'id'),
			// Add custom methods and properties for the test
			findById: vi.fn(),
			selectFrom: vi.fn().mockReturnValue(mockDb),
			transaction: vi.fn().mockImplementation(async (callback) => {
				return mockDb.transaction().execute(callback);
			}),
			updateTable: vi.fn().mockReturnThis(),
			set: vi.fn().mockReturnThis(),
		};

		transactionModel = createModel({} as Database<TestDB>, 'transactions', 'id') as any;
	});

	describe('error handling', () => {
		it('should handle database connection errors', async () => {
			// Mock a database connection error
			mockDb.selectFrom.mockImplementation(() => {
				throw new Error('Database connection lost');
			});

			// Create a function with error handling
			const findUserWithErrorHandling = async (id: number) => {
				try {
					return await userModel.findById(id);
				} catch (error: any) {
					return { error: error.message };
				}
			};

			const result = await findUserWithErrorHandling(1);
			expect(result).toEqual({ error: 'Database connection lost' });
		});

		it('should handle query execution errors', async () => {
			// Mock an execution error
			mockDb.execute.mockRejectedValue(new Error('Invalid SQL query'));

			// Create a function with error handling
			const findUsersWithErrorHandling = async () => {
				try {
					return await userModel.selectFrom().execute();
				} catch (error: any) {
					return { error: error.message };
				}
			};

			const result = await findUsersWithErrorHandling();
			expect(result).toEqual({ error: 'Invalid SQL query' });
		});

		it('should handle transaction rollback on error', async () => {
			// Mock a transaction execution that fails
			mockDb.transaction().execute.mockImplementation(async (callback: (trx: any) => Promise<any>) => {
				const trx = {
					updateTable: vi.fn().mockReturnThis(),
					set: vi.fn().mockReturnThis(),
					where: vi.fn().mockReturnThis(),
					executeTakeFirst: vi.fn().mockImplementation(() => {
						throw new Error('Transaction failed');
					}),
				};

				try {
					return await callback(trx);
				} catch (error) {
					// Simulate rollback
					return { error: 'Transaction rolled back' };
				}
			});

			// Create a function that uses transactions
			const updateUserWithTransaction = async (id: number, data: any) => {
				try {
					return await userModel.transaction(async (trx: any) => {
						return trx
							.updateTable('users')
							.set(data)
							.where('id', '=', id)
							.executeTakeFirst();
					});
				} catch (error: any) {
					return { error: error.message };
				}
			};

			const result = await updateUserWithTransaction(1, { status: 'active' });
			expect(result).toEqual({ error: 'Transaction rolled back' });
		});
	});

	describe('retry mechanisms', () => {
		it('should retry failed operations', async () => {
			// Set up a mock that fails twice then succeeds
			mockDb.executeTakeFirst
				.mockRejectedValueOnce(new Error('Connection error'))
				.mockRejectedValueOnce(new Error('Timeout error'))
				.mockResolvedValueOnce({ id: 1, name: 'Test User' });

			// Define a retry function
			const withRetry = async (operation: () => Promise<any>, maxRetries = 3) => {
				let lastError;

				for (let attempt = 1; attempt <= maxRetries; attempt++) {
					try {
						return await operation();
					} catch (error: any) {
						lastError = error;
						// Could add exponential backoff here
					}
				}

				throw lastError;
			};

			// Test function with retries
			const findUserWithRetry = async (id: number) => {
				return withRetry(async () => {
					return await userModel.findById(id);
				});
			};

			// Mock the findById to use our mock db
			userModel.findById.mockImplementation((id) => {
				return mockDb.executeTakeFirst();
			});

			const result = await findUserWithRetry(1);
			expect(result).toEqual({ id: 1, name: 'Test User' });
			expect(mockDb.executeTakeFirst).toHaveBeenCalledTimes(3);
		});

		it('should throw after max retries', async () => {
			// Set up a mock that always fails
			mockDb.executeTakeFirst.mockRejectedValue(new Error('Persistent error'));

			// Define a retry function
			const withRetry = async (operation: () => Promise<any>, maxRetries = 3) => {
				let lastError;

				for (let attempt = 1; attempt <= maxRetries; attempt++) {
					try {
						return await operation();
					} catch (error: any) {
						lastError = error;
						// Could add exponential backoff here
					}
				}

				throw lastError;
			};

			// Test function with retries
			const findUserWithRetry = async (id: number) => {
				return withRetry(async () => {
					return await userModel.findById(id);
				});
			};

			// Mock the findById to use our mock db
			userModel.findById.mockImplementation((id) => {
				return mockDb.executeTakeFirst();
			});

			await expect(findUserWithRetry(1)).rejects.toThrow('Persistent error');
			expect(mockDb.executeTakeFirst).toHaveBeenCalledTimes(3);
		});
	});

	describe('optimistic concurrency control', () => {
		it('should handle version conflicts', async () => {
			// Mock a user with a version number
			const mockUser = { id: 1, name: 'Original Name', version: 1 };
			mockDb.executeTakeFirst
				.mockResolvedValueOnce(mockUser) // First query returns the user
				.mockResolvedValueOnce(null); // No rows updated (version conflict)

			// Simulate optimistic locking with version field
			const updateWithVersion = async (
				id: number,
				data: any,
				expectedVersion: number
			) => {
				// First get the current user
				const user = await userModel.findById(id);
				if (!user) {
					return { error: 'User not found' };
				}

				// Attempt to update with version check
				const result = await userModel
					.updateTable()
					.set({
						...data,
						version: expectedVersion + 1,
					})
					.where('id', '=', id)
					.where('version', '=', expectedVersion)
					.executeTakeFirst();

				if (!result) {
					return {
						error: 'Version conflict detected',
						currentVersion: user.version,
					};
				}

				return result;
			};

			// Mock implementation for the operations
			userModel.findById.mockReturnValue(mockDb.executeTakeFirst());
			userModel.updateTable().set.mockReturnThis();
			userModel.updateTable().set().where.mockReturnThis();
			userModel.updateTable().set().where().where.mockReturnThis();
			userModel.updateTable().set().where().where().executeTakeFirst.mockReturnValue(
				mockDb.executeTakeFirst()
			);

			const result = await updateWithVersion(1, { name: 'New Name' }, 1);
			expect(result).toEqual({
				error: 'Version conflict detected',
				currentVersion: 1,
			});
		});

		it('should update when version matches', async () => {
			// Mock a user with a version number
			const mockUser = { id: 1, name: 'Original Name', version: 1 };
			mockDb.executeTakeFirst
				.mockResolvedValueOnce(mockUser) // First query returns the user
				.mockResolvedValueOnce({ id: 1, name: 'New Name', version: 2 }); // Update succeeded

			// Simulate optimistic locking with version field
			const updateWithVersion = async (
				id: number,
				data: any,
				expectedVersion: number
			) => {
				// First get the current user
				const user = await userModel.findById(id);
				if (!user) {
					return { error: 'User not found' };
				}

				// Attempt to update with version check
				const result = await userModel
					.updateTable()
					.set({
						...data,
						version: expectedVersion + 1,
					})
					.where('id', '=', id)
					.where('version', '=', expectedVersion)
					.executeTakeFirst();

				if (!result) {
					return {
						error: 'Version conflict detected',
						currentVersion: user.version,
					};
				}

				return result;
			};

			// Mock implementation for the operations
			userModel.findById.mockReturnValue(mockDb.executeTakeFirst());
			userModel.updateTable().set.mockReturnThis();
			userModel.updateTable().set().where.mockReturnThis();
			userModel.updateTable().set().where().where.mockReturnThis();
			userModel.updateTable().set().where().where().executeTakeFirst.mockReturnValue(
				mockDb.executeTakeFirst()
			);

			const result = await updateWithVersion(1, { name: 'New Name' }, 1);
			expect(result).toEqual({ id: 1, name: 'New Name', version: 2 });
		});
	});

	describe('transaction isolation', () => {
		it('should execute operations in a transaction', async () => {
			// Set up a mock transaction
			const mockTrx = {
				updateTable: vi.fn().mockReturnThis(),
				set: vi.fn().mockReturnThis(),
				where: vi.fn().mockReturnThis(),
				executeTakeFirst: vi.fn().mockResolvedValue({ id: 1, name: 'Updated' }),
				insertInto: vi.fn().mockReturnThis(),
				values: vi.fn().mockReturnThis(),
				returning: vi.fn().mockReturnThis(),
				execute: vi.fn(),
			};

			mockDb.transaction().execute.mockImplementation(async (callback: (trx: any) => Promise<any>) => {
				return callback(mockTrx);
			});

			// Define a function that uses a transaction
			const transferFunds = async (
				fromUserId: number,
				toUserId: number,
				amount: number
			) => {
				return userModel.transaction(async (trx: any) => {
					// Debit one account
					await trx
						.updateTable('users')
						.set({ amount: trx.db.dynamic.raw(`amount - ${amount}`) })
						.where('id', '=', fromUserId)
						.executeTakeFirst();

					// Credit another account
					await trx
						.updateTable('users')
						.set({ amount: trx.db.dynamic.raw(`amount + ${amount}`) })
						.where('id', '=', toUserId)
						.executeTakeFirst();

					// Record the transaction
					const transactionRecord = await trx
						.insertInto('transactions')
						.values({
							user_id: fromUserId,
							amount,
							status: 'completed',
						})
						.returning(['id', 'user_id', 'amount'])
						.executeTakeFirst();

					return transactionRecord;
				});
			};

			// Mock dynamic raw
			mockTrx.db = {
				dynamic: {
					raw: vi.fn(val => val),
				},
			};

			const result = await transferFunds(1, 2, 100);

			expect(mockDb.transaction().execute).toHaveBeenCalledTimes(1);
			expect(mockTrx.updateTable).toHaveBeenCalledTimes(2);
			expect(mockTrx.insertInto).toHaveBeenCalledTimes(1);
			expect(result).toEqual({ id: 2, user_id: 1, amount: 100 });
		});
	});
});
