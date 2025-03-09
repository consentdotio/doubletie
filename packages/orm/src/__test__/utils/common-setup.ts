import type { Selectable } from 'kysely';
import { afterAll, beforeAll } from 'vitest';
import { RelationType } from '../../constants';
import {
	withCreatedAt,
	withCursorable,
	withGlobalId,
	withSlug,
	withUpdatedAt,
} from '../../mixins';
import createModel, { type ModelFunctions } from '../../model';

// Import table types and db instance from db.ts
import {
	type Articles,
	type Comments,
	type DB,
	type Products,
	type Quizzes,
	type Users,
	cleanupDatabase,
	db,
	fromSqliteDate,
	initializeDatabase,
	resetDatabase,
	toSqliteDate,
} from './migration';

// Import generateId from the id-generator module
import { generateId } from '../../id-generator';

// Initialize database once before all tests
beforeAll(async () => {
	console.log('Initializing database for all unit tests...');
	await initializeDatabase();
	console.log('Database initialization complete for unit tests');
});

// Clean up database after all tests
afterAll(async () => {
	console.log('Cleaning up database after all unit tests...');
	await cleanupDatabase();
	console.log('Database cleanup complete for unit tests');
});

// Constants
export const SortKey = {
	CREATED_AT: 'CREATED_AT',
	FOLLOWERS_COUNT: 'FOLLOWERS_COUNT',
} as const;

// Utility functions for extending model types
/**
 * Utility function to extend model types with additional fields
 *
 * @typeParam TBaseModel - The original model type
 * @typeParam TExtFields - Additional fields to extend the model with
 * @param model - The model to extend
 * @returns A function that takes a callback using the extended model
 */
export function withExtendedTypes<
	TBaseModel,
	TExtFields extends Record<string, any>,
>(model: TBaseModel) {
	// Return a function that takes a callback which uses the extended model type
	return function query<TResultType>(
		callback: (model: TBaseModel) => TResultType
	): TResultType {
		// Just pass through to the original model
		// This is just for type safety, not actually adding functionality
		return callback(model);
	};
}

/**
 * Creates a typed mixin pipeline for model enhancement
 * @param baseModel The base model to enhance
 * @returns A function that accepts mixins and returns the enhanced model
 */
export function createTypedMixins<
	TBaseDB,
	TExtDB,
	TTableName extends keyof TBaseDB & string,
	TExtTableName extends keyof TExtDB & string,
	TIdColumnName extends keyof TBaseDB[TTableName] & string,
	TResultType,
>(
	baseModel: ModelFunctions<TBaseDB, TTableName, TIdColumnName>,
	_extTableName: TExtTableName
) {
	return function applyMixins<TM1, TM2, TM3, TM4>(
		mixin1: (model: ModelFunctions<TBaseDB, TTableName, TIdColumnName>) => TM1,
		mixin2?: (model: TM1) => TM2,
		mixin3?: (model: TM2) => TM3,
		mixin4?: (model: TM3) => TM4
	): TResultType {
		// Apply the first mixin
		const m1 = mixin1(baseModel);

		// Apply additional mixins if provided
		if (!mixin2) return m1 as unknown as TResultType;
		const m2 = mixin2(m1);

		if (!mixin3) return m2 as unknown as TResultType;
		const m3 = mixin3(m2);

		if (!mixin4) return m3 as unknown as TResultType;
		const m4 = mixin4(m3);

		return m4 as unknown as TResultType;
	};
}

// Create base model for users
export const UserModel = createModel<DB, 'users', 'id'>(db, 'users', 'id');

// Create models with mixins applied - use proper function chaining
// Explicitly cast any types that need clarification
const MixinUserModelWithSlug = withSlug(UserModel as any, 'slug', 'name');
export const MixinUserModel = withUpdatedAt(
	withCreatedAt(MixinUserModelWithSlug as any, 'createdAt' as any),
	'updatedAt' as any
) as any;

// Add the selectFrom method that other methods depend on
MixinUserModel.selectFrom = () => db.db.selectFrom('users');

// Fix the findOne method to use the selectFrom method
MixinUserModel.findOne = async function <ColumnName extends keyof Users>(
	column: ColumnName,
	value: any
): Promise<Selectable<Users> | undefined> {
	return (this.selectFrom() as any)
		.where(column as any, '=', value)
		.selectAll()
		.executeTakeFirst();
};

// Ensure deleteFrom is correctly implemented
MixinUserModel.deleteFrom = () => db.db.deleteFrom('users');

// Also add an insertTable method that can be used by insertOne and other methods
MixinUserModel.insertTable = () => db.db.insertInto('users');

// Add an updateTable method for updates
MixinUserModel.updateTable = () => db.db.updateTable('users');

