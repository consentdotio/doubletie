import type { Kysely } from 'kysely';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { Database, ModelRegistry } from '~/database';
import createModel from '~/model';
import { withGlobalId } from '../../mixins/global-id';
import { setupTestDatabase, teardownTestDatabase } from '../fixtures/test-db';

// Test database type
interface TestDB {
	users: {
		id: number;
		name: string;
		email: string;
	};
}

describe('integration: Global ID mixin', () => {
	let db: Kysely<TestDB>;
	let UserModel: any;

	beforeEach(async () => {
		// Set up test database
		db = (await setupTestDatabase()) as Kysely<TestDB>;

		// Create users table
		await db.schema
			.createTable('users')
			.ifNotExists()
			.addColumn('id', 'serial', (col) => col.primaryKey())
			.addColumn('name', 'varchar(255)', (col) => col.notNull())
			.addColumn('email', 'varchar(255)', (col) => col.unique().notNull())
			.execute();

		// Create base model
		// We need to cast the db to any to bypass type checking for the integration test
		const baseModel = createModel<TestDB, 'users', 'id'>(
			db as any as Database<TestDB, ModelRegistry<TestDB>>,
			'users',
			'id'
		);

		// Add global ID support
		UserModel = withGlobalId(baseModel, 'id', 'User');

		// Delete existing data and seed test data
		await db.deleteFrom('users').execute();
		await db
			.insertInto('users')
			.values([
				{ id: 1, name: 'User One', email: 'user1@example.com' },
				{ id: 2, name: 'User Two', email: 'user2@example.com' },
			])
			.execute();
	});

	afterEach(async () => {
		await teardownTestDatabase(db);
	});

	it.skip('should generate correct global IDs for database records', async () => {
		const user = await UserModel.findById(1);
		const globalId = UserModel.getGlobalId(user.id);

		expect(globalId).toBeTypeOf('string');
		expect(globalId).not.toBe('1');

		// The decoded ID should match the original
		const localId = UserModel.getLocalId(globalId);
		// SQLite might return the ID as a string, so we need to parse it to a number
		const parsedId =
			typeof localId === 'string' ? parseInt(localId, 10) : localId;
		expect(parsedId).toBe(1);
	});

	it.skip('should find records by global ID', async () => {
		// Get a user to generate a global ID
		const originalUser = await UserModel.findById(1);
		const globalId = UserModel.getGlobalId(originalUser.id);

		// Find the user by global ID
		const user = await UserModel.findByGlobalId(globalId);

		expect(user).not.toBeNull();
		expect(user.id).toBe(1);
		expect(user.name).toBe('User One');
		expect(user.email).toBe('user1@example.com');
	});

	it.skip('should return null for invalid global IDs', async () => {
		// Create an invalid global ID
		const invalidGlobalId = 'InvalidType_1';

		const user = await UserModel.findByGlobalId(invalidGlobalId);

		expect(user).toBeUndefined();
	});

	it.skip('should find records by multiple global IDs', async () => {
		// Generate global IDs for both users
		const globalId1 = UserModel.getGlobalId(1);
		const globalId2 = UserModel.getGlobalId(2);

		// Find users by global IDs
		const users = await UserModel.findByGlobalIds([globalId1, globalId2]);

		expect(users).toHaveLength(2);
		expect(users[0].id).toBe(1);
		expect(users[1].id).toBe(2);
	});
});
