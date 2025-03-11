/**
 * Database utility functions
 */
import type { EntitySchemaDefinition } from '../schema/schema.types';
import { getAdapter } from './adapters';
import type { TableDefinition } from './adapters/adapter';

/**
 * Helper function to generate a table definition for an entity
 * @param entity The entity definition
 * @param adapterType The database adapter type to use
 * @returns A table definition
 */
export function generateTableDefinition(
	entity: EntitySchemaDefinition,
	adapterType = 'sqlite'
): TableDefinition {
	const adapter = getAdapter(adapterType);
	return adapter.generateTableDefinition(entity);
}

/**
 * Helper function to generate SQL for creating a table from an entity
 * @param entity The entity definition
 * @param adapterType The database adapter type to use
 * @returns SQL string for creating the table
 */
export function generateSQLForEntity(
	entity: EntitySchemaDefinition,
	adapterType = 'sqlite'
): string {
	const adapter = getAdapter(adapterType);
	const tableDef = adapter.generateTableDefinition(entity);
	return adapter.generateCreateTableSQL(tableDef);
}

/**
 * Helper function to transform a value to database format
 * @param field The field definition
 * @param value The value to transform
 * @param adapterType The database adapter type to use
 * @returns The transformed value
 */
export function toDatabaseValue(
	field: any,
	value: any,
	adapterType = 'sqlite'
): any {
	const adapter = getAdapter(adapterType);
	return adapter.toDatabase(field, value);
}

/**
 * Helper function to transform a value from database format
 * @param field The field definition
 * @param dbValue The database value to transform
 * @param adapterType The database adapter type to use
 * @returns The transformed value
 */
export function fromDatabaseValue(
	field: any,
	dbValue: any,
	adapterType = 'sqlite'
): any {
	const adapter = getAdapter(adapterType);
	return adapter.fromDatabase(field, dbValue);
}
