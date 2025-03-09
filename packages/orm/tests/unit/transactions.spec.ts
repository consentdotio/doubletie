import { beforeEach, describe, expect, it, vi } from 'vitest';
import createModel from '~/model';

describe('unit: transaction handling', () => {
	let mockDb;
	let mockTransaction;
	let mockExecuteTakeFirst;
	let model;

	beforeEach(() => {
		// Set up mock functions
		mockExecuteTakeFirst = vi.fn();

		mockTransaction = vi.fn().mockReturnValue({
			execute: vi.fn().mockImplementation(async (callback) => {
				return callback({
					selectFrom: vi.fn().mockReturnThis(),
					where: vi.fn().mockReturnThis(),
					executeTakeFirst: mockExecuteTakeFirst,
					updateTable: vi.fn().mockReturnThis(),
					set: vi.fn().mockReturnThis(),
				});
			}),
		});

		mockDb = {
			transaction: mockTransaction,
			selectFrom: vi.fn().mockReturnThis(),
			where: vi.fn().mockReturnThis(),
			executeTakeFirst: vi.fn(),
		};

		// Create model with mock db
		model = createModel(mockDb, 'users', 'id');
	});

	it('should provide a transaction method on the model', () => {
		expect(model).toHaveProperty('transaction');
		expect(typeof model.transaction).toBe('function');
	});

	it('should call the database transaction method', async () => {
		const callback = vi.fn().mockResolvedValue('transaction result');

		await model.transaction(callback);

		expect(mockDb.transaction).toHaveBeenCalled();
		expect(mockTransaction().execute).toHaveBeenCalled();
	});

	it('should pass the transaction to the callback', async () => {
		let transactionPassed = null;

		await model.transaction(async (trx) => {
			transactionPassed = trx;
		});

		expect(transactionPassed).not.toBeNull();
		expect(transactionPassed).toHaveProperty('selectFrom');
		expect(transactionPassed).toHaveProperty('updateTable');
	});

	it('should return the result from the callback', async () => {
		const expectedResult = { id: 1, name: 'Test' };
		const callback = vi.fn().mockResolvedValue(expectedResult);

		const result = await model.transaction(callback);

		expect(result).toEqual(expectedResult);
	});

	it('should propagate errors from the transaction', async () => {
		// Create a db mock that throws an error
		const errorDb = {
			transaction: vi.fn().mockReturnValue({
				execute: vi.fn().mockImplementation(() => {
					throw new Error('Transaction error');
				}),
			}),
		};

		const errorModel = createModel(errorDb, 'users', 'id');

		await expect(
			errorModel.transaction(async () => {
				// This should not be reached
				return 'result';
			})
		).rejects.toThrow('Transaction error');
	});

	it('should use transaction for database operations within callback', async () => {
		mockExecuteTakeFirst.mockResolvedValue({ id: 1, name: 'Test User' });

		await model.transaction(async (trx) => {
			// Create a transactional model
			const trxModel = createModel(trx, 'users', 'id');

			// Perform an operation
			await trxModel.findById(1);
		});

		// Verify executeTakeFirst was called
		expect(mockExecuteTakeFirst).toHaveBeenCalled();
	});
});
