import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { db, toSqliteDate } from './utils/common-setup';

describe('Transactions', () => {
	// Set up database tables before each test
	beforeEach(async () => {
		try {
			console.log('Creating users table for transaction test');

			// Create users table for testing
			await db.db.schema
				.createTable('users')
				.ifNotExists()
				.addColumn('id', 'integer', (col) => col.primaryKey().autoIncrement())
				.addColumn('email', 'text', (col) => col.unique().notNull())
				.addColumn('name', 'text', (col) => col.notNull())
				.addColumn('username', 'text', (col) => col.notNull())
				.addColumn('password', 'text', (col) => col.notNull())
				.addColumn('followersCount', 'integer', (col) => col.defaultTo(0))
				.addColumn('createdAt', 'text')
				.addColumn('updatedAt', 'text')
				.execute();

			console.log('Users table created successfully');
		} catch (err) {
			console.error('Error creating users table:', err);
		}
	});

	// Clean up after each test
	afterEach(async () => {
		try {
			console.log('Dropping users table after transaction test');
			await db.db.schema.dropTable('users').ifExists().execute();
		} catch (err) {
			console.error('Error dropping users table:', err);
		}
	});

	it('should be able to use transactions', async () => {
		try {
			// Clean up from previous test runs (just in case)
			await db.db
				.deleteFrom('users')
				.where('email', '=', 'transaction-test@gmail.com')
				.execute()
				.catch(() => {
					// Ignore if table doesn't exist or no records
				});

			// Use a transaction to insert and update a user
			const result = await db.db.transaction().execute(async (trx) => {
				// Insert a user
				const now = new Date();
				const insertResult = await trx
					.insertInto('users')
					.values({
						email: 'transaction-test@gmail.com',
						name: 'Transaction Test',
						username: 'transaction-test',
						password: 'password123',
						followersCount: 0,
						createdAt: toSqliteDate(now),
						updatedAt: toSqliteDate(now),
					} as any)
					.returning('id')
					.executeTakeFirst();

				if (!insertResult || !insertResult.id) {
					throw new Error('Failed to insert user in transaction');
				}

				// Update the user in the same transaction
				await trx
					.updateTable('users')
					.set({
						followersCount: 10,
						updatedAt: toSqliteDate(new Date()),
					} as any)
					.where('id', '=', insertResult.id)
					.execute();

				// Fetch the updated user
				return await trx
					.selectFrom('users')
					.where('id', '=', insertResult.id)
					.selectAll()
					.executeTakeFirst();
			});

			// Verify the user was inserted and updated
			if (result) {
				expect(result.email).toBe('transaction-test@gmail.com');
				expect(result.followersCount).toBe(10);
			} else {
				// This should not happen but we handle it for type safety
				expect(result).not.toBeNull();
			}
		} catch (error) {
			console.error('Transaction test error:', error);
			throw error;
		}
	});
});
