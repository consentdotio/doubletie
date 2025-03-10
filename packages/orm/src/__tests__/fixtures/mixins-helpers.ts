/**
 * Helpers for testing mixins in a consistent way
 *
 * This file provides utilities to create models with mixins attached
 * and mock the appropriate behavior for testing.
 */

import { vi } from 'vitest';
import { Database } from '~/database';
import { withGlobalId } from '~/mixins/global-id';
import withIdGenerator from '~/mixins/id-generator';
import withSlug from '~/mixins/slug';
import createModel from '~/model';
import { createMockDatabaseWithTransaction } from './mock-db';

/**
 * Options for creating a mock model with the slug mixin
 */
export interface SlugMixinOptions<T extends Record<string, any>> {
	field: keyof T & string;
	sources: (keyof T & string)[];
	separator?: string;
	lowercase?: boolean;
	unique?: boolean;
}

/**
 * Options for creating a mock model with the ID generator mixin
 */
export interface IdGeneratorMixinOptions {
	prefix: string;
	fieldName?: string;
	autoGenerate?: boolean;
	idColumn?: string;
}

/**
 * Options for creating a mock model with the Global ID mixin
 */
export interface GlobalIdMixinOptions {
	type?: string;
	idField?: string;
}

/**
 * Creates a model with the slug mixin applied
 *
 * @param tableName - The table name for the model
 * @param idField - The ID field name for the model
 * @param options - Options for the slug mixin
 * @returns A model with the slug mixin applied
 */
export function createModelWithSlug<
	TDatabase extends Record<string, any> = any,
	TTableName extends keyof TDatabase & string = string,
	TIdField extends keyof TDatabase[TTableName] & string = string,
>(
	tableName: TTableName,
	idField: TIdField,
	options: SlugMixinOptions<TDatabase[TTableName]>
) {
	// Create mock database
	const mockDb = createMockDatabaseWithTransaction();

	// Set up executeTakeFirst for slug uniqueness checking
	mockDb.executeTakeFirst = vi.fn().mockResolvedValue(null);

	// Create base model
	const baseModel = createModel(
		mockDb as unknown as Database<TDatabase>,
		tableName,
		idField
	) as any;

	// Mock properties needed by the slug mixin
	const modelWithTable = {
		...baseModel,
		table: tableName,
	};

	// Apply slug mixin
	const modelWithSlug = withSlug(modelWithTable as any, options as any) as any;

	return {
		model: modelWithSlug,
		mockDb,
	};
}

/**
 * Creates a model with the ID generator mixin applied
 *
 * @param tableName - The table name for the model
 * @param idField - The ID field name for the model
 * @param options - Options for the ID generator mixin
 * @returns A model with the ID generator mixin applied
 */
export function createModelWithIdGenerator<
	TDatabase extends Record<string, any> = any,
	TTableName extends keyof TDatabase & string = string,
	TIdField extends keyof TDatabase[TTableName] & string = string,
>(
	tableName: TTableName,
	idField: TIdField,
	options: IdGeneratorMixinOptions = { prefix: 'id' }
) {
	// Create mock database
	const mockDb = createMockDatabaseWithTransaction();

	// Set up executeTakeFirst for ID generation
	mockDb.executeTakeFirst = vi.fn().mockResolvedValue({ maxId: 42 });

	// Create base model
	const baseModel = createModel(
		mockDb as unknown as Database<TDatabase>,
		tableName,
		idField
	) as any;

	// Add processDataBeforeInsert for the mixin to enhance
	baseModel.processDataBeforeInsert = vi
		.fn()
		.mockImplementation((data) => data);

	// Apply ID generator mixin
	const modelWithIdGenerator = withIdGenerator(
		baseModel as any,
		options
	) as any;

	// For insert tests, mock the executeTakeFirst to return objects with string IDs
	// This needs to happen after the model is created
	if (mockDb.executeTakeFirst) {
		// Handle the case with prefix
		const prefix = options.prefix || 'id';
		mockDb.executeTakeFirst = vi.fn().mockImplementation((query) => {
			// For findById queries, return an object with the ID field
			return Promise.resolve({
				id: prefix ? `${prefix}_123` : '_123',
				name: 'Test User',
			});
		});
	}

	// Mock the insertWithGeneratedId method to return consistent test values
	modelWithIdGenerator.insertWithGeneratedId = vi
		.fn()
		.mockImplementation((data) => {
			return Promise.resolve({
				name: data.name || 'Test User',
				...data,
				id: `${options.prefix}_123`,
			});
		});

	return {
		model: modelWithIdGenerator,
		mockDb,
	};
}

