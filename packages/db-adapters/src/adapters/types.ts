/**
 * Database Adapter Types
 *
 * This module defines the common interfaces for all database adapters.
 */

/**
 * Type representing the possible value types that can be used in query conditions
 */
export type Value =
	| string
	| number
	| boolean
	| string[]
	| number[]
	| Date
	| null;

/**
 * Type representing the comparison operators available for query conditions
 */
export type ComparisonOperator =
	| 'eq' // Equal to
	| 'ne' // Not equal to
	| 'lt' // Less than
	| 'lte' // Less than or equal to
	| 'gt' // Greater than
	| 'gte' // Greater than or equal to
	| 'in' // In array
	| 'contains' // Contains substring
	| 'starts_with' // Starts with
	| 'ends_with' // Ends with
	| 'ilike'; // Case insensitive equality

/**
 * Type representing the logical connectors available for combining query conditions
 */
export type LogicalConnector = 'AND' | 'OR';

/**
 * Type representing a single where condition in a query
 */
export type WhereCondition<EntityType extends string> = {
	/** The comparison operator to use (defaults to 'eq') */
	operator?: ComparisonOperator;
	/** The value to compare against */
	value: Value;
	/** The field to apply the condition to */
	field: string;
	/** The logical connector to use with previous conditions (defaults to 'AND') */
	connector?: LogicalConnector;
};

/**
 * Type representing a collection of where conditions
 */
export type Where<EntityType extends string> = WhereCondition<EntityType>[];

/**
 * Type representing sort options for a query
 */
export type SortOptions<EntityType extends string> = {
	/** The field to sort by */
	field: string;
	/** The sort direction */
	direction: 'asc' | 'desc';
};

/**
 * Type representing schema creation options for an adapter
 */
export type AdapterSchemaCreation = {
	/** The code to be inserted into the file */
	code: string;
	/** The path to the file */
	path: string;
	/** Whether to append to existing file */
	append?: boolean;
	/** Whether to overwrite existing file */
	overwrite?: boolean;
};

/**
 * Type representing database adapter configuration options
 */
export type AdapterOptions = Record<string, unknown>;

/**
 * Interface defining the common methods that all database adapters must implement
 */
export interface Adapter {
	/** Unique identifier for the adapter */
	id: string;

	/** Creates a new record in the database */
	create: <
		Model extends string,
		Data extends Record<string, unknown>,
		Result extends Record<string, unknown>,
	>(data: {
		model: Model;
		data: Data;
		select?: Array<keyof Result>;
	}) => Promise<Result>;

	/** Finds a single record matching the where conditions */
	findOne: <
		Model extends string,
		Result extends Record<string, unknown>,
	>(data: {
		model: Model;
		where: Where<Model>;
		select?: Array<keyof Result>;
		sortBy?: SortOptions<Model>;
	}) => Promise<Result | null>;

	/** Finds multiple records matching the where conditions */
	findMany: <
		Model extends string,
		Result extends Record<string, unknown>,
	>(data: {
		model: Model;
		where?: Where<Model>;
		limit?: number;
		sortBy?: SortOptions<Model>;
		offset?: number;
		select?: Array<keyof Result>;
	}) => Promise<Result[]>;

	/** Counts records matching the where conditions */
	count: <Model extends string>(data: {
		model: Model;
		where?: Where<Model>;
	}) => Promise<number>;

	/** Updates a single record matching the where conditions */
	update: <
		Model extends string,
		Data extends Record<string, unknown>,
		Result extends Record<string, unknown>,
	>(data: {
		model: Model;
		where: Where<Model>;
		update: Data;
		select?: Array<keyof Result>;
	}) => Promise<Result | null>;

	/** Updates multiple records matching the where conditions */
	updateMany: <
		Model extends string,
		Data extends Record<string, unknown>,
		Result extends Record<string, unknown>,
	>(data: {
		model: Model;
		where: Where<Model>;
		update: Data;
		select?: Array<keyof Result>;
	}) => Promise<Result[]>;

	/** Deletes a single record matching the where conditions */
	delete: <Model extends string>(data: {
		model: Model;
		where: Where<Model>;
	}) => Promise<void>;

	/** Deletes multiple records matching the where conditions */
	deleteMany: <Model extends string>(data: {
		model: Model;
		where: Where<Model>;
	}) => Promise<number>;

	/**
	 * Executes a function within a database transaction
	 *
	 * This method allows multiple database operations to be executed in a single atomic transaction.
	 * If any operation within the transaction fails, all operations are rolled back.
	 */
	transaction: <ResultType>(data: {
		callback: (transactionAdapter: Adapter) => Promise<ResultType>;
	}) => Promise<ResultType>;

	/** Optional method to create database schema */
	createSchema?: (
		options: Record<string, unknown>,
		file?: string
	) => Promise<AdapterSchemaCreation>;
}

/**
 * Type representing a factory function that creates an adapter instance
 */
export type AdapterFactory = (
	options: Record<string, unknown>
) => Adapter | Promise<Adapter>;
