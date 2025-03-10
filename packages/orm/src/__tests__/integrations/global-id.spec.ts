// tests/integration/global-id.spec.ts

import type { Kysely } from 'kysely';
import {
	setupTestDatabase,
	teardownTestDatabase,
} from 'tests/fixtures/test-db';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { withGlobalId } from '~/mixins/global-id';
import createModel from '~/model';

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
			.addColumn('id', 'serial', (col) => col.primaryKey())
			.addColumn('name', 'varchar(255)', (col) => col.notNull())
			.addColumn('email', 'varchar(255)', (col) => col.unique().notNull())
			.execute();

		// Create base model
		const baseModel = createModel<TestDB, 'users', 'id'>(db, 'users', 'id');

		// Add global ID support
		UserModel = withGlobalId(baseModel, {
			type: 'User',
		});

		// Seed test data
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

	it('should generate correct global IDs for database records', async () => {
		const user = await UserModel.findById(1);
		const globalId = UserModel.getGlobalId(user.id);

		expect(globalId).toBeTypeOf('string');
		expect(globalId).not.toBe('1');

		// The decoded ID should match the original
		const decoded = UserModel.decodeGlobalId(globalId);
		expect(decoded.type).toBe('User');
		expect(decoded.id).toBe(1);
	});

	it('should find records by global ID', async () => {
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

	it('should return null for invalid global IDs', async () => {
		// Create an invalid global ID
		const invalidGlobalId = 'InvalidType:1';

		const user = await UserModel.findByGlobalId(invalidGlobalId);

		expect(user).toBeNull();
	});

	it('should add global IDs to records if configured', async () => {
		// Create a model that adds global IDs to records
		const baseModel = createModel<TestDB, 'users', 'id'>(db, 'users', 'id');
		const UserModelWithEmbeddedIds = withGlobalId(baseModel, {
			type: 'User',
			addToRecords: true,
		});

		// Find a user
		const user = await UserModelWithEmbeddedIds.findById(1);

		// Check that the user has a globalId property
		expect(user).toHaveProperty('globalId');
		expect(user.globalId).toBe(UserModelWithEmbeddedIds.getGlobalId(1));

		// Check that findByGlobalId works with the embedded ID
		const foundUser = await UserModelWithEmbeddedIds.findByGlobalId(
			user.globalId
		);
		expect(foundUser).not.toBeNull();
		expect(foundUser!.id).toBe(1);
	});
});
