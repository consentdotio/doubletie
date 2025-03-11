import { DatabaseHints, SQLiteHints } from '../../schema/fields/field-hints';
import type {
	EntitySchemaDefinition,
	SchemaField,
} from '../../schema/schema.types';
import type { ColumnDefinition, TableDefinition } from './adapter';
/**
 * SQLite-specific database adapter implementation
 */
import { BaseAdapter } from './base-adapter';

/**
 * SQLite adapter for mapping schema fields to SQLite table definitions
 */
export class SQLiteAdapter extends BaseAdapter {
	readonly type = 'sqlite';
	readonly displayName = 'SQLite';

	/**
	 * Map a schema field to a SQLite column definition
	 */
	mapFieldToColumn(
		field: SchemaField,
		fieldName: string,
		entity: EntitySchemaDefinition
	): ColumnDefinition {
		// Extract hints if available
		const hints = (field as any).databaseHints as DatabaseHints;
		const sqliteHints = hints?.sqlite;

		// If SQLite type is explicitly specified, use it
		if (sqliteHints?.type) {
			return {
				name: fieldName,
				type: sqliteHints.type,
				nullable: field.required !== true,
				defaultValue: this.getDefaultValue(field),
				primaryKey: field.primaryKey === true,
				unique: hints?.unique === true,
				autoIncrement: sqliteHints.autoIncrement === true,
			};
		}

		// Otherwise map based on field type
		const columnType = this.mapFieldTypeToSQLiteType(field, hints);

		return {
			name: fieldName,
			type: columnType,
			nullable: field.required !== true,
			defaultValue: this.getDefaultValue(field),
			primaryKey: field.primaryKey === true,
			unique: hints?.unique === true,
			autoIncrement:
				sqliteHints?.autoIncrement === true ||
				(field.type === 'number' && fieldName === 'id'),
		};
	}

	/**
	 * Generate SQL to create a table in SQLite
	 */
	generateCreateTableSQL(tableDef: TableDefinition): string {
		const columnDefs = tableDef.columns.map((col) => {
			let colDef = `"${col.name}" ${col.type}`;

			if (col.primaryKey) {
				colDef += ' PRIMARY KEY';
				if (col.autoIncrement) {
					colDef += ' AUTOINCREMENT';
				}
			}

			if (!col.nullable) {
				colDef += ' NOT NULL';
			}

			if (col.unique) {
				colDef += ' UNIQUE';
			}

			if (col.defaultValue !== undefined) {
				colDef += ` DEFAULT ${this.formatDefaultValue(col.defaultValue)}`;
			}

			return colDef;
		});

		// Add primary key constraint if it's not a single column
		if (tableDef.primaryKey && tableDef.primaryKey.length > 1) {
			columnDefs.push(
				`PRIMARY KEY (${tableDef.primaryKey.map((col) => `"${col}"`).join(', ')})`
			);
		}

		// Add foreign key constraints
		if (tableDef.foreignKeys) {
			tableDef.foreignKeys.forEach((fk) => {
				const constraint =
					`FOREIGN KEY (${fk.columns.map((col) => `"${col}"`).join(', ')}) ` +
					`REFERENCES "${fk.referencedTable}" (${fk.referencedColumns.map((col) => `"${col}"`).join(', ')})` +
					(fk.onDelete ? ` ON DELETE ${fk.onDelete}` : '') +
					(fk.onUpdate ? ` ON UPDATE ${fk.onUpdate}` : '');
				columnDefs.push(constraint);
			});
		}

		const sql = `CREATE TABLE IF NOT EXISTS "${tableDef.name}" (\n  ${columnDefs.join(',\n  ')}\n);`;

		// Add indexes as separate statements
		let indexSql = '';
		if (tableDef.indexes) {
			tableDef.indexes.forEach((idx) => {
				indexSql +=
					`\nCREATE ${idx.unique ? 'UNIQUE ' : ''}INDEX IF NOT EXISTS "${idx.name}" ` +
					`ON "${tableDef.name}" (${idx.columns.map((col) => `"${col}"`).join(', ')});`;
			});
		}

		return sql + indexSql;
	}

	/**
	 * Map field types to SQLite column types
	 */
	private mapFieldTypeToSQLiteType(
		field: SchemaField,
		hints?: DatabaseHints
	): string {
		switch (field.type) {
			case 'string':
				return 'TEXT';

			case 'number':
				// Check if this is an ID field or autoincrement
				if (hints?.sqlite?.autoIncrement || (field as any).autoIncrement) {
					return 'INTEGER';
				}
				// Check for integers vs. floats
				if (hints?.precision === 0 || (field as any).integer) {
					return 'INTEGER';
				}
				return 'REAL';

			case 'boolean':
				return 'INTEGER'; // SQLite has no native boolean

			case 'date':
				// Use INTEGER for unix timestamps, TEXT for ISO strings
				const format = (field as any).format;
				if (format === 'unix' || format === 'unix_ms') {
					return 'INTEGER';
				}
				return 'TEXT';

			case 'uuid':
				return 'TEXT';

			case 'json':
			case 'array':
				return 'TEXT'; // Store as stringified JSON

			default:
				return 'TEXT'; // Default fallback
		}
	}

	/**
	 * Get default value appropriate for SQLite
	 */
	private getDefaultValue(field: SchemaField): any {
		if (field.defaultValue === undefined) {
			return undefined;
		}

		// If it's a function, we can't represent it directly in SQLite
		if (typeof field.defaultValue === 'function') {
			return undefined; // Will be handled at application level
		}

		return field.defaultValue;
	}

	/**
	 * Format default value for use in SQLite CREATE TABLE statement
	 */
	private formatDefaultValue(value: any): string {
		if (value === null) {
			return 'NULL';
		}

		if (typeof value === 'string') {
			// Escape single quotes
			const escaped = value.replace(/'/g, "''");
			return `'${escaped}'`;
		}

		if (typeof value === 'boolean') {
			return value ? '1' : '0';
		}

		if (typeof value === 'number') {
			return value.toString();
		}

		if (value instanceof Date) {
			return `'${value.toISOString()}'`;
		}

		if (typeof value === 'object') {
			// Convert object to JSON string
			return `'${JSON.stringify(value).replace(/'/g, "''")}'`;
		}

		return String(value);
	}

	/**
	 * Transform a value from application format to SQLite format
	 * Override the base implementation for SQLite-specific transformations
	 */
	override toDatabase(field: SchemaField, value: any): any {
		if (value === undefined || value === null) {
			return value;
		}

		// SQLite-specific boolean conversion
		if (field.type === 'boolean' && typeof value === 'boolean') {
			return value ? 1 : 0;
		}

		return super.toDatabase(field, value);
	}

	/**
	 * Transform a value from SQLite format to application format
	 * Override the base implementation for SQLite-specific transformations
	 */
	override fromDatabase(field: SchemaField, dbValue: any): any {
		if (dbValue === undefined || dbValue === null) {
			return dbValue;
		}

		// SQLite-specific boolean conversion
		if (field.type === 'boolean' && typeof dbValue === 'number') {
			return dbValue !== 0;
		}

		return super.fromDatabase(field, dbValue);
	}
}