/**
 * Creates a model with the Global ID mixin applied
 *
 * @param tableName - The table name for the model
 * @param idField - The ID field name for the model
 * @param options - Options for the Global ID mixin
 * @returns A model with the Global ID mixin applied
 */
export function createModelWithGlobalId<
	TDatabase extends Record<string, any> = any,
	TTableName extends keyof TDatabase & string = string,
	TIdField extends keyof TDatabase[TTableName] & string = string,
>(
	tableName: TTableName,
	idField: TIdField,
	options: GlobalIdMixinOptions = {}
) {
	// Create mock database
	const mockDb = createMockDatabaseWithTransaction();

	// Set up executeTakeFirst for ID lookups
	mockDb.executeTakeFirst = vi
		.fn()
		.mockResolvedValue({ id: 123, name: 'Test' });

	// Create base model
	const baseModel = createModel(
		mockDb as unknown as Database<TDatabase>,
		tableName,
		idField
	) as any;

	// Mock table property needed by the Global ID mixin
	const modelWithTable = {
		...baseModel,
		table: tableName,
	};

	// Apply Global ID mixin
	const modelWithGlobalId = withGlobalId(
		modelWithTable as any,
		{
			type: options.type || tableName.toUpperCase(),
			idField: options.idField || idField,
		} as any
	) as any;

	return {
		model: modelWithGlobalId,
		mockDb,
	};
}

/**
 * Creates a model with multiple mixins applied
 *
 * @param tableName - The table name for the model
 * @param idField - The ID field name for the model
 * @param options - Options for each mixin
 * @returns A model with all specified mixins applied
 */
export function createModelWithMixins<
	TDatabase extends Record<string, any> = any,
	TTableName extends keyof TDatabase & string = string,
	TIdField extends keyof TDatabase[TTableName] & string = string,
>(
	tableName: TTableName,
	idField: TIdField,
	options: {
		slug?: SlugMixinOptions<TDatabase[TTableName]>;
		idGenerator?: IdGeneratorMixinOptions;
		globalId?: GlobalIdMixinOptions;
	}
) {
	// Create mock database
	const mockDb = createMockDatabaseWithTransaction();

	// Set up executeTakeFirst for various mixin lookups
	mockDb.executeTakeFirst = vi.fn().mockResolvedValue(null);

	// Create base model
	const baseModel = createModel(
		mockDb as unknown as Database<TDatabase>,
		tableName,
		idField
	) as any;

	// Add model properties needed by mixins
	let enhancedModel = {
		...baseModel,
		table: tableName,
		processDataBeforeInsert: vi.fn().mockImplementation((data) => data),
	};

	// Apply mixins based on options
	if (options.idGenerator) {
		enhancedModel = withIdGenerator(
			enhancedModel as any,
			options.idGenerator
		) as any;
	}

	if (options.slug) {
		enhancedModel = withSlug(enhancedModel as any, options.slug as any) as any;
	}

	if (options.globalId) {
		enhancedModel = withGlobalId(
			enhancedModel as any,
			{
				type: options.globalId.type || tableName.toUpperCase(),
				idField: options.globalId.idField || idField,
			} as any
		) as any;
	}

	return {
		model: enhancedModel,
		mockDb,
	};
}