// Add the getOne method to be used by getByEmail - use executeTakeFirstOrThrow
// instead of manual error handling
MixinUserModel.getOne = async function <ColumnName extends keyof Users>(
	column: ColumnName,
	value: any
): Promise<Selectable<Users>> {
	return (this.selectFrom() as any)
		.where(column as any, '=', value)
		.selectAll()
		.executeTakeFirstOrThrow();
};

// Create base model for comments with withCursorable mixin
const CommentsBaseModel = createModel<DB, 'comments', 'id'>(
	db,
	'comments',
	'id'
);
const CommentsWithCreated = withCreatedAt(
	CommentsBaseModel as any,
	'createdAt' as any
) as any;
const CommentsWithUpdated = withUpdatedAt(
	CommentsWithCreated as any,
	'updatedAt' as any
) as any;
export const CommentsModel = withCursorable(
	CommentsWithUpdated as any,
	{ cursorField: 'createdAt', idField: 'id' } as any
) as any;

// Create product model with global ID feature
const ProductsBaseModel = createModel<DB, 'products', 'id'>(
	db,
	'products',
	'id'
);
const ProductsWithCreated = withCreatedAt(
	ProductsBaseModel as any,
	'createdAt' as any
) as any;
const ProductsWithUpdated = withUpdatedAt(
	ProductsWithCreated as any,
	'updatedAt' as any
) as any;
export const ProductModel = withGlobalId(ProductsWithUpdated, 'id', 'PRD');

// Add selectFrom and other table methods to ProductModel
(ProductModel as any).selectFrom = () => db.db.selectFrom('products') as any;

(ProductModel as any).insertTable = () => db.db.insertInto('products') as any;

ProductModel.updateTable = () => db.db.updateTable('products') as any;

ProductModel.deleteFrom = () => db.db.deleteFrom('products') as any;

// Add parseGlobalId directly to the ProductModel to override the mixin's implementation
(ProductModel as any).parseGlobalId = (
	globalId: string | null | undefined
): string | null => {
	if (!globalId) return null;
	if (typeof globalId !== 'string' || globalId.trim() === '') return null;

	if (globalId.startsWith('PRD_')) {
		// Return the part after the first underscore
		return globalId.substring(4); // Skip 'PRD_'
	}

	// If it doesn't match our format, return the original string
	return globalId;
};

// Implement insertWithGlobalId method
(ProductModel as any).insertWithGlobalId = async function (data: any) {
	// Generate a UUID for the product
	const id = generateId('prd');

	// Prepare data with timestamp
	const now = new Date();
	const processedData = {
		...data,
		id,
		createdAt: data.createdAt || now,
		updatedAt: data.updatedAt || now,
	};

	// Simulate database insert
	const result = await (this as any)
		.insertTable()
		.values(processedData)
		.returningAll()
		.executeTakeFirst();

	return result;
};

// Create article model with slug and global ID
const ArticlesBaseModel = createModel<DB, 'articles', 'id'>(
	db,
	'articles',
	'id'
);
const ArticlesWithCreated = withCreatedAt(
	ArticlesBaseModel as any,
	'createdAt' as any
) as any;
const ArticlesWithUpdated = withUpdatedAt(
	ArticlesWithCreated as any,
	'updatedAt' as any
) as any;

const ArticlesWithSlug = withSlug(ArticlesWithUpdated, 'slug', 'title');
export const ArticleModel = withGlobalId(ArticlesWithSlug as any, 'id', 'ART');

// Add updateTable method to ArticleModel
ArticleModel.updateTable = () => db.db.updateTable('articles') as any;

// Add insertTable method to ArticleModel too
(ArticleModel as any).insertTable = () => db.db.insertInto('articles') as any;

// Define relation between users and comments
export const relations = {
	comments: {
		type: RelationType.HasManyRelation,
		model: CommentsModel,
		foreignKey: 'userId',
	},
};

// Enhanced model type with additional methods
export type EnhancedUserModelType = typeof MixinUserModel & {
	relations: typeof relations;
	findByEmail: (email: string) => Promise<Selectable<Users> | undefined>;
	getByEmail: (email: string) => Promise<Selectable<Users>>;
	insertOneWithSlug: (data: Partial<Users>) => Promise<Selectable<Users>>;
	deleteOne: (column: keyof Users, value: any) => Promise<any>;
	findByIdAndUpdate: (
		id: number,
		data: Partial<Users>
	) => Promise<Selectable<Users> | undefined>;
	findRelatedById: (relation: any, id: any) => Promise<any>;
	findRelatedAndCombine: (
		relation: any,
		models: any[],
		field: string
	) => Promise<any[]>;
	getRelatedById: (relation: any, id: any) => Promise<any>;
};

