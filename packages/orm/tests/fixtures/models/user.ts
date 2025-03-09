import type { Kysely } from 'kysely';
import withGlobalId from '../../../src/mixins/global-id';
import withSlug from '../../../src/mixins/slug';
import { createModel } from '../../../src/model';
import type { TestDatabase } from './base-schema';

/**
 * Creates a user model for testing
 */
export function createUserModel(db: Kysely<TestDatabase>) {
	// Create the basic model
	const UserModel = createModel<TestDatabase, 'users', 'id'>(db, 'users', 'id');

	// Return the basic model for unit tests
	return UserModel;
}

/**
 * Creates a user model with mixins for testing
 */
export function createUserModelWithMixins(db: Kysely<TestDatabase>) {
	// Create the base model
	const UserModel = createUserModel(db);

	// Apply mixins
	const ModelWithGlobalId = withGlobalId(UserModel, {
		type: 'User',
	});

	const ModelWithSlug = withSlug(ModelWithGlobalId, {
		field: 'slug',
		sources: ['name'],
	});

	return ModelWithSlug;
}

/**
 * Creates a mock user model for pure unit testing
 */
export function createMockUserModel() {
	// Create mock functions
	const mockFindOne = vi.fn();
	const mockInsertInto = vi.fn(() => ({
		values: vi.fn(() => ({
			returning: vi.fn(() => ({
				executeTakeFirst: vi.fn(),
			})),
		})),
	}));

	// Create a basic mock model
	const MockUserModel = {
		db: {} as Kysely<TestDatabase>,
		table: 'users' as const,
		id: 'id' as const,
		findOne: mockFindOne,
		insertInto: mockInsertInto,
		// Add other methods as needed for specific tests
	};

	return MockUserModel;
}
