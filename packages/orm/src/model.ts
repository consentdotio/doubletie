/**
 * Functional model factory that creates database model operations
 *
 * @typeParam DatabaseSchema - Database schema type
 * @typeParam TableName - Table name in the database
 * @typeParam IdColumnName - Name of the ID column
 *
 * @param db - Database instance
 * @param table - Table name
 * @param id - Primary key column name
 * @param noResultError - Error to throw when no result is found
 * @returns Object with model operations
 */

import {
	type DeleteQueryBuilder,
	type DeleteResult,
	type InsertQueryBuilder,
	NoResultError,
	type OnConflictDatabase,
	type OnConflictTables,
	type SelectQueryBuilder,
	type SelectType,
	type Selectable,
	type UpdateQueryBuilder,
	type UpdateResult,
} from 'kysely';

import { sql } from 'kysely';
import type { InsertObject, UpdateObject } from 'kysely';
import type { Database, TransactionCallback } from './database';
import type {
	FieldDefinition,
	RelationDefinition,
} from './utils/model-builder';

/**
 * Expression value literal that can be used in SQL queries
 * Represents primitive values that can be directly used in SQL statements
 */
export type SqlLiteral = string | number | boolean | Date | null | Buffer;

/**
 * SQL expression type
 * Represents a complex SQL expression that will be processed by Kysely
 */
export type SqlExpression = unknown;

/**
 * Core model functions that provide CRUD operations and utilities for database tables
 *
 * @typeParam DatabaseSchema - Database schema type
 * @typeParam TableName - Table name in the database
 * @typeParam IdColumnName - Name of the ID column
 */
export type ModelFunctions<
	DatabaseSchema,
	TableName extends keyof DatabaseSchema & string,
	IdColumnName extends keyof DatabaseSchema[TableName] & string,