// Create the enhanced user model with additional methods
export const EnhancedUserModel = {
	...MixinUserModel,
	relations,

	findByEmail(email: string) {
		return this.findOne('email', email);
	},

	getByEmail(email: string) {
		return this.getOne('email', email);
	},

	async insertOneWithSlug(data: Partial<Users>) {
		// Apply slug logic to generate username from name
		const now = new Date().toISOString();
		const dataWithSlug = {
			...data,
			username:
				data.username ||
				(data.name ? data.name.toLowerCase().replace(/\s+/g, '-') : ''),
			// Convert Date objects to strings for SQLite
			createdAt: data.createdAt ? toSqliteDate(data.createdAt) : now,
			updatedAt: data.updatedAt ? toSqliteDate(data.updatedAt) : now,
		};

		// Use insertInto directly instead of insertOne
		return this.insertInto()
			.values(dataWithSlug as any)
			.returningAll()
			.executeTakeFirstOrThrow();
	},

	async deleteOne(column: keyof Users, value: any) {
		return this.deleteFrom().where(column, '=', value).execute();
	},

	async findByIdAndUpdate(id: number, data: Partial<Users>) {
		// Convert Date objects to strings for proper SQLite handling
		const processedData: Record<string, any> = { ...data };
		if (data.createdAt) {
			processedData.createdAt = toSqliteDate(data.createdAt);
		}
		if (data.updatedAt) {
			processedData.updatedAt = toSqliteDate(data.updatedAt);
		}

		// Update the record
		await this.updateTable().set(processedData).where('id', '=', id).execute();

		// Fetch the updated record
		return this.findById(id);
	},

	async findRelatedById(relation: any, id: any) {
		// Get the model and foreign key from the relation
		const { model, foreignKey } = relation;

		// Select all columns from the related table
		return model.selectFrom().where(foreignKey, '=', id).selectAll().execute();
	},

	async findRelatedAndCombine(relation: any, models: any[], field: string) {
		if (!models || models.length === 0) return [];

		// Extract IDs from the models
		const ids = models.map((m) => m[field]);
		if (ids.length === 0) return models;

		// Get the model and foreign key from the relation
		const { model, foreignKey } = relation;

		// Fetch all related records for these IDs
		const related = await (model as any)
			.selectFrom()
			.where(foreignKey as any, 'in', ids)
			.selectAll()
			.execute();

		// Map related records by the foreign key
		const relatedByKey = related.reduce(
			(acc: Record<string, any[]>, item: any) => {
				const key = item[foreignKey];
				if (!acc[key]) acc[key] = [];
				acc[key].push(item);
				return acc;
			},
			{} as Record<string, any[]>
		);

		// Combine models with their related records
		return models.map((m) => ({
			...m,
			related: relatedByKey[m[field]] || [],
		}));
	},

	async getRelatedById(relation: any, id: any) {
		return this.findRelatedById(relation, id);
	},
} as EnhancedUserModelType;

// Non-isolated model base for testing
export const NonIsolatedUserModel = {
	...MixinUserModel,
	isolated: false,
	selectFrom: () => {
		throw new Error(
			'Cannot use selectFrom() in not isolated model. Call isolate({ Model }) first.'
		);
	},
	findById: () => {
		throw new Error(
			'Cannot use selectFrom() in not isolated model. Call isolate({ Model }) first.'
		);
	},
	findOne: () => {
		throw new Error(
			'Cannot use selectFrom() in not isolated model. Call isolate({ Model }) first.'
		);
	},
};

// Define the isolated model interface
export interface IsolatedUserModelInterface {
	isolated: boolean;
	findById: (id: number) => Promise<Selectable<Users> | undefined>;
	findOne: (
		column: keyof Users,
		value: any
	) => Promise<Selectable<Users> | undefined>;
	insertOne: (data: Partial<Users>) => Promise<Selectable<Users>>;
	selectFrom: any; // Add this to match the NonIsolatedUserModel shape
	[key: string]: any; // Allow other properties from MixinUserModel
}

// Create the isolated model implementation
export const IsolatedUserModel: IsolatedUserModelInterface = {
	...MixinUserModel,
	isolated: true,
	selectFrom: () => db.db.selectFrom('users'),
	async findById(id: number) {
		// This implementation uses the real database
		return db.db
			.selectFrom('users')
			.where('id', '=', id)
			.selectAll()
			.executeTakeFirst();
	},
	async findOne(column: keyof Users, value: any) {
		// This implementation uses the real database
		return db.db
			.selectFrom('users')
			.where(column, '=', value)
			.selectAll()
			.executeTakeFirst();
	},
	async insertOne(data: Partial<Users>) {
		const processedData = {
			...data,
			createdAt: data.createdAt
				? toSqliteDate(data.createdAt)
				: new Date().toISOString(),
			updatedAt: data.updatedAt
				? toSqliteDate(data.updatedAt)
				: new Date().toISOString(),
		};

		return db.db
			.insertInto('users')
			.values(processedData as any)
			.returningAll()
			.executeTakeFirstOrThrow();
	},
};

