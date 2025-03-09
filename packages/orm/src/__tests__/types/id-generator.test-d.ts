// tests/types/id-generator.test-d.ts

import { assertType, expectTypeOf } from 'vitest';
import withIdGenerator from '~/mixins/id-generator';
import createModel from '~/model';

// Define test types
interface TestDB {
	users: {
		id: number;
		name: string;
	};
	posts: {
		id: string;
		title: string;
	};
}

// Test ID generator options type
interface NumericIdOptions {
	type: 'numeric';
	fieldName: string;
	startValue?: number;
	increment?: number;
}

interface UuidIdOptions {
	type: 'uuid';
	fieldName: string;
	version?: number;
}

interface PrefixedIdOptions {
	type: 'prefixed';
	fieldName: string;
	prefix: string;
	separator?: string;
	padding?: number;
}

interface TimestampIdOptions {
	type: 'timestamp';
	fieldName: string;
	withRandomSuffix?: boolean;
}

interface CustomIdOptions {
	type: 'custom';
	fieldName: string;
	generator: (model: any) => Promise<string | number>;
}

type IdGeneratorOptions =
	| NumericIdOptions
	| UuidIdOptions
	| PrefixedIdOptions
	| TimestampIdOptions
	| CustomIdOptions;

// Test types
test('withIdGenerator enhances model with correct types', () => {
	// Mock DB
	const db = {} as any;

	// Create models with different ID types
	const userModel = createModel<TestDB, 'users', 'id'>(db, 'users', 'id');
	const postModel = createModel<TestDB, 'posts', 'id'>(db, 'posts', 'id');

	// Enhance with ID generator
	const numericIdModel = withIdGenerator(userModel, {
		type: 'numeric',
		fieldName: 'id',
	});

	const uuidIdModel = withIdGenerator(postModel, {
		type: 'uuid',
		fieldName: 'id',
	});

	// Test return type of generateId matches the table's ID type
	expectTypeOf(numericIdModel.generateId).returns.toEqualTypeOf<
		Promise<number>
	>();

	expectTypeOf(uuidIdModel.generateId).returns.toEqualTypeOf<Promise<string>>();

	// Test insertWithGeneratedId parameter type
	expectTypeOf(numericIdModel.insertWithGeneratedId)
		.parameter(0)
		.toMatchTypeOf<Partial<TestDB['users']>>();

	expectTypeOf(uuidIdModel.insertWithGeneratedId)
		.parameter(0)
		.toMatchTypeOf<Partial<TestDB['posts']>>();

	// Test insertWithGeneratedId return type
	expectTypeOf(numericIdModel.insertWithGeneratedId).returns.toMatchTypeOf<
		Promise<TestDB['users']>
	>();

	expectTypeOf(uuidIdModel.insertWithGeneratedId).returns.toMatchTypeOf<
		Promise<TestDB['posts']>
	>();
});

// Test options types
test('ID generator options are correctly typed', () => {
	// Valid numeric options
	assertType<IdGeneratorOptions>({
		type: 'numeric',
		fieldName: 'id',
		startValue: 1000,
		increment: 1,
	});

	// Valid UUID options
	assertType<IdGeneratorOptions>({
		type: 'uuid',
		fieldName: 'id',
		version: 4,
	});

	// Valid prefixed options
	assertType<IdGeneratorOptions>({
		type: 'prefixed',
		fieldName: 'id',
		prefix: 'USER',
		separator: '-',
		padding: 4,
	});

	// Valid timestamp options
	assertType<IdGeneratorOptions>({
		type: 'timestamp',
		fieldName: 'id',
		withRandomSuffix: true,
	});

	// Valid custom options
	assertType<IdGeneratorOptions>({
		type: 'custom',
		fieldName: 'id',
		generator: async () => 'custom-id',
	});

	// @ts-expect-error - invalid type should cause type error
	assertType<IdGeneratorOptions>({
		type: 'invalid',
		fieldName: 'id',
	});

	// @ts-expect-error - missing required property should cause type error
	assertType<IdGeneratorOptions>({
		type: 'prefixed',
		fieldName: 'id',
	});
});

// Test model enhancement types
test('ID generator correctly enhances model type', () => {
	const db = {} as any;
	const baseModel = createModel<TestDB, 'users', 'id'>(db, 'users', 'id');

	const enhancedModel = withIdGenerator(baseModel, {
		type: 'numeric',
		fieldName: 'id',
	});

	// Check that the enhanced model has the original model's properties
	expectTypeOf(enhancedModel).toHaveProperty('findById').toBeFunction();

	// Check that the enhanced model has the new properties
	expectTypeOf(enhancedModel).toHaveProperty('generateId').toBeFunction();

	expectTypeOf(enhancedModel)
		.toHaveProperty('insertWithGeneratedId')
		.toBeFunction();
});
