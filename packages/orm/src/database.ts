import { AsyncLocalStorage } from 'node:async_hooks';
/**
 * Functional Database wrapper for Kysely
 */
import {
	CamelCasePlugin,
	type Dialect,
	Kysely,
	type LogEvent,
	type MigrationProvider,
	Migrator,
	MysqlDialect,
	type NoResultError,
	PostgresDialect,
	SqliteDialect,
	sql,
} from 'kysely';
import {
	type ModelSchema,
	type PrimaryKeySpecification,
	createModel,
} from './model.js';
import { CommonTableExpression } from './utils/kysley-types.js';

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
 * Database class that wraps Kysely functionality
 *
 * @typeParam TDatabaseSchema - Database schema type
 * @typeParam RegistryType - Model registry type
 */
export class Database<
	TDatabaseSchema,
	RegistryType extends
		ModelRegistry<TDatabaseSchema> = ModelRegistry<TDatabaseSchema>,
> {
	private dialect: Dialect;
	private kysely: Kysely<TDatabaseSchema>;
	private asyncLocalDb = new AsyncLocalStorage<
		TransactionState<TDatabaseSchema>
	>();
	readonly isolated: boolean;
	readonly log?: (event: LogEvent) => void;
	readonly debug?: boolean;

	/**
	 * Creates a new Database instance
	 *
	 * @param config - Database configuration
	 */
	constructor(config: DatabaseConfig<TDatabaseSchema>) {
		this.dialect = config.dialect;
		this.isolated = config.isolated ?? false;
		this.log = config.log;
		this.debug = config.debug;

		this.kysely = new Kysely<TDatabaseSchema>({
			dialect: this.dialect,
			log: this.log,
			plugins: [new CamelCasePlugin()],
		});
	}

	/**
	 * Checks if the database is using SQLite dialect
	 *
	 * @returns True if the database is using SQLite
	 */
	get isSqlite(): boolean {
		return this.dialect instanceof SqliteDialect;
	}

	/**
	 * Checks if the database is using MySQL dialect
	 *
	 * @returns True if the database is using MySQL
	 */
	get isMysql(): boolean {
		return this.dialect instanceof MysqlDialect;
	}

	/**
	 * Checks if the database is using PostgreSQL dialect
	 *
	 * @returns True if the database is using PostgreSQL
	 */
	get isPostgres(): boolean {
		return this.dialect instanceof PostgresDialect;
	}

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
	model<
		TTableName extends keyof TDatabaseSchema & string,
		TIdColumnName extends keyof TDatabaseSchema[TTableName] & string,
	>(
		table: TTableName,
		id: TIdColumnName,
		schema?: ModelSchema<TDatabaseSchema[TTableName]>,
		error?: typeof NoResultError
	) {
		return createModel<TDatabaseSchema, TTableName, TIdColumnName>(
			this as Database<TDatabaseSchema>,
			table,
			id,
			schema,
			error
		);
	}

	/**
	 * Registers multiple models
	 *
	 * @param registry - Model registry
	 * @returns This database instance
	 */
	registerModels(registry: RegistryType): this {
		// Store the registry for future reference
		Object.defineProperty(this, '_modelRegistry', {
			value: registry,
			writable: false,
			enumerable: false,
		});
		return this;
	}

	/**
	 * Gets a registered model by table name
	 *
	 * @typeParam TTableName - Table name
	 * @param table - Table name
	 * @returns The model for the table
	 */
	getModel<TTableName extends keyof RegistryType & string>(table: TTableName) {
		const registry = (this as any)._modelRegistry as RegistryType;
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

		return this.model(tableKey, idField, schema);
	}

	/**
	 * Access to Kysely's dynamic query builder
	 */
	get dynamic() {
		return this.kysely.dynamic;
	}

	/**
	 * Access to Kysely's SQL function builder
	 */
	get fn() {
		return this.kysely.fn;
	}

	/**
	 * Checks if currently in a transaction
	 */
	get isTransaction() {
		return !!this.asyncLocalDb.getStore();
	}

	/**
	 * Gets the current database instance
	 */
	get db() {
		const state = this.asyncLocalDb.getStore();
		if (!state) {
			return this.kysely;
		}

		return state.transaction;
	}

	/**
	 * Creates a SELECT query for a table
	 *
	 * @typeParam TTableName - Table name
	 * @param table - Table name
	 * @returns SELECT query builder
	 */
	selectFrom<TTableName extends keyof TDatabaseSchema & string>(
		table: TTableName
	) {
		return this.kysely.selectFrom(table);
	}

	/**
	 * Creates an INSERT query for a table
	 *
	 * @typeParam TTableName - Table name
	 * @param table - Table name
	 * @returns INSERT query builder
	 */
	insertInto<TTableName extends keyof TDatabaseSchema & string>(
		table: TTableName
	) {
		return this.kysely.insertInto(table);
	}

	/**
	 * Creates an UPDATE query for a table
	 *
	 * @typeParam TTableName - Table name
	 * @param table - Table name
	 * @returns UPDATE query builder
	 */
	updateTable<TTableName extends keyof TDatabaseSchema & string>(
		table: TTableName
	) {
		return this.kysely.updateTable(table);
	}

	/**
	 * Creates a DELETE query for a table
	 *
	 * @typeParam TTableName - Table name
	 * @param table - Table name
	 * @returns DELETE query builder
	 */
	deleteFrom<TTableName extends keyof TDatabaseSchema & string>(
		table: TTableName
	) {
		return this.kysely.deleteFrom(table);
	}

	/**
	 * Creates a WITH clause for a query
	 *
	 * @typeParam TName - CTE name
	 * @typeParam TExpression - CTE expression type
	 * @param name - CTE name
	 * @param expression - CTE expression
	 * @returns Query builder with WITH clause
	 */
	with<
		TName extends string,
		TExpression extends CommonTableExpression<TDatabaseSchema, TName>,
	>(name: TName, expression: TExpression) {
		return this.kysely.with(name, expression);
	}

	/**
	 * Destroys the database connection
	 */
	destroy() {
		return this.kysely.destroy();
	}

	/**
	 * Executes a function in a transaction
	 *
	 * @typeParam TResultType - Result type
	 * @param callback - Transaction callback
	 * @returns Result of the transaction
	 */
	async transaction<TResultType>(
		callback: TransactionCallback<TDatabaseSchema, TResultType>
	): Promise<TResultType> {
		if (this.asyncLocalDb.getStore()) {
			// Already in a transaction, use the existing one
			return callback({
				transaction: this.db,
				afterCommit: (callback: AfterCommitCallback) => {
					const state = this.asyncLocalDb.getStore();
					if (!state) {
						throw new Error('No transaction state found');
					}
					state.afterCommit.push(callback);
				},
			});
		}

		return this.kysely.transaction().execute(async (trx) => {
			const state: TransactionState<TDatabaseSchema> = {
				transaction: trx,
				committed: false,
				afterCommit: [],
			};

			return await this.asyncLocalDb.run(state, async () => {
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
	}

	/**
	 * Executes a SELECT query without a FROM clause
	 * Useful for retrieving constants and system values
	 *
	 * @returns Query builder with selected constant values
	 */
	selectNoFrom() {
		return this.kysely.selectNoFrom([
			sql<number>`1`.as('one'),
			sql<string>`'test'`.as('constantText'),
			sql<string>`CURRENT_TIMESTAMP`.as('currentDate'),
			sql<number>`RANDOM()`.as('randomValue'),
		]);
	}

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
	tuple<ItemTypes extends unknown[]>(items: readonly [...ItemTypes]) {
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
	}

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
	cast<ResultType>(value: unknown, dataType: string) {
		// Use a sql tag to generate the CAST expression with explicit typing
		return sql<ResultType>`CAST(${value} AS ${sql.raw(dataType)})`;
	}

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
	updateColumn<
		TTableName extends keyof TDatabaseSchema & string,
		ColumnName extends keyof TDatabaseSchema[TTableName] & string,
	>(
		table: TTableName,
		column: ColumnName,
		value: TDatabaseSchema[TTableName][ColumnName]
	) {
		const queryBuilder = this.kysely.updateTable(table);
		// Workaround for Kysely type system - using 'as any' just for the set method
		// This will be fixed in Kysely 0.27.0
		return (queryBuilder as any).set(column, value);
	}

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
	streamFrom<
		TTableName extends keyof TDatabaseSchema & string,
		ColumnName extends keyof TDatabaseSchema[TTableName] & string,
	>(table: TTableName, columns: readonly ColumnName[]) {
		if (!this.isSqlite) {
			throw new Error(
				'Streaming is currently only supported with SQLite dialect'
			);
		}

		// Using the appropriate type cast for the expression builder
		return this.kysely.selectFrom(table).select((eb) => {
			// Cast expression builder to a type that supports ref
			const expressionBuilder = eb as {
				ref: (path: string) => unknown;
			};

			// Map columns to reference expressions
			return columns.map((column) =>
				expressionBuilder.ref(`${table}.${String(column)}`)
			) as any;
		});
	}

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
	findNotNull<
		TTableName extends keyof TDatabaseSchema & string,
		ColumnName extends keyof TDatabaseSchema[TTableName] & string,
	>(table: TTableName, column: ColumnName) {
		return (
			this.selectFrom(table)
				.selectAll()
				// @ts-expect-error - Will fix when Kysely 0.27.0 upgrade is complete
				.where((eb) => eb(`${table}.${column}`, 'is not', null))
		);
	}

	/**
	 * Inserts a record with default values
	 *
	 * @typeParam TTableName - Table name
	 * @param table - Table name
	 * @returns Insert query
	 */
	insertDefault<TTableName extends keyof TDatabaseSchema & string>(
		table: TTableName
	) {
		return this.kysely.insertInto(table).defaultValues();
	}

	/**
	 * Creates a database migrator
	 *
	 * @param options - Migrator options
	 * @returns Migrator instance
	 */
	createMigrator(options: MigratorOptions): Migrator {
		return new Migrator({
			db: this.db,
			provider: options.provider,
			// Support for Kysely 0.27.2+
			allowUnorderedMigrations: options.allowUnorderedMigrations,
		});
	}
}
