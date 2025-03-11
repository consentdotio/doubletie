import { AsyncLocalStorage } from 'node:async_hooks';
/**
 * Functional Database wrapper for Kysely
 */
import {
	CamelCasePlugin,
	type DeleteQueryBuilder,
	type DeleteResult,
	type Dialect,
	DynamicModule,
	type InsertQueryBuilder,
	type InsertResult,
	Kysely,
	type LogEvent,
	type MigrationProvider,
	Migrator,
	MysqlDialect,
	type NoResultError,
	PostgresDialect,
	type SelectQueryBuilder,
	SqliteDialect,
	type UpdateQueryBuilder,
	type UpdateResult,
	sql,
} from 'kysely';
import {
	type ModelSchema,
	type PrimaryKeySpecification,
	createModel,
} from './model';
import { CommonTableExpression } from './utils/kysley-types';

/**
 * Simple type for QueryCreatorWithCommonTableExpression to avoid complex typing issues
 */
type QueryCreatorWithCommonTableExpression<DB, N extends string, E> = any;

/**
 * Configuration options for the database
 *
 * @typeParam TDatabaseSchema - Database schema type
 */
export type DatabaseConfig<TDatabaseSchema> = {
	/** Whether the database is isolated */
	isolated?: boolean;
	/** Function to log database events */
	log?: (event: LogEvent) => void;
	/** Whether to enable debug mode */
	debug?: boolean;
	/** Database dialect to use */
	dialect: Dialect;
};

/**
 * Options for creating a database migrator
 */
export type MigratorOptions = {
	/** Migration provider that supplies the migrations */
	provider: MigrationProvider;
	/**
	 * Whether to allow migrations to be run in a different order than they were created
	 * New in Kysely 0.27.2+
	 */
	allowUnorderedMigrations?: boolean;
};

/**
 * Function to execute after a transaction commits
 *
 * @returns Promise that resolves when the callback is complete
 */
type AfterCommitCallback = () => Promise<unknown>;

/**
 * Transaction state information stored in AsyncLocalStorage
 *
 * @typeParam TDatabaseSchema - Database schema type
 */
type TransactionState<TDatabaseSchema> = {
	/** Transaction instance */
	transaction: Kysely<TDatabaseSchema>;
	/** Whether the transaction has been committed */
	committed: boolean;
	/** Callbacks to execute after the transaction commits */
	afterCommit: AfterCommitCallback[];
};

/**
 * Transaction response object passed to transaction callbacks
 *
 * @typeParam TDatabaseSchema - Database schema type
 */
export type TransactionResponse<TDatabaseSchema> = {
	/** Transaction instance */
	transaction: Kysely<TDatabaseSchema>;
	/**
	 * Register a callback to execute after the transaction commits
	 *
	 * @param callback - Function to execute after commit
	 */
	afterCommit: (callback: AfterCommitCallback) => void;
};

/**
 * Transaction callback function type
 *
 * @typeParam TDatabaseSchema - Database schema type
 * @typeParam ResultType - Result type of the transaction
 */
export type TransactionCallback<TDatabaseSchema, ResultType> = (
	trx: TransactionResponse<TDatabaseSchema>
) => Promise<ResultType>;

/**
 * Registry of models for a database
 *
 * @typeParam TDatabaseSchema - Database schema type
 */
export type ModelRegistry<TDatabaseSchema> = {
	[TTableName in keyof TDatabaseSchema & string]?: {
		schema: ModelSchema<TDatabaseSchema[TTableName]>;
		primaryKey: PrimaryKeySpecification<TDatabaseSchema[TTableName]>;
	};
};

/**
 * The database instance containing all state and functionality
 *
 * @typeParam TDatabaseSchema - Database schema type
 * @typeParam RegistryType - Model registry type
 */
export interface Database<
	TDatabaseSchema,
	RegistryType extends
		ModelRegistry<TDatabaseSchema> = ModelRegistry<TDatabaseSchema>,
