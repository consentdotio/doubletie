import { MySQLHints } from '../../schema/fields/field-hints';
import { SchemaField } from '../../schema/schema.types';
import type { EntitySchemaDefinition } from '../../schema/schema.types';
import {
	ColumnDefinition,
	ForeignKeyDefinition,
	TableDefinition,
} from './adapter';
import { BaseAdapter } from './base-adapter';

// Define interface to extend ColumnDefinition with MySQL-specific properties
interface MySQLColumnDefinition<T extends string = string>
	extends ColumnDefinition<T> {
	_unsigned?: boolean;
	_zerofill?: boolean;
	_charset?: string;
	_collation?: string;
	_references?: { table: string; column: string };
	_onDelete?: string;
	_onUpdate?: string;
}

// Define interface to extend TableDefinition with MySQL-specific options
interface MySQLTableOptions {
	charset?: string;
	collation?: string;
	engine?: string;
	description?: string;
}

/**
 * MySQL database adapter implementation
 *
 * This adapter handles mapping between schema fields and MySQL-specific
 * column definitions, as well as generating SQL for table creation.
 */
export class MySQLAdapter extends BaseAdapter {
	type = 'mysql';
	displayName = 'MySQL';

	/**
	 * Maps a schema field to a MySQL column definition
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
		const columnDef: MySQLColumnDefinition<TColumnType> = {
			name: fieldName,
			type: this.mapFieldTypeToMySQLType(field),
			nullable: !field.required,
			primaryKey: field.primaryKey === true,
			unique: field.databaseHints?.unique === true,
		};

		// Add MySQL-specific properties
		const mysqlHints = field.databaseHints?.mysql;

		// Handle autoincrement separately since it's not in DatabaseHints but might be in MySQL hints
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

		// Add MySQL-specific hints if available
		if (mysqlHints) {
			// Add character set if specified
			if (mysqlHints.charset) {
				columnDef._charset = mysqlHints.charset;
			}

			// Add collation if specified
			if (mysqlHints.collation) {
				columnDef._collation = mysqlHints.collation;
			}

			// Add unsigned flag if specified
			if (mysqlHints.unsigned) {
				columnDef._unsigned = true;
			}

			// Add zerofill flag if specified
			if (mysqlHints.zerofill) {
				columnDef._zerofill = true;
			}
		}

		columnDef.defaultValue = this.getDefaultValue(field);

		return columnDef;
	}

	/**
	 * Generate SQL for creating a column
	 */
	protected generateColumnSQL(column: MySQLColumnDefinition): string {
		let columnSQL = `${this.escapeIdentifier(column.name)} ${column.type}`;

		if (column.primaryKey) {
			columnSQL += ' PRIMARY KEY';
		}

		if (column.autoIncrement) {
			columnSQL += ' AUTO_INCREMENT';
		}

		if (!column.nullable) {
			columnSQL += ' NOT NULL';
		} else {
			columnSQL += ' NULL';
		}

		if (column._unsigned) {
			columnSQL += ' UNSIGNED';
		}

		if (column._zerofill) {
			columnSQL += ' ZEROFILL';
		}

		if (column._charset) {
			columnSQL += ` CHARACTER SET ${column._charset}`;
		}

		if (column._collation) {
			columnSQL += ` COLLATE ${column._collation}`;
		}

		if (column.unique) {
			columnSQL += ' UNIQUE';
		}

		if (column.defaultValue !== undefined) {
			columnSQL += ` DEFAULT ${column.defaultValue}`;
		}

		return columnSQL;
	}

	/**
	 * Generate the SQL for creating a table
	 */
	generateCreateTableSQL<
		TTableOptions extends MySQLTableOptions = MySQLTableOptions,
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
		let sql = `CREATE TABLE IF NOT EXISTS ${this.escapeIdentifier(tableDef.name)} (\n`;

		// Add columns
		const columnSQLs: string[] = [];
		for (const column of tableDef.columns) {
			columnSQLs.push(
				`  ${this.generateColumnSQL(column as MySQLColumnDefinition)}`
			);
		}

		// Add primary key constraint if specified
		if (
			tableDef.primaryKey &&
			typeof tableDef.primaryKey === 'object' &&
			Array.isArray(tableDef.primaryKey.columns) &&
			tableDef.primaryKey.columns.length > 0
		) {
			const pkColumns = tableDef.primaryKey.columns
				.map((col) => this.escapeIdentifier(col))
				.join(', ');
			columnSQLs.push(`  PRIMARY KEY (${pkColumns})`);
		}

		// Add foreign keys
		if (tableDef.foreignKeys && tableDef.foreignKeys.length > 0) {
			for (const fk of tableDef.foreignKeys) {
				if (
					fk.columns &&
					fk.columns.length > 0 &&
					fk.referencedTable &&
					fk.referencedColumns &&
					fk.referencedColumns.length > 0
				) {
					let fkSQL = `  FOREIGN KEY ${this.escapeIdentifier(fk.name || '')} (${this.escapeIdentifier(fk.columns[0] || '')})`;
					fkSQL += ` REFERENCES ${this.escapeIdentifier(fk.referencedTable)} (${this.escapeIdentifier(fk.referencedColumns[0] || '')})`;

					if (fk.onDelete) {
						fkSQL += ` ON DELETE ${fk.onDelete}`;
					}

					if (fk.onUpdate) {
						fkSQL += ` ON UPDATE ${fk.onUpdate}`;
					}

					columnSQLs.push(fkSQL);
				}
			}
		}