// Helper to create a strongly-typed isolated model
export function createIsolated<TModel>(model: TModel): TModel {
	return {
		...model,
		isolated: true,
	} as TModel;
}

// Create basic test model for user operations
export type TestModelType = ModelFunctions<DB, 'users', 'id'> & {
	insertOne: (data: Partial<Users>) => Promise<Selectable<Users>>;
	deleteOne: (column: keyof Users, value: any) => Promise<any>;
};

export const TestUserModel = {
	...MixinUserModel,
	async insertOne(data: Partial<Users>) {
		// Implementation
		return data as any;
	},
	async deleteOne(column: keyof Users, value: any) {
		// Implementation
		return {} as any;
	},
} as any as TestModelType;

// Custom type for extended CommentsModel with cursor methods
export interface CursorableCommentsModelInterface {
	insertOne: (data: Partial<Comments>) => Promise<Selectable<Comments>>;
	getCursorableConnection: (options: any) => Promise<any>;
	[key: string]: any; // Allow other properties from CommentsModel
}

// Create comment model helpers for testing
export const CommentTestModel: CursorableCommentsModelInterface = {
	...CommentsModel,

	// Add method for inserting comments with real database operations
	async insertOne(data: Partial<Comments>) {
		const processedData = {
			...data,
			createdAt: data.createdAt
				? toSqliteDate(data.createdAt)
				: toSqliteDate(new Date()),
			updatedAt: data.updatedAt
				? toSqliteDate(data.updatedAt)
				: toSqliteDate(new Date()),
		};

		return db.db
			.insertInto('comments')
			.values(processedData as any)
			.returningAll()
			.executeTakeFirstOrThrow();
	},

	// Improved implementation of getCursorableConnection
	async getCursorableConnection(options: any) {
		// Parse options
		const {
			first = 10,
			after,
			last,
			before,
			sortKey = SortKey.CREATED_AT,
			func,
			oneMore = true,
		} = options || {};

		// Start query builder
		let query = db.db.selectFrom('comments');

		// Sort field is based on sort key
		const sortField = sortKey === SortKey.CREATED_AT ? 'createdAt' : 'id';

		// Determine if this is forward or backward pagination
		const isBackward = typeof last !== 'undefined';

		// Apply limit based on direction
		const limit = isBackward ? last : first;

		// Apply custom query filter if provided
		if (func) {
			query = func(query);
		}

		// Apply cursor-based pagination
		if (after) {
			// For forward pagination with 'after'
			query = query.where(sortField, '>', after);
		} else if (before) {
			// For backward pagination with 'before'
			query = query.where(sortField, '<', before);
		}

		// Apply order
		if (isBackward) {
			// For backward pagination, we need recent items first
			query = query.orderBy(sortField, 'desc');
		} else {
			// For forward pagination, oldest first
			query = query.orderBy(sortField, 'asc');
		}

		// Add one more item to determine if there are more pages
		const fetchLimit = oneMore ? limit + 1 : limit;
		query = query.limit(fetchLimit);

		// Execute the query
		let nodes = await query.selectAll().execute();

		// Get total count (separate query)
		let countQuery = db.db
			.selectFrom('comments')
			.select(db.db.fn.count<number>('id').as('count'));

		// Apply the same filter conditions to count query
		if (func) {
			countQuery = func(countQuery);
		}

		const countResult = await countQuery.executeTakeFirst();
		const totalCount = countResult?.count || 0;

		// Determine if we have next/previous page
		let hasNextPage = false;
		let hasPreviousPage = false;

		if (oneMore && nodes.length > limit) {
			// We fetched one more than requested
			if (isBackward) {
				hasPreviousPage = true;
			} else {
				hasNextPage = true;
			}
			// Remove the extra item
			nodes = nodes.slice(0, limit);
		}

		// Set previous page flag based on cursor
		if (after) {
			hasPreviousPage = true;
		}

		// Set next page flag based on cursor
		if (before) {
			hasNextPage = true;
		}

		// For backward pagination, reverse the results to get correct order
		if (isBackward) {
			nodes = nodes.reverse();
		}

		// Get edge cursors
		const startCursor = nodes.length > 0 ? String(nodes[0][sortField]) : null;
		const endCursor =
			nodes.length > 0 ? String(nodes[nodes.length - 1][sortField]) : null;

		// Return connection object
		return {
			nodes,
			pageInfo: {
				hasNextPage,
				hasPreviousPage,
				startCursor,
				endCursor,
			},
			totalCount,
		};
	},
};

// Export everything needed for tests
export {
	db,
	initializeDatabase,
	cleanupDatabase,
	resetDatabase,
	toSqliteDate,
	fromSqliteDate,
};

export type { Articles, Comments, DB, Products, Quizzes, Users };
