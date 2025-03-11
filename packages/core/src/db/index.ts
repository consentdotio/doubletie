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

// Schema merging types
export type { ResolvedEntitySchema } from './merge';

/**
 * Helper function to generate a table definition for an entity
 * @param entity The entity definition
 * @param adapterType The database adapter type to use
 * @returns A table definition
 */
function generateTableDefinition(entity: any, adapterType = 'sqlite') {
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
function generateSQLForEntity(entity: any, adapterType = 'sqlite') {
	const { getAdapter } = require('./adapters');
	const adapter = getAdapter(adapterType);
	const tableDef = adapter.generateTableDefinition(entity);
	return adapter.generateCreateTableSQL(tableDef);
}