		sql += columnSQLs.join(',\n');
		sql += '\n)';

		// Add MySQL-specific table options
		const options = tableDef.options as MySQLTableOptions | undefined;

		if (options && options.charset) {
			sql += ` CHARACTER SET=${options.charset}`;
		}

		if (options && options.collation) {
			sql += ` COLLATE=${options.collation}`;
		}

		if (options && options.engine) {
			sql += ` ENGINE=${options.engine}`;
		}

		const tableDesc = (tableDef as any).description;
		if (tableDesc) {
			sql += ` COMMENT=${this.escapeString(tableDesc)}`;
		}

		sql += ';';
		return sql;
	}

	/**
	 * Map field type to a MySQL data type
	 */
	mapFieldTypeToMySQLType(field: SchemaField): string {
		const hints = field.databaseHints;
		const mysqlHints = hints?.mysql;

		switch (field.type) {
			case 'string':
				if (hints && (hints as any).maxLength) {
					const maxLength = (hints as any).maxLength;
					return `VARCHAR(${maxLength})`;
				}
				return 'TEXT';

			case 'number':
				// If it's an autoincrement ID, use INT
				if ((hints as any)?.autoIncrement) {
					return 'INT';
				}

				// Use type based on precision/scale hints
				if ((hints as any)?.integer) {
					// Integer types based on precision
					if ((hints as any)?.precision) {
						const precision = (hints as any).precision;
						if (precision > 9) {
							return 'BIGINT';
						} else if (precision > 4) {
							return 'INT';
						} else if (precision > 2) {
							return 'SMALLINT';
						} else {
							return 'TINYINT';
						}
					}
					return 'INT';
				}

				// For decimal/floating point types
				if ((hints as any)?.precision && (hints as any)?.scale) {
					const precision = (hints as any).precision;
					const scale = (hints as any).scale;
					return `DECIMAL(${precision}, ${scale})`;
				}

				return 'DOUBLE';

			case 'boolean':
				return 'TINYINT(1)';

			case 'date':
				// Determine date type based on hints
				if ((hints as any)?.includeTime) {
					return 'DATETIME';
				}
				return 'DATE';

			case 'json':
				return 'JSON';

			default:
				return 'TEXT';
		}
	}

	/**
	 * Get default value appropriate for MySQL
	 */
	protected getDefaultValue(field: SchemaField): any {
		if (field.defaultValue === undefined || field.defaultValue === null) {
			return null;
		}

		// Handle function defaults separately
		if (typeof field.defaultValue === 'function') {
			if (field.type === 'date') {
				return 'CURRENT_TIMESTAMP';
			}
			return null;
		}

		// Handle primitive types directly
		if (typeof field.defaultValue === 'string') {
			return this.escapeString(field.defaultValue);
		}

		if (typeof field.defaultValue === 'number') {
			return field.defaultValue.toString();
		}

		if (typeof field.defaultValue === 'boolean') {
			return field.defaultValue ? '1' : '0';
		}

		if (field.defaultValue instanceof Date) {
			return `'${field.defaultValue.toISOString().slice(0, 19).replace('T', ' ')}'`;
		}

		if (typeof field.defaultValue === 'object') {
			// For objects, convert to JSON string
			return this.escapeString(JSON.stringify(field.defaultValue));
		}

		// For any other types, convert to string
		return this.escapeString(String(field.defaultValue));
	}

	/**
	 * Escapes a string for use in MySQL queries
	 */
	private escapeString(value: string): string {
		return `'${value.replace(/'/g, "''")}'`;
	}

	/**
	 * Escapes an identifier (table or column name) for MySQL
	 */
	private escapeIdentifier(identifier: string): string {
		return `\`${identifier.replace(/`/g, '``')}\``;
	}

	/**
	 * Transforms a value to MySQL database format
	 */
	override toDatabase(value: any, field: SchemaField): any {
		if (value === undefined || value === null) {
			return null;
		}

		switch (field.type) {
			case 'boolean':
				return value ? 1 : 0;

			case 'date':
				// Format date according to MySQL's datetime format
				if (value instanceof Date) {
					return value.toISOString().slice(0, 19).replace('T', ' ');
				}
				if (typeof value === 'number') {
					return new Date(value).toISOString().slice(0, 19).replace('T', ' ');
				}
				if (typeof value === 'string') {
					return new Date(value).toISOString().slice(0, 19).replace('T', ' ');
				}
				return value;

			case 'array':
			case 'object':
				return JSON.stringify(value);

			default:
				return value;
		}
	}

	/**
	 * Transforms a value from MySQL database format
	 */
	override fromDatabase(dbValue: any, field: SchemaField): any {
		if (dbValue === null || dbValue === undefined) {
			return null;
		}

		switch (field.type) {
			case 'boolean':
				return Boolean(dbValue);

			case 'number':
				return typeof dbValue === 'string' ? parseFloat(dbValue) : dbValue;

			case 'date':
				// Convert MySQL datetime format to JS Date
				if (typeof dbValue === 'string') {
					return new Date(dbValue.replace(' ', 'T') + 'Z');
				}
				return dbValue;

			case 'array':
			case 'object':
				if (typeof dbValue === 'string') {
					try {
						return JSON.parse(dbValue);
					} catch (e) {
						return dbValue;
					}
				}
				return dbValue;

			default:
				return dbValue;
		}
	}
}
