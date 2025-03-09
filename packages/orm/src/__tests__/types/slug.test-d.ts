import type { Selectable } from 'kysely';
import { assertType, expectTypeOf } from 'vitest';
import {
	type Operation,
	type Options,
	type SlugOptions,
	type TableValues,
	generateSlugValue,
	default as withSlug,
} from '~/mixins/slug';
import type { ModelFunctions } from '~/model';

// Define test types
interface TestDB {
	users: {
		id: number;
		name: string;
		email: string;
		slug: string;
	};
	posts: {
		id: number;
		title: string;
		slug: string;
		content: string;
	};
}

// Test the Operation type
test('Operation type is correctly defined', () => {
	expectTypeOf<Operation>().toMatchTypeOf<
		'lowercase' | 'uppercase' | 'capitalize'
	>();

	// Valid operations
	assertType<Operation>('lowercase');
	assertType<Operation>('uppercase');
	assertType<Operation>('capitalize');

	// @ts-expect-error - invalid operation should cause type error
	assertType<Operation>('invalid');
});

// Test SlugOptions type
test('SlugOptions type is correctly defined', () => {
	expectTypeOf<SlugOptions>().toMatchTypeOf<{
		separator?: string;
		truncate?: number;
		dictionary?: Record<string, string>;
	}>();

	// Valid options
	const options: SlugOptions = {
		separator: '-',
		truncate: 100,
		dictionary: { test: 'replaced' },
	};
	assertType<SlugOptions>(options);

	// @ts-expect-error - invalid property should cause type error
	assertType<SlugOptions>({ invalid: true });
});

// Test Options type
test('Options type is correctly defined', () => {
	// Valid options
	const options: Options<TestDB, 'users'> = {
		field: 'slug',
		sources: ['name', 'email'],
		operation: 'lowercase',
		slugOptions: {
			separator: '-',
		},
	};

	assertType<Options<TestDB, 'users'>>(options);

	// Test field constraint
	expectTypeOf<Options<TestDB, 'users'>>()
		.toHaveProperty('field')
		.toMatchTypeOf<'id' | 'name' | 'email' | 'slug'>();

	// Test sources constraint
	expectTypeOf<Options<TestDB, 'users'>>()
		.toHaveProperty('sources')
		.toMatchTypeOf<Array<'id' | 'name' | 'email' | 'slug'>>();

	// @ts-expect-error - invalid field should cause type error
	assertType<Options<TestDB, 'users'>>({ field: 'invalid', sources: ['name'] });

	// @ts-expect-error - invalid source should cause type error
	assertType<Options<TestDB, 'users'>>({ field: 'slug', sources: ['invalid'] });
});

// Test TableValues type
test('TableValues type is correctly defined', () => {
	// Valid values
	const userValues: TableValues<TestDB, 'users'> = {
		name: 'Test User',
		email: 'test@example.com',
	};

	assertType<TableValues<TestDB, 'users'>>(userValues);

	// Check it allows unknown values
	assertType<TableValues<TestDB, 'users'>>({
		name: 'Test',
		email: 123, // Should allow unknown types
	});

	// @ts-expect-error - invalid key should cause type error
	assertType<TableValues<TestDB, 'users'>>({ invalid: 'field' });
});

// Test generateSlugValue function
test('generateSlugValue has correct parameter and return types', () => {
	expectTypeOf(generateSlugValue).toBeFunction();

	// Check parameter types
	expectTypeOf(generateSlugValue)
		.parameter(0)
		.toMatchTypeOf<TableValues<TestDB, 'users'>>();

	expectTypeOf(generateSlugValue)
		.parameter(1)
		.toMatchTypeOf<Options<TestDB, 'users'>>();

	// Check return type
	expectTypeOf(generateSlugValue).returns.toEqualTypeOf<string | undefined>();
});

// Test withSlug mixin
test('withSlug correctly enhances model types', () => {
	// Create a mock model
	const mockModel = {} as ModelFunctions<TestDB, 'users', 'id'>;

	// Apply the mixin
	const enhanced = withSlug(mockModel, {
		field: 'slug',
		sources: ['name'],
	});

	// Test for added methods with correct signatures
	expectTypeOf(enhanced).toHaveProperty('findBySlug').toBeFunction();

	expectTypeOf(enhanced.findBySlug).parameter(0).toEqualTypeOf<string>();

	expectTypeOf(enhanced.findBySlug).returns.toMatchTypeOf<
		Promise<Selectable<TestDB['users']> | undefined>
	>();

	expectTypeOf(enhanced).toHaveProperty('insertWithSlug').toBeFunction();

	expectTypeOf(enhanced.insertWithSlug)
		.parameter(0)
		.toMatchTypeOf<TableValues<TestDB, 'users'>>();

	expectTypeOf(enhanced.insertWithSlug).returns.toMatchTypeOf<
		Promise<Selectable<TestDB['users']>>
	>();
});

// Test curried and direct forms of withSlug
test('withSlug supports both curried and direct forms', () => {
	const mockModel = {} as ModelFunctions<TestDB, 'users', 'id'>;

	// Test curried form
	const curriedResult = withSlug(mockModel);
	expectTypeOf(curriedResult).toBeFunction();

	// Test direct form with options
	const withOptionsResult = withSlug(mockModel, {
		field: 'slug',
		sources: ['name'],
	});
	expectTypeOf(withOptionsResult).toHaveProperty('findBySlug').toBeFunction();

	// Test direct form with field and source
	const withFieldAndSourceResult = withSlug(mockModel, 'slug', 'name');
	expectTypeOf(withFieldAndSourceResult)
		.toHaveProperty('findBySlug')
		.toBeFunction();
});