> = {
	// Database and table references
	readonly db: Database<DatabaseSchema>;
	readonly table: TableName;
	readonly id: IdColumnName;
	readonly noResultError: typeof NoResultError;
	isolated: boolean;

	// Database operations
	selectFrom: () => SelectQueryBuilder<
		DatabaseSchema,
		TableName,
		Record<string, never>
	>;
	updateTable: () => UpdateQueryBuilder<
		DatabaseSchema,
		TableName,
		TableName,
		UpdateResult
	>;
	insertInto: () => InsertQueryBuilder<
		DatabaseSchema,
		TableName,
		DatabaseSchema[TableName]
	>;
	deleteFrom: () => DeleteQueryBuilder<DatabaseSchema, TableName, DeleteResult>;
	transaction: <ResultType>(
		callback: TransactionCallback<DatabaseSchema, ResultType>
	) => Promise<ResultType>;

	// Utility methods
	/**
	 * Creates a reference to a column or expression
	 * @param reference - Column or expression reference string
	 * @returns SQL reference expression
	 */
	ref: (reference: string) => SqlExpression;

	/**
	 * Creates a literal SQL value
	 * @param value - Value to convert to a SQL literal
	 * @returns SQL literal expression
	 */
	lit: (value: SqlLiteral) => SqlExpression;

	/**
	 * Casts a value to a specific SQL type
	 * @param value - Value to cast
	 * @param dataType - SQL data type to cast to
	 * @returns Casted SQL expression
	 */
	cast: <ValueType>(
		value: SqlLiteral | SqlExpression,
		dataType: string
	) => SqlExpression;

	/**
	 * Dynamic SQL builder for complex expressions
	 */
	dynamic: any;

	/**
	 * SQL function builder
	 */
	fn: any;

	// Additional helper methods
	/**
	 * Find records that match all provided conditions
	 * @param conditions - Object with column-value pairs to match
	 * @returns Promise resolving to matching records
	 */
	findByAndConditions: (
		conditions: Record<string, SqlLiteral>
	) => Promise<Selectable<DatabaseSchema[TableName]>[]>;

	// Data processing hooks
	processDataBeforeUpdate: (
		data:
			| UpdateObjectExpression<DatabaseSchema, TableName>
			| UpdateObjectExpression<
					OnConflictDatabase<DatabaseSchema, TableName>,
					OnConflictTables<TableName>
			  >
	) =>
		| UpdateObjectExpression<DatabaseSchema, TableName>
		| UpdateObjectExpression<
				OnConflictDatabase<DatabaseSchema, TableName>,
				OnConflictTables<TableName>
		  >;

	processDataBeforeInsert: (
		data: InsertObjectOrList<DatabaseSchema, TableName>
	) => InsertObjectOrList<DatabaseSchema, TableName>;

	afterSingleInsert: (
		singleResult: Selectable<DatabaseSchema[TableName]>
	) => Promise<Selectable<DatabaseSchema[TableName]>>;
	afterSingleUpdate: (
		singleResult: Selectable<DatabaseSchema[TableName]>
	) => Promise<Selectable<DatabaseSchema[TableName]>>;
	afterSingleUpsert: (
		singleResult: Selectable<DatabaseSchema[TableName]>
	) => Promise<Selectable<DatabaseSchema[TableName]>>;

	// Find operations
	find: <TColumnName extends keyof DatabaseSchema[TableName] & string>(
		column: TColumnName,
		values:
			| Readonly<SelectType<DatabaseSchema[TableName][TColumnName]>[]>
			| Readonly<SelectType<DatabaseSchema[TableName][TColumnName]>>,
		func?: (
			qb: SelectQueryBuilder<DatabaseSchema, TableName, Record<string, never>>
		) => SelectQueryBuilder<DatabaseSchema, TableName, Record<string, never>>
	) => Promise<Selectable<DatabaseSchema[TableName]>[]>;

	findOne: <TColumnName extends keyof DatabaseSchema[TableName] & string>(
		column: TColumnName,
		value: Readonly<SelectType<DatabaseSchema[TableName][TColumnName]>>,
		func?: (
			qb: SelectQueryBuilder<DatabaseSchema, TableName, Record<string, never>>
		) => SelectQueryBuilder<DatabaseSchema, TableName, Record<string, never>>
	) => Promise<Selectable<DatabaseSchema[TableName]> | undefined>;

	findById: (
		idValue: Readonly<SelectType<DatabaseSchema[TableName][IdColumnName]>>,
		func?: (
			qb: SelectQueryBuilder<DatabaseSchema, TableName, Record<string, never>>
		) => SelectQueryBuilder<DatabaseSchema, TableName, Record<string, never>>,
		options?: { throwIfNotFound?: boolean; error?: typeof NoResultError }
	) => Promise<Selectable<DatabaseSchema[TableName]> | undefined>;

	findByIds: (
		ids: Readonly<SelectType<DatabaseSchema[TableName][IdColumnName]>[]>,
		func?: (
			qb: SelectQueryBuilder<DatabaseSchema, TableName, Record<string, never>>
		) => SelectQueryBuilder<DatabaseSchema, TableName, Record<string, never>>
	) => Promise<Selectable<DatabaseSchema[TableName]>[]>;

	getById: (
		idValue: Readonly<SelectType<DatabaseSchema[TableName][IdColumnName]>>,
		func?: (
			qb: SelectQueryBuilder<DatabaseSchema, TableName, Record<string, never>>
		) => SelectQueryBuilder<DatabaseSchema, TableName, Record<string, never>>,
		error?: typeof NoResultError
	) => Promise<Selectable<DatabaseSchema[TableName]> | undefined>;

	// Additional operations to be added

	/**
	 * Find records where columns match the specified values using tuple comparison
	 *
	 * @typeParam TColumnName - Name of the column(s) to match
	 * @param columns - Array of column names to match
	 * @param values - Array of values corresponding to columns
	 * @returns Promise resolving to array of matching records
	 *
	 * @throws {Error} When columns and values arrays have different lengths
	 * @throws {Error} When trying to use more than 5 columns (Kysely limitation)
	 *
	 * @example
	 * ```ts
	 * // Find users by name and email
	 * const users = await userModel.findByTuple(
	 *   ['name', 'email'],
	 *   ['John Doe', 'john@example.com']
	 * );
	 * ```
	 */
	findByTuple: <TColumnName extends keyof DatabaseSchema[TableName] & string>(
		columns: readonly TColumnName[],
		values: readonly SqlLiteral[]
	) => Promise<Selectable<DatabaseSchema[TableName]>[]>;

	findByNotNull: <TColumnName extends keyof DatabaseSchema[TableName] & string>(
		column: TColumnName
	) => Promise<Selectable<DatabaseSchema[TableName]>[]>;

	// New direct column update methods (Kysely 0.27.0)
	updateById?: <TColumnName extends keyof DatabaseSchema[TableName] & string>(
		id: Readonly<SelectType<DatabaseSchema[TableName][IdColumnName]>>,
		column: TColumnName,
		value: DatabaseSchema[TableName][TColumnName]
	) => Promise<Selectable<DatabaseSchema[TableName]>>;

	/**
	 * Gets a record by ID with row locking for update
	 * Supported in Kysely 0.27.1+ with PostgreSQL
	 *
	 * @param idValue - ID of the record to get
	 * @param error - Error constructor to use
	 * @returns The found record
	 *
	 * @example
	 * ```ts
	 * // Get a user by ID with row locking
	 * const user = await userModel.getByIdForUpdate(123);
	 * // ...update the user
	 * ```
	 */
	getByIdForUpdate: (
		idValue: Readonly<SelectType<DatabaseSchema[TableName][IdColumnName]>>,
		error?: typeof NoResultError
	) => Promise<Selectable<DatabaseSchema[TableName]> | undefined>;

	/**
	 * Creates a query with a calculated limit based on an expression
	 * Supported in Kysely 0.27.1+
	 *
	 * @param expr - SQL expression for the limit
	 * @returns Query builder with the limit expression
	 *
	 * @example
	 * ```ts
	 * // Get records with a calculated limit (e.g., 10% of total)
	 * const results = await userModel.withExpressionLimit(
	 *   sql`(SELECT COUNT(*) / 10 FROM users)`
	 * ).execute();
	 * ```
	 */
	withExpressionLimit: (
		expr: any
	) => SelectQueryBuilder<DatabaseSchema, TableName, Record<string, never>>;
};

