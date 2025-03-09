import { beforeEach, describe, expect, it, vi } from 'vitest';
import { Database } from '../../database';
import createModel from '../../model';
import {
	MockFn,
	createErrorMockDatabase,
	createMockDatabase,
	createMockReturnThis,
	createMockTransaction,
} from '../fixtures/mock-db';

describe('unit: transaction handling', () => {
	// Define test database types
	interface TestDB {
		users: {
			id: number;
			name: string;
			email?: string;
		};
	}

	let mockDb: any;
	let mockTransaction: MockFn;
	let mockExecuteTakeFirst: MockFn;
	let model: any;

	beforeEach(() => {
		// Set up mock functions
		mockExecuteTakeFirst = vi.fn();

		// Create a mock transaction
		mockTransaction = createMockTransaction(mockExecuteTakeFirst);

		// Create a mock database with the transaction
		mockDb = createMockDatabase<TestDB>({
			transaction: mockTransaction,
			selectFrom: createMockReturnThis(),
			where: createMockReturnThis(),
			executeTakeFirst: vi.fn(),
		});

		// Create model with mock db - explicitly provide type parameters
		model = createModel<TestDB, 'users', 'id'>(
			mockDb as unknown as Database<TestDB>,
			'users',
			'id'
		);
	});

	it('should provide a transaction method on the model', () => {
		expect(model).toHaveProperty('transaction');
		expect(typeof model.transaction).toBe('function');
	});

	it('should call the database transaction method', async () => {
		const callback = vi.fn().mockResolvedValue('transaction result');

		await model.transaction(callback);

		expect(mockDb.transaction).toHaveBeenCalled();
		// Access the mocked function result and its execute method
		const mockTransactionResult = mockTransaction.mock.results[0].value;
		expect(mockTransactionResult.execute).toHaveBeenCalled();
	});

	it('should pass the transaction to the callback', async () => {
		let transactionPassed: any = null;

		await model.transaction(async (trx: any) => {
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
		const errorDb = createErrorMockDatabase('Transaction error');

		// Explicitly provide type parameters to createModel
		const errorModel = createModel<TestDB, 'users', 'id'>(
			errorDb as unknown as Database<TestDB>,
			'users',
			'id'
		);

		await expect(
			errorModel.transaction(async () => {
				// This should not be reached
				return 'result';
			})
		).rejects.toThrow('Transaction error');
	});

	it('should use transaction for database operations within callback', async () => {
		mockExecuteTakeFirst.mockResolvedValue({ id: 1, name: 'Test User' });

		await model.transaction(async (trx: any) => {
			// Create a transactional model - explicitly provide type parameters
			const trxModel = createModel<TestDB, 'users', 'id'>(
				trx as unknown as Database<TestDB>,
				'users',
				'id'
			);

			// Perform an operation
			await trxModel.findById(1);
		});

		// Verify executeTakeFirst was called
		expect(mockExecuteTakeFirst).toHaveBeenCalled();
	});
});
