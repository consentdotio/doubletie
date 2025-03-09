// tests/integration/transactions.spec.ts

import type { Kysely } from 'kysely';
import { sql } from 'kysely';
import {
	setupTestDatabase,
	teardownTestDatabase,
} from 'tests/fixtures/test-db';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import createModel from '~/model';

// Test database schema
interface TestDB {
	users: {
		id: number;
		name: string;
		email: string;
		balance: number;
	};
	accounts: {
		id: number;
		user_id: number;
		account_number: string;
		balance: number;
	};
}

describe('integration: database transactions', () => {
	let db: Kysely<TestDB>;
	let UserModel: any;
	let AccountModel: any;

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
			.execute();

		await db.schema
			.createTable('accounts')
			.addColumn('id', 'serial', (col) => col.primaryKey())
			.addColumn('user_id', 'integer', (col) =>
				col.references('users.id').onDelete('cascade').notNull()
			)
			.addColumn('account_number', 'varchar(50)', (col) =>
				col.unique().notNull()
			)
			.addColumn('balance', 'numeric', (col) => col.notNull().defaultTo(0))
			.execute();

		// Create models
		UserModel = createModel<TestDB, 'users', 'id'>(db, 'users', 'id');
		AccountModel = createModel<TestDB, 'accounts', 'id'>(db, 'accounts', 'id');

		// Seed with test data
		await UserModel.insertInto()
			.values([
				{ id: 1, name: 'Alice', email: 'alice@example.com', balance: 1000 },
				{ id: 2, name: 'Bob', email: 'bob@example.com', balance: 500 },
			])
			.execute();

		await AccountModel.insertInto()
			.values([
				{ id: 1, user_id: 1, account_number: 'ACC001', balance: 1000 },
				{ id: 2, user_id: 2, account_number: 'ACC002', balance: 500 },
			])
			.execute();
	});

	afterEach(async () => {
		await teardownTestDatabase(db);
	});

	it('should commit changes when transaction completes successfully', async () => {
		// Perform a transaction that updates balances
		await db.transaction().execute(async (trx) => {
			// Deduct from user 1
			await trx
				.updateTable('users')
				.set({ balance: 900 })
				.where('id', '=', 1)
				.execute();

			// Add to user 2
			await trx
				.updateTable('users')
				.set({ balance: 600 })
				.where('id', '=', 2)
				.execute();
		});

		// Verify changes were committed
		const alice = await UserModel.findById(1);
		const bob = await UserModel.findById(2);

		expect(alice.balance).toBe(900);
		expect(bob.balance).toBe(600);
	});

	it('should rollback changes when transaction throws an error', async () => {
		// Get initial balances
		const initialAlice = await UserModel.findById(1);
		const initialBob = await UserModel.findById(2);

		try {
			await db.transaction().execute(async (trx) => {
				// Deduct from user 1
				await trx
					.updateTable('users')
					.set({ balance: 800 })
					.where('id', '=', 1)
					.execute();

				// Simulate an error
				throw new Error('Transaction error');

				// This code should not execute
				await trx
					.updateTable('users')
					.set({ balance: 700 })
					.where('id', '=', 2)
					.execute();
			});
		} catch (error) {
			// Error expected
		}

		// Verify changes were rolled back
		const alice = await UserModel.findById(1);
		const bob = await UserModel.findById(2);

		expect(alice.balance).toBe(initialAlice.balance);
		expect(bob.balance).toBe(initialBob.balance);
	});

	it('should support nested transactions', async () => {
		await db.transaction().execute(async (outerTrx) => {
			// Outer transaction update
			await outerTrx
				.updateTable('users')
				.set({ balance: 950 })
				.where('id', '=', 1)
				.execute();

			// Nested transaction
			await outerTrx.transaction().execute(async (innerTrx) => {
				await innerTrx
					.updateTable('users')
					.set({ balance: 550 })
					.where('id', '=', 2)
					.execute();
			});
		});

		// Verify both changes were committed
		const alice = await UserModel.findById(1);
		const bob = await UserModel.findById(2);

		expect(alice.balance).toBe(950);
		expect(bob.balance).toBe(550);
	});

	it('should rollback nested transactions when inner transaction fails', async () => {
		const initialAlice = await UserModel.findById(1);
		const initialBob = await UserModel.findById(2);

		try {
			await db.transaction().execute(async (outerTrx) => {
				// Outer transaction update
				await outerTrx
					.updateTable('users')
					.set({ balance: 900 })
					.where('id', '=', 1)
					.execute();

				// Nested transaction that fails
				await outerTrx.transaction().execute(async (innerTrx) => {
					await innerTrx
						.updateTable('users')
						.set({ balance: 600 })
						.where('id', '=', 2)
						.execute();

					throw new Error('Inner transaction error');
				});
			});
		} catch (error) {
			// Error expected
		}

		// Verify all changes were rolled back
		const alice = await UserModel.findById(1);
		const bob = await UserModel.findById(2);

		expect(alice.balance).toBe(initialAlice.balance);
		expect(bob.balance).toBe(initialBob.balance);
	});

	it('should support model transaction methods', async () => {
		await UserModel.transaction(async (trx) => {
			// Create UserModel with transaction
			const TransactionalUserModel = createModel<TestDB, 'users', 'id'>(
				trx,
				'users',
				'id'
			);

			// Update using the transactional model
			await TransactionalUserModel.updateTable()
				.set({ balance: 1100 })
				.where('id', '=', 1)
				.execute();

			await TransactionalUserModel.updateTable()
				.set({ balance: 400 })
				.where('id', '=', 2)
				.execute();
		});

		// Verify changes were committed
		const alice = await UserModel.findById(1);
		const bob = await UserModel.findById(2);

		expect(alice.balance).toBe(1100);
		expect(bob.balance).toBe(400);
	});

	it('should perform a money transfer between accounts within a transaction', async () => {
		// Create a function to transfer money
		const transferMoney = async (
			fromAccountId: number,
			toAccountId: number,
			amount: number
		) => {
			return db.transaction().execute(async (trx) => {
				// Deduct from source account
				await trx
					.updateTable('accounts')
					.set({
						balance: sql`balance - ${amount}`,
					})
					.where('id', '=', fromAccountId)
					.execute();

				// Add to destination account
				await trx
					.updateTable('accounts')
					.set({
						balance: sql`balance + ${amount}`,
					})
					.where('id', '=', toAccountId)
					.execute();

				// Return the updated accounts
				return {
					fromAccount: await trx
						.selectFrom('accounts')
						.where('id', '=', fromAccountId)
						.executeTakeFirst(),
					toAccount: await trx
						.selectFrom('accounts')
						.where('id', '=', toAccountId)
						.executeTakeFirst(),
				};
			});
		};

		// Perform the transfer
		const result = await transferMoney(1, 2, 300);

		// Verify the transfer
		expect(result.fromAccount.balance).toBe(700);
		expect(result.toAccount.balance).toBe(800);

		// Verify the database state
		const account1 = await AccountModel.findById(1);
		const account2 = await AccountModel.findById(2);

		expect(account1.balance).toBe(700);
		expect(account2.balance).toBe(800);
	});

	it('should fail the transfer if source account has insufficient funds', async () => {
		// Create a function that checks balance before transfer
		const safeTransferMoney = async (
			fromAccountId: number,
			toAccountId: number,
			amount: number
		) => {
			return db.transaction().execute(async (trx) => {
				// Check source account balance
				const sourceAccount = await trx
					.selectFrom('accounts')
					.where('id', '=', fromAccountId)
					.executeTakeFirst();

				if (!sourceAccount || sourceAccount.balance < amount) {
					throw new Error('Insufficient funds');
				}

				// Deduct from source account
				await trx
					.updateTable('accounts')
					.set({
						balance: sql`balance - ${amount}`,
					})
					.where('id', '=', fromAccountId)
					.execute();

				// Add to destination account
				await trx
					.updateTable('accounts')
					.set({
						balance: sql`balance + ${amount}`,
					})
					.where('id', '=', toAccountId)
					.execute();

				return {
					fromAccount: await trx
						.selectFrom('accounts')
						.where('id', '=', fromAccountId)
						.executeTakeFirst(),
					toAccount: await trx
						.selectFrom('accounts')
						.where('id', '=', toAccountId)
						.executeTakeFirst(),
				};
			});
		};

		// Get initial balances
		const initialAccount1 = await AccountModel.findById(1);
		const initialAccount2 = await AccountModel.findById(2);

		// Try to transfer more than available
		try {
			await safeTransferMoney(1, 2, 1500);
			fail('Should have thrown an error');
		} catch (error) {
			expect(error.message).toBe('Insufficient funds');
		}

		// Verify balances are unchanged
		const account1 = await AccountModel.findById(1);
		const account2 = await AccountModel.findById(2);

		expect(account1.balance).toBe(initialAccount1.balance);
		expect(account2.balance).toBe(initialAccount2.balance);
	});
});
