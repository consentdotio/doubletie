import { DatabaseHints, PostgresHints } from '../../schema/fields/field-hints';
import type {
	EntitySchemaDefinition,
	SchemaField,
} from '../../schema/schema.types';
import type { ColumnDefinition, TableDefinition } from './adapter';
/**
 * PostgreSQL-specific database adapter implementation
 */
import { BaseAdapter } from './base-adapter';

/**
 * PostgreSQL adapter for mapping schema fields to PostgreSQL table definitions
 */
export class PostgresAdapter extends BaseAdapter {
	readonly type = 'postgres';
	readonly displayName = 'PostgreSQL';

	/**
	 * Map a schema field to a PostgreSQL column definition
	 */
	mapFieldToColumn(
		field: SchemaField,
		fieldName: string,
		entity: EntitySchemaDefinition
	): ColumnDefinition {
		// Extract hints if available
		const hints = (field as any).databaseHints as DatabaseHints;
		const pgHints = hints?.postgres;

		// If PostgreSQL type is explicitly specified, use it
		if (pgHints?.type) {
			return {
				name: fieldName,
				type: pgHints.type,
				nullable: field.required !== true,
				defaultValue: this.getDefaultValue(field),
				primaryKey: field.primaryKey === true,
				unique: hints?.unique === true,
				autoIncrement: pgHints.useSerial === true,
			};
		}

		// Otherwise map based on field type
		const columnType = this.mapFieldTypeToPostgresType(field, hints);

		return {
			name: fieldName,
			type: columnType,
			nullable: field.required !== true,
			defaultValue: this.getDefaultValue(field),
			primaryKey: field.primaryKey === true,
			unique: hints?.unique === true,
			comment: field.description,
		};
	}

	/**
	 * Generate SQL to create a table in PostgreSQL
	 */
	generateCreateTableSQL(tableDef: TableDefinition): string {
		const columnDefs = tableDef.columns.map((col) => {
			let colDef = `"${col.name}" ${col.type}`;

			if (!col.nullable) {
				colDef += ' NOT NULL';
			}

			if (col.primaryKey) {
				colDef += ' PRIMARY KEY';
			}

			if (col.unique) {
				colDef += ' UNIQUE';
			}

			if (col.defaultValue !== undefined) {
				colDef += ` DEFAULT ${this.formatDefaultValue(col.defaultValue)}`;
			}

			if (col.comment) {
				// Add comment later as a separate command
			}

			return colDef;
		});

		// Add primary key constraint if it's a composite key
		if (tableDef.primaryKey && tableDef.primaryKey.length > 1) {
			columnDefs.push(
				`PRIMARY KEY (${tableDef.primaryKey.map((col) => `"${col}"`).join(', ')})`
			);
		}

		// Add foreign key constraints
		if (tableDef.foreignKeys) {
			tableDef.foreignKeys.forEach((fk) => {
				const constraint =
					`CONSTRAINT "${fk.name}" FOREIGN KEY (${fk.columns.map((col) => `"${col}"`).join(', ')}) ` +
					`REFERENCES "${fk.referencedTable}" (${fk.referencedColumns.map((col) => `"${col}"`).join(', ')})` +
					(fk.onDelete ? ` ON DELETE ${fk.onDelete}` : '') +
					(fk.onUpdate ? ` ON UPDATE ${fk.onUpdate}` : '');
				columnDefs.push(constraint);
			});
		}

		let sql = `CREATE TABLE IF NOT EXISTS "${tableDef.name}" (\n  ${columnDefs.join(',\n  ')}\n);\n`;

		// Add table comments if provided
		if (tableDef.comment) {
			sql += `COMMENT ON TABLE "${tableDef.name}" IS '${this.escapeString(tableDef.comment)}';\n`;
		}

		// Add column comments
		tableDef.columns.forEach((col) => {
			if (col.comment) {
				sql += `COMMENT ON COLUMN "${tableDef.name}"."${col.name}" IS '${this.escapeString(col.comment)}';\n`;
			}
		});

		// Add indexes as separate statements
		if (tableDef.indexes) {
			tableDef.indexes.forEach((idx) => {
				const indexType = idx.type ? ` USING ${idx.type}` : '';
				sql += `CREATE ${idx.unique ? 'UNIQUE ' : ''}INDEX IF NOT EXISTS "${idx.name}" ON "${tableDef.name}"${indexType} (${idx.columns.map((col) => `"${col}"`).join(', ')});\n`;
			});
		}

		return sql;
	}

