import { DatabaseHints } from '../../schema/fields/field-hints';
/**
 * Base adapter implementation with common functionality for all database adapters
 */
import type {
	EntitySchemaDefinition,
	ResolvedField,
	SchemaField,
} from '../../schema/schema.types';
import type {
	ColumnDefinition,
	DatabaseAdapter,
	ForeignKeyDefinition,
	IndexDefinition,
	TableDefinition,
} from './adapter';

/**
 * Abstract base adapter that implements common functionality for database adapters
 */
export abstract class BaseAdapter implements DatabaseAdapter {
	/**
	 * Database type identifier
	 */
	abstract readonly type: string;

	/**
	 * Database name for display purposes
	 */
	abstract readonly displayName: string;

	/**
	 * Map a schema field to a database column definition
	 */
	abstract mapFieldToColumn(
		field: SchemaField,
		fieldName: string,
		entity: EntitySchemaDefinition
	): ColumnDefinition;

	/**
	 * Generate a SQL statement to create a table
	 */
	abstract generateCreateTableSQL(tableDef: TableDefinition): string;

	/**
	 * Transform a value from application format to database format for storage
	 */
	toDatabase(field: SchemaField, value: any): any {
		if (value === undefined || value === null) {
			return value;
		}

		// Handle date conversions based on format
		if (field.type === 'date') {
			// Special handling for date fields with format
			const format = (field as any).format;
			if (format === 'unix' && value instanceof Date) {
				return Math.floor(value.getTime() / 1000);
			}
			if (format === 'unix_ms' && value instanceof Date) {
				return value.getTime();
			}
			if (format === 'iso' && value instanceof Date) {
				return value.toISOString();
			}
			if (value instanceof Date) {
				return value.toISOString();
			}
		}

		// Handle JSON conversions
		if (field.type === 'json' && typeof value === 'object') {
			return JSON.stringify(value);
		}

		// Handle array conversions
		if (field.type === 'array' && Array.isArray(value)) {
			return JSON.stringify(value);
		}

		// Use transform function if available
		if (field.transform?.input) {
			return field.transform.input(value, {}, {});
		}

		return value;
	}

	/**
	 * Transform a value from database format to application format
	 */
	fromDatabase(field: SchemaField, dbValue: any): any {
		if (dbValue === undefined || dbValue === null) {
			return dbValue;
		}

		// Handle date conversions based on format
		if (field.type === 'date') {
			const format = (field as any).format;
			if (format === 'unix' && typeof dbValue === 'number') {
				return new Date(dbValue * 1000);
			}
			if (format === 'unix_ms' && typeof dbValue === 'number') {
				return new Date(dbValue);
			}
			if (format === 'iso' && typeof dbValue === 'string') {
				return new Date(dbValue);
			}
			if (typeof dbValue === 'string') {
				return new Date(dbValue);
			}
		}

		// Handle JSON conversions
		if (field.type === 'json' && typeof dbValue === 'string') {
			try {
				return JSON.parse(dbValue);
			} catch (e) {
				return dbValue;
			}
		}

		// Handle array conversions
		if (field.type === 'array' && typeof dbValue === 'string') {
			try {
				return JSON.parse(dbValue);
			} catch (e) {
				return dbValue;
			}
		}

		// Use transform function if available
		if (field.transform?.output) {
			return field.transform.output(dbValue, {});
		}

		return dbValue;
	}

	/**
	 * Generate a complete table definition from an entity schema
	 */
	generateTableDefinition(entity: EntitySchemaDefinition): TableDefinition {
		const tableName = entity.prefix
			? `${entity.prefix}_${entity.name}`
			: entity.name;

		// Create columns from fields
		const columns: ColumnDefinition[] = Object.entries(entity.fields).map(
			([fieldName, field]) => this.mapFieldToColumn(field, fieldName, entity)
		);

		// Find primary key
		const primaryKey = Object.entries(entity.fields)
			.filter(([, field]) => field.primaryKey === true)
			.map(([fieldName]) => fieldName);

		// Generate indexes
		const indexes: IndexDefinition[] = this.generateIndexes(entity);

		// Generate foreign keys
		const foreignKeys: ForeignKeyDefinition[] =
			this.generateForeignKeys(entity);

		return {
			name: tableName,
			columns,
			primaryKey: primaryKey.length > 0 ? primaryKey : undefined,
			indexes: indexes.length > 0 ? indexes : undefined,
			foreignKeys: foreignKeys.length > 0 ? foreignKeys : undefined,
			comment: entity.description,
		};
	}

	/**
	 * Helper method to generate indexes from entity definition
	 */
	protected generateIndexes(entity: EntitySchemaDefinition): IndexDefinition[] {
		const indexes: IndexDefinition[] = [];

		// Extract individual field indexes
		Object.entries(entity.fields).forEach(([fieldName, field]) => {
			// Get database hints
			const hints = (field as any).databaseHints as DatabaseHints;
			if (hints?.indexed || hints?.unique) {
				indexes.push({
					name: `idx_${entity.name}_${fieldName}`,
					columns: [fieldName],
					unique: hints.unique,
				});
			}
		});

		// Add any entity-level indexes from config
		if (entity.config?.indexes) {
			const entityIndexes = entity.config.indexes as any[];
			entityIndexes.forEach((indexDef, i) => {
				indexes.push({
					name: indexDef.name || `idx_${entity.name}_${i}`,
					columns: Array.isArray(indexDef.columns)
						? indexDef.columns
						: [indexDef.columns],
					unique: indexDef.unique,
				});
			});
		}

		return indexes;
	}

	/**
	 * Helper method to generate foreign keys from entity definition
	 */
	protected generateForeignKeys(
		entity: EntitySchemaDefinition
	): ForeignKeyDefinition[] {
		const foreignKeys: ForeignKeyDefinition[] = [];

		// Extract foreign keys from relationship fields
		Object.entries(entity.fields).forEach(([fieldName, field]) => {
			if (field.relationship) {
				foreignKeys.push({
					name: `fk_${entity.name}_${fieldName}`,
					columns: [fieldName],
					referencedTable: field.relationship.model,
					referencedColumns: [field.relationship.field],
					onDelete: field.relationship.onDelete,
					onUpdate: field.relationship.onUpdate,
				});
			}
		});

		return foreignKeys;
	}
}