/**
 * Model extensions type for adding custom methods to models
 *
 * @typeParam TEntityType - Entity type
 */
export type ModelExtensions<TEntityType = unknown> = {
	[key: string]: ((...args: unknown[]) => unknown) | unknown;
};

/**
 * Schema definition for a model
 *
 * @typeParam TEntityType - Entity type
 */
export type ModelSchema<TEntityType = unknown> = {
	fields: { [K in keyof TEntityType]: FieldDefinition };
	relations?: Record<string, RelationDefinition<TEntityType, unknown>>;
	indexes?: Array<{
		name?: string;
		columns: Array<keyof TEntityType & string>;
		unique?: boolean;
	}>;
	extensions?: ModelExtensions<TEntityType>;
};

/**
 * Extract the fields type from a model schema
 *
 * @typeParam T - Schema type
 */
export type ModelFields<T> = T extends ModelSchema<infer F> ? F : never;

/**
 * Primary key specification for a model
 *
 * @typeParam T - Entity type
 */
export type PrimaryKeySpecification<T> = {
	field: keyof T & string;
	autoIncrement?: boolean;
	type?: 'uuid' | 'nanoid' | 'autoincrement' | 'custom';
};

// Type alias for insert objects or arrays of insert objects
type InsertObjectOrList<TDatabase, TTableName extends keyof TDatabase> =
	| InsertObject<TDatabase, TTableName>
	| Array<InsertObject<TDatabase, TTableName>>;

// Type alias for update object expressions
type UpdateObjectExpression<
	TDatabase,
	TTableName extends keyof TDatabase,
> = UpdateObject<TDatabase, TTableName>;

/**
 * Creates a model with database operations
 *
 * @typeParam TDatabase - Database schema type
 * @typeParam TTableName - Table name in the database
 * @typeParam TIdColumnName - ID column name
 * @typeParam TSchema - Model schema type
 *
 * @param db - Database instance
 * @param table - Table name
 * @param id - Primary key column name
 * @param schema - Model schema
 * @param noResultError - Error to throw when no result is found
 * @returns Model with database operations
 */