	/**
	 * Map field types to PostgreSQL column types
	 */
	private mapFieldTypeToPostgresType(
		field: SchemaField,
		hints?: DatabaseHints
	): string {
		switch (field.type) {
			case 'string':
				if (hints?.maxSize && hints.maxSize <= 255) {
					return `VARCHAR(${hints.maxSize})`;
				}
				return 'TEXT';

			case 'number':
				// Handle integers vs. decimals
				if (hints?.precision !== undefined && hints?.scale !== undefined) {
					return `NUMERIC(${hints.precision}, ${hints.scale})`;
				}
				if (hints?.precision === 0 || (field as any).integer) {
					return 'INTEGER';
				}
				return 'DOUBLE PRECISION';

			case 'boolean':
				return 'BOOLEAN';

			case 'date':
				// Use appropriate timestamp type based on format
				const format = (field as any).format;
				const hasTimezone =
					(field as any).includeTimezone || hints?.hasTimezone;

				if (format === 'unix' || format === 'unix_ms') {
					return 'BIGINT';
				}
				return hasTimezone ? 'TIMESTAMPTZ' : 'TIMESTAMP';

			case 'uuid':
				return 'UUID';

			case 'json':
			case 'array':
				return 'JSONB'; // More efficient than JSON for most operations

			default:
				return 'TEXT'; // Default fallback
		}
	}

	/**
	 * Get default value appropriate for PostgreSQL
	 */
	private getDefaultValue(field: SchemaField): any {
		if (field.defaultValue === undefined) {
			return undefined;
		}

		// If it's a function, we can't represent it directly in PostgreSQL
		if (typeof field.defaultValue === 'function') {
			// Special case for timestamp/date defaults
			if (field.type === 'date') {
				return 'NOW()';
			}
			// Special case for UUID defaults
			if (field.type === 'uuid') {
				return 'gen_random_uuid()';
			}
			return undefined; // Will be handled at application level
		}

		return field.defaultValue;
	}

	/**
	 * Format default value for use in PostgreSQL CREATE TABLE statement
	 */
	private formatDefaultValue(value: any): string {
		if (value === null) {
			return 'NULL';
		}

		if (typeof value === 'string') {
			if (
				value.toUpperCase() === 'NOW()' ||
				value.toUpperCase() === 'CURRENT_TIMESTAMP' ||
				value.toUpperCase() === 'GEN_RANDOM_UUID()'
			) {
				return value; // SQL function call, don't quote
			}
			// Escape single quotes for string literals
			const escaped = value.replace(/'/g, "''");
			return `'${escaped}'`;
		}

		if (typeof value === 'boolean') {
			return value ? 'TRUE' : 'FALSE';
		}

		if (typeof value === 'number') {
			return value.toString();
		}

		if (value instanceof Date) {
			return `'${value.toISOString()}'::timestamp`;
		}

		if (typeof value === 'object') {
			// Convert object to JSON string
			return `'${this.escapeString(JSON.stringify(value))}'::jsonb`;
		}

		return String(value);
	}

	/**
	 * Escape string for PostgreSQL
	 */
	private escapeString(str: string): string {
		return str.replace(/'/g, "''");
	}

	/**
	 * Transform a value from application format to PostgreSQL format
	 */
	override toDatabase(field: SchemaField, value: any): any {
		if (value === undefined || value === null) {
			return value;
		}

		// Handle PostgreSQL-specific conversions
		if (field.type === 'json' || field.type === 'array') {
			if (typeof value === 'object') {
				return JSON.stringify(value);
			}
		}

		return super.toDatabase(field, value);
	}

	/**
	 * Transform a value from PostgreSQL format to application format
	 */
	override fromDatabase(field: SchemaField, dbValue: any): any {
		if (dbValue === undefined || dbValue === null) {
			return dbValue;
		}

		// Handle PostgreSQL-specific conversions
		if (
			(field.type === 'json' || field.type === 'array') &&
			typeof dbValue === 'string'
		) {
			try {
				return JSON.parse(dbValue);
			} catch (e) {
				return dbValue;
			}
		}

		return super.fromDatabase(field, dbValue);
	}
}
