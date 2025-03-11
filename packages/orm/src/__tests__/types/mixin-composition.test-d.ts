import type { Selectable } from 'kysely';
import { assertType, expectTypeOf, test } from 'vitest';
import { withGlobalId } from '../../mixins/global-id.js';

import withSlug from '../../mixins/slug';
import { createModel } from '../../model.js';

// Define test database schema
interface TestDB {
	users: {
		id: number;
		name: string;
		email: string;
		slug: string;
		status: string;
	};
}

// Define the expected enhanced model types for type testing
interface EnhancedModelFunctions {
	// Original model properties
	db: any;
	table: string;
	id: string;
	noResultError: any;
	isolated: boolean;

	// Database operations
	selectFrom: Function;
	updateTable: Function;
	insertInto: Function;
	deleteFrom: Function;
	transaction: Function;

	// Utility methods
	ref: Function;
	dynamic: Function;
	fn: Function;

	// Find operations
	find: Function;
	findOne: Function;
	findById: Function;
	findByIds: Function;
	getById: Function;

	// Added by slug mixin
	findBySlug: (
		slug: string
	) => Promise<Selectable<TestDB['users']> | undefined>;
	insertWithSlug: (data: any) => Promise<Selectable<TestDB['users']>>;

	// Added by globalId mixin
	getGlobalId: (id: number) => string;
	findByGlobalId: (
		globalId: string
	) => Promise<Selectable<TestDB['users']> | null>;
}

// Type for user extensions with mixin
type UserExtensions = {
	status: string;
	lastLogin: Date;
};

test.skip('mixin composition preserves types correctly', () => {
	// Mock DB
	const db = {} as any;

	// Create base model
	const userModel = createModel<TestDB, 'users', 'id'>(db, 'users', 'id');

	// Apply mixins
	const modelWithSlug = withSlug(userModel, {
		field: 'slug',
		sources: ['name'],
	});

	const modelWithBothMixins = withGlobalId(modelWithSlug, {
		type: 'User',
	});

	// Check that base model methods are preserved
	expectTypeOf(modelWithBothMixins).toHaveProperty('findById').toBeFunction();

	// Check that slug mixin methods are added
	expectTypeOf(modelWithBothMixins).toHaveProperty('findBySlug').toBeFunction();

	// Check that global ID mixin methods are added
	expectTypeOf(modelWithBothMixins)
		.toHaveProperty('getGlobalId')
		.toBeFunction();

	// Verify parameter types for enhanced methods
	expectTypeOf(modelWithBothMixins.findBySlug).parameter(0).toBeString();

	expectTypeOf(modelWithBothMixins.getGlobalId).parameter(0).toBeNumber();

	// Verify return types for enhanced methods
	expectTypeOf(modelWithBothMixins.findBySlug).returns.toMatchTypeOf<
		Promise<Selectable<TestDB['users']> | undefined>
	>();

	expectTypeOf(modelWithBothMixins.getGlobalId).returns.toBeString();
});

test.skip('mixin factories create properly typed functions', () => {
	// Define a mixin factory
	const createUserExtensionMixin = <T extends Record<string, any>>(
		extensions: T
	) => {
		return <M>(
			model: M
		): M & {
			getExtensions: () => T;
			withExtensions: <D>(data: D) => D & T;
		} => {
			return {
				...(model as any),
				getExtensions: () => extensions,
				withExtensions: <D>(data: D): D & T => ({
					...data,
					...extensions,
				}),
			};
		};
	};

	// Create a typed extension
	const userExtensions: UserExtensions = {
		status: 'active',
		lastLogin: new Date(),
	};

	// Create the mixin
	const withUserExtensions = createUserExtensionMixin(userExtensions);

	// Mock DB and model
	const db = {} as any;
	const userModel = createModel<TestDB, 'users', 'id'>(db, 'users', 'id');

	// Apply the mixin
	const enhancedModel = withUserExtensions(userModel);

	// Check method types
	expectTypeOf(
		enhancedModel.getExtensions
	).returns.toMatchTypeOf<UserExtensions>();

	expectTypeOf(enhancedModel.withExtensions).parameter(0).toBeAny();

	// Check return type of withExtensions
	type TestData = { name: string };
	expectTypeOf(
		enhancedModel.withExtensions<TestData>({ name: 'Test' })
	).toMatchTypeOf<TestData & UserExtensions>();
});

test.skip('complex mixin composition is properly typed', () => {
	// Mock DB
	const db = {} as any;

	// Create base model
	const userModel = createModel<TestDB, 'users', 'id'>(db, 'users', 'id');

	// Apply multiple mixins and assert type
	const enhancedModel = withGlobalId(
		withSlug(userModel, {
			field: 'slug',
			sources: ['name'],
		}),
		{
			type: 'User',
		}
	);

	// Assert the enhanced model matches our expected interface
	assertType<EnhancedModelFunctions>(enhancedModel);

	// Test that the mixin composition allows for chaining methods
	type ChainedResult = ReturnType<
		typeof enhancedModel.findByGlobalId
	> extends Promise<infer U>
		? U extends null
			? never
			: U extends { id: number }
				? ReturnType<typeof enhancedModel.getGlobalId>
				: never
		: never;

	// Verify ChainedResult is a string (the return type of getGlobalId)
	expectTypeOf<ChainedResult>().toEqualTypeOf<string | never>();
});
