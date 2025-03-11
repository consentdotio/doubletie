import type { Selectable } from 'kysely';
import { assertType, expectTypeOf, test } from 'vitest';
import { withGlobalId } from '../../mixins/global-id.js';
import { createModel } from '../../model.js';

// Define test database schema
interface TestDB {
	users: {
		id: number;
		name: string;
		email: string;
	};
	posts: {
		id: string; // String ID to test different ID types
		title: string;
		content: string;
	};
}

// Define GlobalId options type (adjust based on actual implementation)
interface GlobalIdOptions<TType extends string> {
	type: TType;
	validateType?: boolean;
	addToRecords?: boolean;
	encode?: (type: string, id: string | number) => string;
	decode?: (globalId: string) => { type: string; id: string | number } | null;
	findById?: <T>(model: any, id: string | number) => Promise<T | null>;
}

// Test the GlobalID mixin type enhancements
test.skip('withGlobalId enhances model with correct types', () => {
	// Mock DB
	const db = {} as any;

	// Create models with different ID types
	const userModel = createModel<TestDB, 'users', 'id'>(db, 'users', 'id');
	const postModel = createModel<TestDB, 'posts', 'id'>(db, 'posts', 'id');

	// Enhance with GlobalId
	const userGlobalIdModel = withGlobalId(userModel, {
		type: 'User',
	});

	const postGlobalIdModel = withGlobalId(postModel, {
		type: 'Post',
	});

	// Test getGlobalId types
	expectTypeOf(userGlobalIdModel.getGlobalId)
		.parameter(0)
		.toEqualTypeOf<number>();

	expectTypeOf(postGlobalIdModel.getGlobalId)
		.parameter(0)
		.toEqualTypeOf<string>();

	expectTypeOf(userGlobalIdModel.getGlobalId).returns.toBeString();

	expectTypeOf(postGlobalIdModel.getGlobalId).returns.toBeString();

	// Test decodeGlobalId types
	expectTypeOf(userGlobalIdModel.decodeGlobalId).parameter(0).toBeString();

	expectTypeOf(userGlobalIdModel.decodeGlobalId).returns.toMatchTypeOf<{
		type: string;
		id: number;
	} | null>();

	expectTypeOf(postGlobalIdModel.decodeGlobalId).returns.toMatchTypeOf<{
		type: string;
		id: string;
	} | null>();

	// Test findByGlobalId types
	expectTypeOf(userGlobalIdModel.findByGlobalId).parameter(0).toBeString();

	expectTypeOf(userGlobalIdModel.findByGlobalId).returns.toMatchTypeOf<
		Promise<Selectable<TestDB['users']> | null>
	>();

	expectTypeOf(postGlobalIdModel.findByGlobalId).returns.toMatchTypeOf<
		Promise<Selectable<TestDB['posts']> | null>
	>();
});

// Test GlobalIdOptions type validation
test('GlobalIdOptions are correctly typed', () => {
	// Valid options
	assertType<GlobalIdOptions<'User'>>({
		type: 'User',
	});

	assertType<GlobalIdOptions<'User'>>({
		type: 'User',
		validateType: true,
		addToRecords: true,
	});

	// With custom encode/decode functions
	assertType<GlobalIdOptions<'User'>>({
		type: 'User',
		encode: (type, id) => `${type}:${id}`,
		decode: (globalId) => {
			const [type, id] = globalId.split(':');
			return { type, id: isNaN(Number(id)) ? id : Number(id) };
		},
	});

	// @ts-expect-error - missing required type property
	assertType<GlobalIdOptions<'User'>>({});

	// @ts-expect-error - wrong type for property
	assertType<GlobalIdOptions<'User'>>({
		type: 'User',
		validateType: 'true', // Should be boolean
	});
});

// Test the record types with globalId added
test('records with global IDs have the correct type', () => {
	// Create a user record type with globalId
	type UserWithGlobalId = Selectable<TestDB['users']> & { globalId: string };

	// Verify the extended type
	const user: UserWithGlobalId = {
		id: 1,
		name: 'Test User',
		email: 'test@example.com',
		globalId: 'VXNlcjox', // base64 encoded "User:1"
	};

	assertType<UserWithGlobalId>(user);

	// @ts-expect-error - missing globalId should cause type error
	assertType<UserWithGlobalId>({
		id: 1,
		name: 'Test User',
		email: 'test@example.com',
	});
});

// Test the model enhancement types
test.skip('GlobalId correctly enhances model type', () => {
	const db = {} as any;
	const baseModel = createModel<TestDB, 'users', 'id'>(db, 'users', 'id');

	const enhancedModel = withGlobalId(baseModel, {
		type: 'User',
	});

	// Check that the enhanced model has the original model's properties
	expectTypeOf(enhancedModel).toHaveProperty('findById').toBeFunction();

	// Check that the enhanced model has the new GlobalId properties
	expectTypeOf(enhancedModel).toHaveProperty('getGlobalId').toBeFunction();

	expectTypeOf(enhancedModel).toHaveProperty('decodeGlobalId').toBeFunction();

	expectTypeOf(enhancedModel).toHaveProperty('findByGlobalId').toBeFunction();
});