export default function createModel<
	TDatabase,
	TTableName extends keyof TDatabase & string,
	TIdColumnName extends keyof TDatabase[TTableName] & string,
	TSchema extends ModelSchema<TDatabase[TTableName]> = ModelSchema<
		TDatabase[TTableName]
	>,
>(
	db: Database<TDatabase>,
	table: TTableName,
	id: TIdColumnName,
	schema?: TSchema,
	noResultError: typeof NoResultError = NoResultError
): ModelFunctions<TDatabase, TTableName, TIdColumnName> &
	ModelExtensions<TDatabase[TTableName]> {
	// Local type aliases for convenience
	type TTable = TDatabase[TTableName];
	type TIdColumn = TTable[TIdColumnName];
	type TData = Selectable<TTable>;
	type TId = Readonly<SelectType<TIdColumn>>;

	// Data processing hooks
	const processDataBeforeUpdate = (
		data:
			| UpdateObjectExpression<TDatabase, TTableName>
			| UpdateObjectExpression<
					OnConflictDatabase<TDatabase, TTableName>,
					OnConflictTables<TTableName>
			  >
	) => {
		return data;
	};

	const processDataBeforeInsert = (
		data: InsertObjectOrList<TDatabase, TTableName>
	) => {
		return data;
	};

	const afterSingleInsert = async (singleResult: Selectable<TTable>) => {
		return singleResult;
	};

	const afterSingleUpdate = async (singleResult: Selectable<TTable>) => {
		return singleResult;
	};

	const afterSingleUpsert = async (singleResult: Selectable<TTable>) => {
		return singleResult;
	};

	// Query builder methods
	const selectFrom = () => {
		return db.selectFrom(table);
	};

	const updateTable = () => {
		return db.updateTable(table);
	};

	const insertInto = () => {
		return db.insertInto(table);
	};

	const deleteFrom = () => {
		return db.deleteFrom(table);
	};

	// Find operations
	const find = async <TColumnName extends keyof TTable & string>(
		column: TColumnName,
		values:
			| Readonly<SelectType<TTable[TColumnName]>[]>
			| Readonly<SelectType<TTable[TColumnName]>>,
		func?: (
			qb: SelectQueryBuilder<TDatabase, TTableName, Record<string, never>>
		) => SelectQueryBuilder<TDatabase, TTableName, Record<string, never>>
	) => {
		const isArray = Array.isArray(values);

		return selectFrom()
			.selectAll()
			.where(db.dynamic.ref(`${table}.${column}`), isArray ? 'in' : '=', values)
			.$if(
				!!func,
				(qb) =>
					func?.(
						qb as unknown as SelectQueryBuilder<
							TDatabase,
							TTableName,
							Record<string, never>
						>
					) as unknown as typeof qb
			)
			.execute();
	};

	const findOne = async <TColumnName extends keyof TTable & string>(
		column: TColumnName,
		value: Readonly<SelectType<TTable[TColumnName]>>,
		func?: (
			qb: SelectQueryBuilder<TDatabase, TTableName, Record<string, never>>
		) => SelectQueryBuilder<TDatabase, TTableName, Record<string, never>>
	) => {
		return selectFrom()
			.selectAll()
			.where(db.dynamic.ref(`${table}.${column}`), '=', value)
			.$if(
				!!func,
				(qb) =>
					func?.(
						qb as unknown as SelectQueryBuilder<
							TDatabase,
							TTableName,
							Record<string, never>
						>
					) as unknown as typeof qb
			)
			.executeTakeFirst();
	};

	const findById = (
		idValue: Readonly<SelectType<TDatabase[TTableName][TIdColumnName]>>,
		func?: (
			qb: SelectQueryBuilder<TDatabase, TTableName, Record<string, never>>
		) => SelectQueryBuilder<TDatabase, TTableName, Record<string, never>>,
		options?: { throwIfNotFound?: boolean; error?: typeof NoResultError }
	) => {
		const { throwIfNotFound = false, error = noResultError } = options || {};

		if (!throwIfNotFound) {
			// Cast the ID column to a compatible type for findOne
			return findOne(
				id as unknown as keyof TTable & string,
				idValue as unknown as Readonly<
					SelectType<TTable[keyof TTable & string]>
				>,
				func
			);
		}

		return selectFrom()
			.selectAll()
			.where(db.dynamic.ref(`${table}.${id}`), '=', idValue)
			.$if(
				!!func,
				(qb) =>
					func?.(
						qb as unknown as SelectQueryBuilder<
							TDatabase,
							TTableName,
							Record<string, never>
						>
					) as unknown as typeof qb
			)
			.executeTakeFirstOrThrow(error);
	};

	const findByIds = (
		ids: Readonly<SelectType<TDatabase[TTableName][TIdColumnName]>[]>,
		func?: (
			qb: SelectQueryBuilder<TDatabase, TTableName, Record<string, never>>
		) => SelectQueryBuilder<TDatabase, TTableName, Record<string, never>>
	) => {
		return find(id, ids, func);
	};

	const getById = (
		idValue: Readonly<SelectType<TDatabase[TTableName][TIdColumnName]>>,
		func?: (
			qb: SelectQueryBuilder<TDatabase, TTableName, Record<string, never>>
		) => SelectQueryBuilder<TDatabase, TTableName, Record<string, never>>,
		error?: typeof NoResultError
	) => {
		return findById(idValue, func, {
			throwIfNotFound: true,
			error: error || noResultError,
		});
	};

	const lit = (value: SqlLiteral): SqlExpression => {
		// Using any for db.dynamic since the exact type is not available
		return (db.dynamic as any).lit(value);
	};

	const cast = <TResultType>(
		value: SqlLiteral | SqlExpression,
		dataType: string
	) => {
		return db.cast<TResultType>(value, dataType);
	};

	const findByAndConditions = async (
		conditions: Record<string, SqlLiteral>
	) => {
		const query = selectFrom()
			.selectAll()
			.where((eb) => eb.and(conditions as any));

		return query.execute() as unknown as Promise<Selectable<TTable>[]>;
	};

	const findByTuple = async <TColumnName extends keyof TTable & string>(
		columns: readonly TColumnName[],
		values: readonly SqlLiteral[]
	) => {
		if (columns.length !== values.length) {
			throw new Error('Columns and values arrays must have the same length');
		}

		let query = selectFrom().selectAll();

		if (columns.length === 1) {
			// Simple case - no need for tuples
			query = query.where(String(columns[0]) as any, '=', values[0]);
			return query.execute() as unknown as Promise<Selectable<TTable>[]>;
		}

		if (columns.length === 2) {
			// Use direct conditions for better performance
			query = query.where((eb: any) =>
				eb.and([
					eb(String(columns[0]) as any, '=', values[0]),
					eb(String(columns[1]) as any, '=', values[1]),
				])
			);
			return query.execute() as unknown as Promise<Selectable<TTable>[]>;
		}

		if (columns.length >= 3 && columns.length <= 5) {
			// For 3-5 columns, use the tuple support in Kysely
			query = query.where((eb: any) => {
				// Create an array of column references
				const columnRefs = [...columns].map((col) =>
					eb.ref(String(col) as any)
				);

				// Use the tuple method to create tuples for both columns and values
				// In 0.27.0, expression builders have more consistent typings
				return eb(db.tuple(columnRefs), '=', db.tuple([...values]));
			});
			return query.execute() as unknown as Promise<Selectable<TTable>[]>;
		}

		throw new Error(
			`Tuple with ${columns.length} columns is not supported. Kysely supports up to 5 items in a tuple.`
		);
	};

	const findByNotNull = async <TColumnName extends keyof TTable & string>(
		column: TColumnName
	) => {
		const qb = selectFrom();
		return (
			qb
				.selectAll()
				// @ts-expect-error - Will fix when Kysely 0.27.0 upgrade is complete
				.where((eb) => eb(`${table}.${column}`, 'is not', null))
				.execute()
		);
	};

	const getByIdForUpdate = async (
		idValue: Readonly<SelectType<TDatabase[TTableName][TIdColumnName]>>,
		error?: typeof NoResultError
	) => {
		// Use type-safe column reference with sql template
		const result = await selectFrom()
			.where(sql`${table}.${id}`, '=', idValue)
			.selectAll()
			.forUpdate()
			// Using straight SQL for now to avoid TS errors
			// Proper implementation will use .of(table) once Kysely 0.27.1 is implemented
			.executeTakeFirst();

		if (!result) {
			// Create the error message safely
			const errorMessage = `No ${table} found with id ${idValue}`;
			throw new (error || noResultError)(errorMessage as any);
		}

		return result as TData;
	};

	const withExpressionLimit = (expr: any) => {
		// Create a query with expression-based limit
		// Cast the return value to make the types compatible
		return selectFrom().limit(expr) as SelectQueryBuilder<
			TDatabase,
			TTableName,
			Record<string, never>
		>;
	};

	// Create and return the model object
	const model: ModelFunctions<TDatabase, TTableName, TIdColumnName> = {
		// Database and table references
		db,
		table,
		id,
		noResultError,
		isolated: false,

		// Database operations
		selectFrom: selectFrom as unknown as () => SelectQueryBuilder<
			TDatabase,
			TTableName,
			Record<string, never>
		>,
		updateTable: updateTable as unknown as () => UpdateQueryBuilder<
			TDatabase,
			TTableName,
			TTableName,
			UpdateResult
		>,
		insertInto: insertInto as unknown as () => InsertQueryBuilder<
			TDatabase,
			TTableName,
			TDatabase[TTableName]
		>,
		deleteFrom: deleteFrom as unknown as () => DeleteQueryBuilder<
			TDatabase,
			TTableName,
			DeleteResult
		>,
		transaction: db.transaction.bind(db),

		// Utility methods
		ref: (reference: string): SqlExpression => {
			// Using any for db.dynamic since the exact type is not available
			return (db.dynamic as any).ref(reference);
		},
		lit,
		cast,
		get dynamic() {
			return db.dynamic;
		},
		get fn() {
			return db.fn;
		},

		// Data processing hooks
		processDataBeforeUpdate,
		processDataBeforeInsert,
		afterSingleInsert,
		afterSingleUpdate,
		afterSingleUpsert,

		// Find operations
		find: find as unknown as ModelFunctions<
			TDatabase,
			TTableName,
			TIdColumnName
		>['find'],
		findOne: findOne as unknown as ModelFunctions<
			TDatabase,
			TTableName,
			TIdColumnName
		>['findOne'],
		findById: findById as unknown as ModelFunctions<
			TDatabase,
			TTableName,
			TIdColumnName
		>['findById'],
		findByIds: findByIds as unknown as ModelFunctions<
			TDatabase,
			TTableName,
			TIdColumnName
		>['findByIds'],
		getById: getById as unknown as ModelFunctions<
			TDatabase,
			TTableName,
			TIdColumnName
		>['getById'],

		// Additional helper methods
		findByAndConditions: findByAndConditions as unknown as (
			conditions: Record<string, SqlLiteral>
		) => Promise<Selectable<TTable>[]>,
		findByTuple: findByTuple as unknown as ModelFunctions<
			TDatabase,
			TTableName,
			TIdColumnName
		>['findByTuple'],
		// @ts-expect-error - Will fix when Kysely 0.27.0 upgrade is complete
		findByNotNull,

		// New direct column update methods (Kysely 0.27.0)
		//@ts-expect-error
		updateById: async <
			TColumnName extends keyof TDatabase[TTableName] & string,
		>(
			id: Readonly<SelectType<TDatabase[TTableName][TIdColumnName]>>,
			column: TColumnName,
			value: TDatabase[TTableName][TColumnName]
		) => {
			// Use the new single-column set method introduced in Kysely 0.27.0
			const result = await updateTable()
				.where(sql`${table}.${id}`, '=', id)
				//@ts-expect-error
				.set({ [column]: value })
				//@ts-expect-error
				.returning(['*'])
				.executeTakeFirst();

			if (result) {
				return result;
			}
			throw new Error(`Failed to update ${column} for ${table} with id ${id}`);
		},

		// Row locking methods (Kysely 0.27.1+)
		getByIdForUpdate,

		// New expression limit method (Kysely 0.27.1+)
		withExpressionLimit,
	};

	return model;
}