> {
	/** The database dialect */
	dialect: Dialect;
	/** The Kysely instance */
	kysely: Kysely<TDatabaseSchema>;
	/** AsyncLocalStorage for transaction state */
	asyncLocalDb: AsyncLocalStorage<TransactionState<TDatabaseSchema>>;
	/** Whether the database is isolated */
	readonly isolated: boolean;
	/** Function to log database events */
	readonly log?: (event: LogEvent) => void;
	/** Whether to enable debug mode */
	readonly debug?: boolean;
	/** Model registry */
	_modelRegistry?: RegistryType;

	/**
	 * Checks if the database is using SQLite dialect
	 *
	 * @returns True if the database is using SQLite
	 */
	isSqlite: () => boolean;

	/**
	 * Checks if the database is using MySQL dialect
	 *
	 * @returns True if the database is using MySQL
	 */
	isMysql: () => boolean;

	/**
	 * Checks if the database is using PostgreSQL dialect
	 *
	 * @returns True if the database is using PostgreSQL
	 */
	isPostgres: () => boolean;

	/**
	 * Creates a model for the specified table
	 *
	 * @typeParam TTableName - Table name
	 * @typeParam TIdColumnName - ID column name
	 * @param table - Table name
	 * @param id - ID column name
	 * @param schema - Schema definition
	 * @param error - Error to throw when not found
	 * @returns Model instance
	 */
	model: <
		TTableName extends keyof TDatabaseSchema & string,
		TIdColumnName extends keyof TDatabaseSchema[TTableName] & string,
	>(
		table: TTableName,
		id: TIdColumnName,
		schema?: ModelSchema<TDatabaseSchema[TTableName]>,
		error?: typeof NoResultError
	) => ReturnType<
		typeof createModel<TDatabaseSchema, TTableName, TIdColumnName>
	>;

	/**
	 * Registers multiple models
	 *
	 * @param registry - Model registry
	 * @returns The database instance
	 */
	registerModels: (
		registry: RegistryType
	) => Database<TDatabaseSchema, RegistryType>;

	/**
	 * Gets a registered model by table name
	 *
	 * @typeParam TTableName - Table name
	 * @param table - Table name
	 * @returns The model for the table
	 */
	getModel: <TTableName extends keyof RegistryType & string>(
		table: TTableName
	) => ReturnType<Database<TDatabaseSchema, RegistryType>['model']>;

	/**
	 * Access to Kysely's SQL function builder
	 */
	fn: () => typeof Kysely.prototype.fn;

	/**
	 * Checks if currently in a transaction
	 */
	isTransaction: () => boolean;

	/**
	 * Gets the current database instance
	 */
	db: () => Kysely<TDatabaseSchema>;

	/**
	 * Creates a SELECT query for a table
	 *
	 * @typeParam TTableName - Table name
	 * @param table - Table name
	 * @returns SELECT query builder
	 */
	selectFrom: <TTableName extends keyof TDatabaseSchema & string>(
		table: TTableName
	) => SelectQueryBuilder<TDatabaseSchema, any, any>;

	/**
	 * Creates an INSERT query for a table
	 *
	 * @typeParam TTableName - Table name
	 * @param table - Table name
	 * @returns INSERT query builder
	 */
	insertInto: <TTableName extends keyof TDatabaseSchema & string>(
		table: TTableName
	) => InsertQueryBuilder<TDatabaseSchema, TTableName, InsertResult>;

	/**
	 * Creates an UPDATE query for a table
	 *
	 * @typeParam TTableName - Table name
	 * @param table - Table name
	 * @returns UPDATE query builder
	 */
	updateTable: <TTableName extends keyof TDatabaseSchema & string>(
		table: TTableName
	) => UpdateQueryBuilder<TDatabaseSchema, any, any, UpdateResult>;

	/**
	 * Creates a DELETE query for a table
	 *
	 * @typeParam TTableName - Table name
	 * @param table - Table name
	 * @returns DELETE query builder
	 */
	deleteFrom: <TTableName extends keyof TDatabaseSchema & string>(
		table: TTableName
	) => DeleteQueryBuilder<TDatabaseSchema, any, DeleteResult>;

	/**
	 * Creates a WITH clause for a query
	 *
	 * @typeParam TName - CTE name
	 * @typeParam TExpression - CTE expression type
	 * @param name - CTE name
	 * @param expression - CTE expression
	 * @returns Query builder with WITH clause
	 */
	with: <
		TName extends string,
		TExpression extends CommonTableExpression<TDatabaseSchema, TName>,
	>(
		name: TName,
		expression: TExpression
	) => any;

	/**
	 * Destroys the database connection
	 */
	destroy: () => ReturnType<Kysely<TDatabaseSchema>['destroy']>;

	/**
	 * Executes a function in a transaction
	 *
	 * @typeParam TResultType - Result type
	 * @param callback - Transaction callback
	 * @returns Result of the transaction
	 */
	transaction: <TResultType>(
		callback: TransactionCallback<TDatabaseSchema, TResultType>
	) => Promise<TResultType>;

	/**
	 * Executes a SELECT query without a FROM clause
	 * Useful for retrieving constants and system values
	 *
	 * @returns Query builder with selected constant values
	 */
	selectNoFrom: () => ReturnType<Kysely<TDatabaseSchema>['selectNoFrom']>;

	/**
	 * Creates a tuple for comparison in SQL queries
	 *
	 * @typeParam ItemTypes - Tuple item types
	 * @param items - Tuple items
	 * @returns Tuple expression builder function
	 *
	 * @throws {Error} When tuple has less than 1 or more than 5 items
	 *
	 * @example
	 * ```ts
	 * db.selectFrom('users')
	 *   .where(eb =>
	 *     eb.tuple('name', 'email').eq(db.tuple(['John', 'john@example.com'])(eb))
	 *   )
	 * ```
	 */
	tuple: <ItemTypes extends unknown[]>(
		items: readonly [...ItemTypes]
	) => (expressionBuilder: unknown) => unknown;

	/**
	 * Casts a value to a specific SQL type
	 *
	 * @typeParam ResultType - Type to cast to
	 * @param value - Value to cast
	 * @param dataType - SQL data type to cast to
	 * @returns Cast SQL expression
	 *
	 * @example
	 * ```ts
	 * // Cast a string to an integer
	 * const numericValue = db.cast<number>('123', 'INTEGER');
	 * ```
	 */
	cast: <ResultType>(
		value: unknown,
		dataType: string
	) => ReturnType<typeof sql<ResultType>>;

	/**
	 * Updates a single column in a table
	 *
	 * @typeParam TTableName - Table name in the database
	 * @typeParam ColumnName - Column name to update
	 * @param table - Table name
	 * @param column - Column name
	 * @param value - New value for the column
	 * @returns Update query builder
	 *
	 * @example
	 * ```ts
	 * await db.updateColumn('users', 'status', 'active')
	 *   .where('id', '=', userId)
	 *   .execute();
	 * ```
	 */
	updateColumn: <
		TTableName extends keyof TDatabaseSchema & string,
		ColumnName extends keyof TDatabaseSchema[TTableName] & string,
	>(
		table: TTableName,
		column: ColumnName,
		value: TDatabaseSchema[TTableName][ColumnName]
	) => UpdateQueryBuilder<TDatabaseSchema, any, any, UpdateResult>;

	/**
	 * Creates a query for streaming results from a table
	 * Currently only supported with SQLite dialect
	 *
	 * @typeParam TTableName - Table name in the database
	 * @typeParam ColumnName - Column names to select
	 * @param table - Table name
	 * @param columns - Array of columns to select
	 * @returns Select query builder configured for streaming
	 *
	 * @throws {Error} When used with non-SQLite dialect
	 *
	 * @example
	 * ```ts
	 * const stream = await db.streamFrom('users', ['id', 'name', 'email'])
	 *   .where('status', '=', 'active')
	 *   .stream();
	 * ```
	 */
	streamFrom: <
		TTableName extends keyof TDatabaseSchema & string,
		ColumnName extends keyof TDatabaseSchema[TTableName] & string,
	>(
		table: TTableName,
		columns: readonly ColumnName[]
	) => SelectQueryBuilder<TDatabaseSchema, any, any>;

	/**
	 * Finds records where a specified column is not null
	 *
	 * @typeParam TTableName - Table name in the database
	 * @typeParam ColumnName - Column name to check for non-null values
	 * @param table - Table name
	 * @param column - Column name
	 * @returns Query builder for records with non-null values in the column
	 *
	 * @example
	 * ```ts
	 * // Find all users with a non-null email address
	 * const users = await db.findNotNull('users', 'email').execute();
	 * ```
	 */
	findNotNull: <
		TTableName extends keyof TDatabaseSchema & string,
		ColumnName extends keyof TDatabaseSchema[TTableName] & string,
	>(
		table: TTableName,
		column: ColumnName
	) => SelectQueryBuilder<TDatabaseSchema, any, any>;

	/**
	 * Inserts a record with default values
	 *
	 * @typeParam TTableName - Table name
	 * @param table - Table name
	 * @returns Insert query
	 */
	insertDefault: <TTableName extends keyof TDatabaseSchema & string>(
		table: TTableName
	) => InsertQueryBuilder<TDatabaseSchema, TTableName, InsertResult>;

	/**
	 * Creates a database migrator
	 *
	 * @param options - Migrator options
	 * @returns Migrator instance
	 */
	createMigrator: (options: MigratorOptions) => Migrator;

	/**
	 * Access to Kysely's dynamic query builder
	 */
	dynamic: DynamicModule;
}

