import { SchemaField } from '../../schema/schema.types';
import type { EntitySchemaDefinition } from '../../schema/schema.types';
import { ColumnDefinition, TableDefinition } from './adapter';
import { BaseAdapter } from './base-adapter';

// Define PostgreSQL-specific hints interface
interface PostgresExtendedHints {
	schema?: string;
	uuid?: boolean;
	// Add other PostgreSQL-specific hints as needed
}

// Define PostgreSQL-specific column definition
interface PostgresColumnDefinition<T extends string = string>
	extends ColumnDefinition<T> {
	_schema?: string;
	_references?: { table: string; column: string };
	_onDelete?: string;
	_onUpdate?: string;
}

/**
 * PostgreSQL database adapter implementation
 *
 * This adapter handles mapping between schema fields and PostgreSQL-specific
 * column definitions, as well as generating SQL for table creation.
 */
export class PostgresAdapter extends BaseAdapter {
	type = 'postgres';
	displayName = 'PostgreSQL';

	/**
	 * Maps a schema field to a PostgreSQL column definition
	 */
	mapFieldToColumn<
		TFieldType extends string = string,
		TColumnType extends string = string,
	>(
		field: SchemaField<TFieldType>,
		fieldName: string,
		entity: EntitySchemaDefinition
	): ColumnDefinition<TColumnType> {
		// Create the basic column definition
		const columnDef: PostgresColumnDefinition<TColumnType> = {
			name: fieldName,
			type: this.mapFieldTypeToPostgresType(field),
			nullable: !field.required,
			primaryKey: field.primaryKey === true,
			unique: field.databaseHints?.unique === true,
		};

		// Handle PostgreSQL-specific features
		const pgHints = field.databaseHints?.postgres as
			| PostgresExtendedHints
			| undefined;

		// Handle autoincrement for numbers
		if (
			field.type === 'number' &&
			(field.databaseHints as any)?.autoIncrement === true
		) {
			columnDef.autoIncrement = true;
		}

		// Add relationship reference
		if (field.relationship) {
			// Add reference information but not directly on the column definition
			const reference = {
				table: field.relationship.entity, // Use entity instead of model
				column: field.relationship.field,
			};

			// Store reference in a custom property
			columnDef._references = reference;

			// Handle relationship options if present
			if (field.relationship.relationship) {
				const relConfig = field.relationship.relationship;
				if (relConfig.onDelete) {
					columnDef._onDelete = relConfig.onDelete;
				}
				if (relConfig.onUpdate) {
					columnDef._onUpdate = relConfig.onUpdate;
				}
			}
		}

		// Add PostgreSQL-specific hints if available
		if (pgHints && typeof pgHints === 'object') {
			if (pgHints.schema) {
				columnDef._schema = pgHints.schema;
			}
		}

		columnDef.defaultValue = this.getDefaultValue(field);

		return columnDef;
	}

