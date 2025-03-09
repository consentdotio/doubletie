import { sql } from 'kysely';
import { beforeEach, describe, expect, it } from 'vitest';
import { UserModel } from './utils/common-setup';
import { db, resetDatabase } from './utils/migration';

describe('Error Handling', () => {
	// Reset the database before each test
	beforeEach(async () => {
		await resetDatabase();
	});

	it('should throw appropriate error when record not found', async () => {
		let errorCaught = false;
		try {
			await UserModel.getById(9999);
			expect(true).toBe(false); // This line should not be reached
		} catch (err: unknown) {
			errorCaught = true;
			const error = err as { message: string };
			expect(error.message).toBe('no result');
		}
		expect(errorCaught).toBe(true);
	});

	it('should handle custom error types', async () => {
		// Create custom error class
		class CustomNotFoundError extends Error {
			constructor(message: string) {
				super(message);
				this.name = 'CustomNotFoundError';
			}
		}

		// Function that throws custom error
		const findWithCustomError = async (email: string) => {
			// First check if the users table exists to avoid SQL errors
			const tables = await db.db
				.selectFrom(sql`sqlite_master` as any)
				.where('type' as any, '=', 'table')
				.select(['name'])
				.execute();

			if (tables.length === 0) {
				throw new CustomNotFoundError('Users table does not exist');
			}

			// Try to find the user by email
			const result = await db.db
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
		await db.db
			.insertInto('users')
			.values({
				email: 'custom@example.com',
				name: 'Custom Error User',
				username: 'customerror',
				password: 'password123',
				followersCount: 0,
				createdAt: new Date().toISOString(),
				updatedAt: new Date().toISOString(),
			} as any)
			.execute();

		// Test with valid email (should return user)
		const user = await findWithCustomError('custom@example.com');
		expect(user).toBeDefined();
		expect(user.email).toBe('custom@example.com');

		// Test with invalid email (should throw custom error)
		try {
			await findWithCustomError('nonexistent@example.com');
			expect(true).toBe(false); // This line should not be reached
		} catch (error: any) {
			expect(error).toBeInstanceOf(CustomNotFoundError);
			expect(error.message).toBe(
				'User with email nonexistent@example.com not found'
			);
		}
	});
});