/**
 * Creates a new Database instance
 *
 * @param config - Database configuration
 * @returns A new database instance
 */
export function createDatabase<
	TDatabaseSchema,
	RegistryType extends
		ModelRegistry<TDatabaseSchema> = ModelRegistry<TDatabaseSchema>,
>(
	config: DatabaseConfig<TDatabaseSchema>
): Database<TDatabaseSchema, RegistryType> {
	const dialect = config.dialect;
	const isolated = config.isolated ?? false;
	const log = config.log;
	const debug = config.debug;

	const kysely = new Kysely<TDatabaseSchema>({
		dialect,
		log,
		plugins: [new CamelCasePlugin()],
	});

	const asyncLocalDb = new AsyncLocalStorage<
		TransactionState<TDatabaseSchema>
	>();

	const db: Database<TDatabaseSchema, RegistryType> = {
		dialect,
		kysely,
		asyncLocalDb,
		isolated,
		log,
		debug,

		isSqlite: () => {
			return dialect instanceof SqliteDialect;
		},

		isMysql: () => {
			return dialect instanceof MysqlDialect;
		},

		isPostgres: () => {
			return dialect instanceof PostgresDialect;
		},

		model: <
			TTableName extends keyof TDatabaseSchema & string,
			TIdColumnName extends keyof TDatabaseSchema[TTableName] & string,
		>(
			table: TTableName,
			id: TIdColumnName,
			schema?: ModelSchema<TDatabaseSchema[TTableName]>,
			error?: typeof NoResultError
		) => {
			return createModel<TDatabaseSchema, TTableName, TIdColumnName>(
				db as unknown as any, // Cast to avoid circular typing issues
				table,
				id,
				schema,
				error
			);
		},

		registerModels: (registry: RegistryType) => {
			db._modelRegistry = registry;
			return db;
		},

		getModel: <TTableName extends keyof RegistryType & string>(
			table: TTableName
		) => {
			const registry = db._modelRegistry;
			if (!registry || !registry[table]) {
				throw new Error(`Model for table "${String(table)}" is not registered`);
			}

			const modelDef = registry[table]!;
			const tableKey = table as unknown as keyof TDatabaseSchema & string;
			const idField = modelDef.primaryKey
				.field as unknown as keyof TDatabaseSchema[typeof tableKey] & string;
			const schema = modelDef.schema as unknown as ModelSchema<
				TDatabaseSchema[typeof tableKey]
			>;

			return db.model(tableKey, idField, schema);
		},

		fn: () => {
			return kysely.fn;
		},

		isTransaction: () => {
			return !!asyncLocalDb.getStore();
		},

		db: () => {
			const state = asyncLocalDb.getStore();
			if (!state) {
				return kysely;
			}

			return state.transaction;
		},

		selectFrom: <TTableName extends keyof TDatabaseSchema & string>(
			table: TTableName
		) => {
			return kysely.selectFrom(table);
		},

		insertInto: <TTableName extends keyof TDatabaseSchema & string>(
			table: TTableName
		) => {
			return kysely.insertInto(table);
		},

		updateTable: <TTableName extends keyof TDatabaseSchema & string>(
			table: TTableName
		) => {
			return kysely.updateTable(table);
		},

		deleteFrom: <TTableName extends keyof TDatabaseSchema & string>(
			table: TTableName
		) => {
			return kysely.deleteFrom(table);
		},

		with: <
			TName extends string,
			TExpression extends CommonTableExpression<TDatabaseSchema, TName>,
		>(
			name: TName,
			expression: TExpression
		) => {
			return kysely.with(name, expression);
		},

		destroy: () => {
			return kysely.destroy();
		},

		dynamic: kysely.dynamic,

		transaction: async <TResultType>(
			callback: TransactionCallback<TDatabaseSchema, TResultType>
		): Promise<TResultType> => {
			if (asyncLocalDb.getStore()) {
				// Already in a transaction, use the existing one
				return callback({
					transaction: db.db(),
					afterCommit: (callback: AfterCommitCallback) => {
						const state = asyncLocalDb.getStore();
						if (!state) {
							throw new Error('No transaction state found');
						}
						state.afterCommit.push(callback);
					},
				});
			}

			return kysely.transaction().execute(async (trx) => {
				const state: TransactionState<TDatabaseSchema> = {
					transaction: trx,
					committed: false,
					afterCommit: [],
				};

				return await asyncLocalDb.run(state, async () => {
					try {
						const result = await callback({
							transaction: trx,
							afterCommit: (callback: AfterCommitCallback) => {
								state.afterCommit.push(callback);
							},
						});

						state.committed = true;

						const afterCommitPromises = state.afterCommit.map((cb) => cb());
						await Promise.all(afterCommitPromises);

						return result;
					} catch (error) {
						state.committed = false;
						throw error;
					}
				});
			});
		},

		selectNoFrom: () => {
			return kysely.selectNoFrom([
				sql<number>`1`.as('one'),
				sql<string>`'test'`.as('constantText'),
				sql<string>`CURRENT_TIMESTAMP`.as('currentDate'),
				sql<number>`RANDOM()`.as('randomValue'),
			]);
		},

		tuple: <ItemTypes extends unknown[]>(items: readonly [...ItemTypes]) => {
			// Check if we have a supported number of items (Kysely supports up to 5)
			if (items.length < 1 || items.length > 5) {
				throw new Error(
					`Tuple must have between 1 and 5 items. Received ${items.length} items.`
				);
			}

			// Create a function that will use the expression builder when called
			// We use unknown here since we don't know the exact type of the expression builder
			return (expressionBuilder: unknown) => {
				const eb = expressionBuilder as {
					tuple: (...items: unknown[]) => unknown;
				};

				if (items.length === 1) {
					return eb.tuple(items[0]);
				} else if (items.length === 2) {
					return eb.tuple(items[0], items[1]);
				} else if (items.length === 3) {
					return eb.tuple(items[0], items[1], items[2]);
				} else if (items.length === 4) {
					return eb.tuple(items[0], items[1], items[2], items[3]);
				} else {
					return eb.tuple(items[0], items[1], items[2], items[3], items[4]);
				}
			};
		},

		cast: <ResultType>(value: unknown, dataType: string) => {
			// Use a sql tag to generate the CAST expression with explicit typing
			return sql<ResultType>`CAST(${value} AS ${sql.raw(dataType)})`;
		},

		updateColumn: <
			TTableName extends keyof TDatabaseSchema & string,
			ColumnName extends keyof TDatabaseSchema[TTableName] & string,
		>(
			table: TTableName,
			column: ColumnName,
			value: TDatabaseSchema[TTableName][ColumnName]
		) => {
			const queryBuilder = kysely.updateTable(table);
			// Workaround for Kysely type system - using 'as any' just for the set method
			// This will be fixed in Kysely 0.27.0
			return (queryBuilder as any).set(column, value);
		},

		streamFrom: <
			TTableName extends keyof TDatabaseSchema & string,
			ColumnName extends keyof TDatabaseSchema[TTableName] & string,
		>(
			table: TTableName,
			columns: readonly ColumnName[]
		) => {
			if (!db.isSqlite()) {
				throw new Error(
					'Streaming is currently only supported with SQLite dialect'
				);
			}

			// Using the appropriate type cast for the expression builder
			return kysely.selectFrom(table).select((eb) => {
				// Cast expression builder to a type that supports ref
				const expressionBuilder = eb as {
					ref: (path: string) => unknown;
				};

				// Map columns to reference expressions
				return columns.map((column) =>
					expressionBuilder.ref(`${table}.${String(column)}`)
				) as any;
			});
		},

		findNotNull: <
			TTableName extends keyof TDatabaseSchema & string,
			ColumnName extends keyof TDatabaseSchema[TTableName] & string,
		>(
			table: TTableName,
			column: ColumnName
		) => {
			return (
				kysely
					.selectFrom(table)
					.selectAll()
					// @ts-expect-error - Will fix when Kysely 0.27.0 upgrade is complete
					.where((eb) => eb(`${table}.${column}`, 'is not', null))
			);
		},

		insertDefault: <TTableName extends keyof TDatabaseSchema & string>(
			table: TTableName
		) => {
			return kysely.insertInto(table).defaultValues();
		},

		createMigrator: (options: MigratorOptions): Migrator => {
			return new Migrator({
				db: db.db(),
				provider: options.provider,
				// Support for Kysely 0.27.2+
				allowUnorderedMigrations: options.allowUnorderedMigrations,
			});
		},
	};

	return db;
}