	/**
	 * Generate SQL to create a table in PostgreSQL
	 */
	generateCreateTableSQL<
		TTableOptions extends Record<string, any> = {},
		TColumnType extends string = string,
		TPrimaryKeyType extends string = string,
		TOnAction extends string = string,
	>(
		tableDef: TableDefinition<
			TTableOptions,
			TColumnType,
			TPrimaryKeyType,
			TOnAction
		>
	): string {
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

			// Handle column comment
			const colComment = (col as any).comment;
			if (colComment) {
				// Add comment later as a separate command
			}

			return colDef;
		});

		// Add primary key constraint if it's a composite key
		if (
			tableDef.primaryKey &&
			typeof tableDef.primaryKey === 'object' &&
			Array.isArray(tableDef.primaryKey.columns) &&
			tableDef.primaryKey.columns.length > 1
		) {
			columnDefs.push(
				`PRIMARY KEY (${tableDef.primaryKey.columns.map((col) => `"${col}"`).join(', ')})`
			);
		}

		// Add foreign key constraints
		if (tableDef.foreignKeys && tableDef.foreignKeys.length > 0) {
			tableDef.foreignKeys.forEach((fk) => {
				if (
					fk.columns &&
					fk.columns.length > 0 &&
					fk.referencedTable &&
					fk.referencedColumns &&
					fk.referencedColumns.length > 0
				) {
					const constraint =
						`CONSTRAINT "${fk.name || ''}" FOREIGN KEY (${fk.columns.map((col) => `"${col}"`).join(', ')}) ` +
						`REFERENCES "${fk.referencedTable}" (${fk.referencedColumns.map((col) => `"${col}"`).join(', ')})` +
						(fk.onDelete ? ` ON DELETE ${fk.onDelete}` : '') +
						(fk.onUpdate ? ` ON UPDATE ${fk.onUpdate}` : '');
					columnDefs.push(constraint);
				}
			});
		}

		let sql = `CREATE TABLE IF NOT EXISTS "${tableDef.name}" (\n  ${columnDefs.join(',\n  ')}\n);\n`;

		// Add table comments if provided
		const tableComment = (tableDef as any).comment;
		if (tableComment) {
			sql += `COMMENT ON TABLE "${tableDef.name}" IS '${this.escapeString(tableComment)}';\n`;
		}

		// Add column comments
		tableDef.columns.forEach((col) => {
			const colComment = (col as any).comment;
			if (colComment) {
				sql += `COMMENT ON COLUMN "${tableDef.name}"."${col.name}" IS '${this.escapeString(colComment)}';\n`;
			}
		});

		// Add indexes as separate statements
		if (tableDef.indexes && tableDef.indexes.length > 0) {
			tableDef.indexes.forEach((idx) => {
				if (idx.columns && idx.columns.length > 0) {
					const indexType = (idx as any).type
						? ` USING ${(idx as any).type}`
						: '';
					sql += `CREATE ${idx.unique ? 'UNIQUE ' : ''}INDEX IF NOT EXISTS "${idx.name}" ON "${tableDef.name}"${indexType} (${idx.columns.map((col) => `"${col}"`).join(', ')});\n`;
				}
			});
		}

		return sql;
	}

	/**
	 * Maps a schema field type to a PostgreSQL data type
	 */
	mapFieldTypeToPostgresType(field: SchemaField): string {
		switch (field.type) {
			case 'string':
				return 'TEXT';
			case 'number':
				return field.databaseHints?.integer ? 'INTEGER' : 'REAL';
			case 'boolean':
				return 'BOOLEAN';
			case 'date':
				return 'TIMESTAMP WITH TIME ZONE';
			case 'json':
				return 'JSONB';
			default:
				return 'TEXT'; // Default to TEXT for unknown types
		}
	}

	/**
	 * Get default value appropriate for PostgreSQL
	 */
	protected getDefaultValue(field: SchemaField): any {
		if (field.defaultValue === undefined || field.defaultValue === null) {
			return null;
		}

		// Handle special cases for default values (like functions)
		if (typeof field.defaultValue === 'function') {
			// Special handling for function defaults
			if (field.type === 'date') {
				return 'CURRENT_TIMESTAMP';
			}

			// Handle UUID generation for string fields
			const pgHints = field.databaseHints?.postgres as
				| PostgresExtendedHints
				| undefined;
			if (field.type === 'string' && pgHints?.uuid) {
				return 'gen_random_uuid()';
			}

			// Other function defaults may need special treatment
			return null;
		}

		// For primitive values, handle them directly
		if (typeof field.defaultValue === 'string') {
			return `'${this.escapeString(field.defaultValue)}'`;
		}

		if (typeof field.defaultValue === 'number') {
			return field.defaultValue.toString();
		}

		if (typeof field.defaultValue === 'boolean') {
			return field.defaultValue ? 'TRUE' : 'FALSE';
		}

		if (field.defaultValue instanceof Date) {
			return `'${field.defaultValue.toISOString()}'::timestamp`;
		}

		if (typeof field.defaultValue === 'object') {
			// For objects, convert to JSON
			return `'${this.escapeString(JSON.stringify(field.defaultValue))}'::jsonb`;
		}

		// For any other types, convert to string
		return `'${this.escapeString(String(field.defaultValue))}'`;
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
	 * Transform a value for the database
	 */
	override toDatabase(value: any, field: SchemaField): any {
		if (value === undefined || value === null) {
			return value;
		}

		// Handle PostgreSQL-specific conversions
		if (field.type === 'json' || field.type === 'array') {
			if (typeof value === 'object') {
				return JSON.stringify(value);
			}
		}

		return super.toDatabase(value, field);
	}

	/**
	 * Transform a value from the database
	 */
	override fromDatabase(dbValue: any, field: SchemaField): any {
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

		return super.fromDatabase(dbValue, field);
	}
}
