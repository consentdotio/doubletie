/**
 * Database module exports
 * @module db
 */

// Core DB utilities
export { mergeSchemaWithConfig } from './merge';
export { generateTable } from './table';

// Database adapter exports
export {
	type DatabaseAdapter,
	BaseAdapter,
	SQLiteAdapter,
	PostgresAdapter,
	MySQLAdapter,
	// Adapter registry methods
	getAdapter,
	registerAdapter,
	getAdapters,
} from './adapters';

// Utility functions for working with databases
export {
	generateTableDefinition,
	generateSQLForEntity,
	toDatabaseValue,
	fromDatabaseValue,
} from './utils';

// Column and table definition types
export type {
	ColumnDefinition,
	TableDefinition,
	IndexDefinition,
	ForeignKeyDefinition,
} from './adapters/adapter';

// Import EntityFieldsMap from entity.types
export type { EntityFieldsMap } from '../entity/entity.types';

// Schema merging types
export type { ResolvedEntitySchema } from './merge';

/**
 * Database adapter type for type-safe adapter selection
 */
export type AdapterType = 'sqlite' | 'postgres' | 'mysql' | string;

/**
 * Helper function to generate a table definition for an entity
 * @param entity The entity definition
 * @param adapterType The database adapter type to use
 * @returns A table definition
 */
function generateTableDefinition<
	TEntity extends { name: string; fields: Record<string, any> },
>(entity: TEntity, adapterType: AdapterType = 'sqlite') {
	const { getAdapter } = require('./adapters');
	const adapter = getAdapter(adapterType);
	return adapter.generateTableDefinition(entity);
}

/**
 * Helper function to generate SQL for creating a table from an entity
 * @param entity The entity definition
 * @param adapterType The database adapter type to use
 * @returns SQL string for creating the table
 */
function generateSQLForEntity<
	TEntity extends { name: string; fields: Record<string, any> },
>(entity: TEntity, adapterType: AdapterType = 'sqlite'): string {
	const { getAdapter } = require('./adapters');
	const adapter = getAdapter(adapterType);
	const tableDef = adapter.generateTableDefinition(entity);
	return adapter.generateCreateTableSQL(tableDef);
}
