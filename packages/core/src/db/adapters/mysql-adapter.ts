import { SchemaField } from '../../schema/types';
import { MySQLHints } from '../field-hints';
import {
	BaseAdapter,
	ColumnDefinition,
	ForeignKeyDefinition,
	IndexDefinition,
	TableDefinition,
} from './base-adapter';

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
	mapFieldToColumn(
		fieldName: string,
		field: SchemaField,
		entityName: string
	): ColumnDefinition {
		const columnDef: ColumnDefinition = {
			name: fieldName,
			type: this.mapFieldTypeToMySQLType(field),
			nullable: !field.required,
			primaryKey: field.primaryKey === true,
			unique: field.databaseHints?.unique === true,
			autoIncrement:
				field.type === 'number' && field.databaseHints?.autoIncrement === true,
			references: field.relationship
				? {
						table: field.relationship.model,
						column: field.relationship.field,
						onDelete: field.relationship.onDelete,
						onUpdate: field.relationship.onUpdate,
					}
				: undefined,
			defaultValue: this.getDefaultValueSQL(field),
			comment: field.description,
		};

		// Add MySQL-specific hints if available
		const mysqlHints = field.databaseHints as MySQLHints;

		if (mysqlHints) {
			if (mysqlHints.charset) {
				columnDef.charset = mysqlHints.charset;
			}

			if (mysqlHints.collation) {
				columnDef.collation = mysqlHints.collation;
			}

			if (field.type === 'number' && mysqlHints.unsigned) {
				columnDef.unsigned = true;
			}

			if (field.type === 'number' && mysqlHints.zerofill) {
				columnDef.zerofill = true;
			}
		}

		return columnDef;
	}

	/**
	 * Generates SQL for creating a table from a table definition
	 */
	generateCreateTableSQL(tableDef: TableDefinition): string {
		let sql = `CREATE TABLE ${this.escapeIdentifier(tableDef.name)} (\n`;

		// Add column definitions
		const columnSQLs = tableDef.columns.map((column) => {
			let columnSQL = `  ${this.escapeIdentifier(column.name)} ${column.type}`;

			if (column.unsigned) {
				columnSQL += ' UNSIGNED';
			}

			if (column.zerofill) {
				columnSQL += ' ZEROFILL';
			}

			if (column.charset) {
				columnSQL += ` CHARACTER SET ${column.charset}`;
			}

			if (column.collation) {
				columnSQL += ` COLLATE ${column.collation}`;
			}

			if (!column.nullable) {
				columnSQL += ' NOT NULL';
			}

			if (column.autoIncrement) {
				columnSQL += ' AUTO_INCREMENT';
			}

			if (column.defaultValue !== undefined) {
				columnSQL += ` DEFAULT ${column.defaultValue}`;
			}

			if (column.comment) {
				columnSQL += ` COMMENT ${this.escapeString(column.comment)}`;
			}

			return columnSQL;
		});

		sql += columnSQLs.join(',\n');

		// Add primary key
		const primaryKeyColumns = tableDef.columns
			.filter((col) => col.primaryKey)
			.map((col) => this.escapeIdentifier(col.name));

		if (primaryKeyColumns.length > 0) {
			sql += `,\n  PRIMARY KEY (${primaryKeyColumns.join(', ')})`;
		}

		// Add unique constraints
		if (tableDef.indexes) {
			const uniqueIndexes = tableDef.indexes.filter((idx) => idx.unique);

			uniqueIndexes.forEach((idx) => {
				const columns = idx.columns
					.map((col) => this.escapeIdentifier(col))
					.join(', ');
				sql += `,\n  UNIQUE KEY ${this.escapeIdentifier(idx.name)} (${columns})`;
			});

			// Add regular indexes
			const regularIndexes = tableDef.indexes.filter((idx) => !idx.unique);

			regularIndexes.forEach((idx) => {
				const columns = idx.columns
					.map((col) => this.escapeIdentifier(col))
					.join(', ');
				sql += `,\n  INDEX ${this.escapeIdentifier(idx.name)} (${columns})`;
			});
		}

		// Add foreign key constraints
		if (tableDef.foreignKeys) {
			tableDef.foreignKeys.forEach((fk) => {
				sql += `,\n  FOREIGN KEY ${this.escapeIdentifier(fk.name)} (${this.escapeIdentifier(fk.column)})`;
				sql += ` REFERENCES ${this.escapeIdentifier(fk.referenceTable)} (${this.escapeIdentifier(fk.referenceColumn)})`;

				if (fk.onDelete) {
					sql += ` ON DELETE ${fk.onDelete}`;
				}

				if (fk.onUpdate) {
					sql += ` ON UPDATE ${fk.onUpdate}`;
				}
			});
		}

		// Close the table definition
		sql += '\n)';

		// Add table options
		if (tableDef.options?.charset) {
			sql += ` CHARACTER SET=${tableDef.options.charset}`;
		}

		if (tableDef.options?.collation) {
			sql += ` COLLATE=${tableDef.options.collation}`;
		}

		if (tableDef.options?.engine) {
			sql += ` ENGINE=${tableDef.options.engine}`;
		}

		if (tableDef.description) {
			sql += ` COMMENT=${this.escapeString(tableDef.description)}`;
		}

		sql += ';';

		return sql;
	}

	/**
	 * Maps schema field types to MySQL data types
	 */
	private mapFieldTypeToMySQLType(field: SchemaField): string {
		const hints = field.databaseHints;

		switch (field.type) {
			case 'string':
				if (hints?.maxSize === undefined || hints.maxSize > 65535) {
					return 'TEXT';
				} else if (hints.maxSize > 16383) {
					return 'MEDIUMTEXT';
				} else if (hints.maxSize > 255) {
					return `TEXT`;
				} else {
					return `VARCHAR(${hints.maxSize || 255})`;
				}

			case 'number':
				if (hints?.integer) {
					if (hints?.bits === 64) {
						return 'BIGINT';
					} else if (hints?.bits === 16) {
						return 'SMALLINT';
					} else if (hints?.bits === 8) {
						return 'TINYINT';
					} else {
						return 'INT';
					}
				} else if (
					hints?.precision !== undefined &&
					hints?.scale !== undefined
				) {
					return `DECIMAL(${hints.precision}, ${hints.scale})`;
				} else {
					return 'DOUBLE';
				}

			case 'boolean':
				return 'TINYINT(1)';

			case 'date':
				if (hints?.includeTime) {
					if (hints?.precision !== undefined) {
						return `DATETIME(${hints.precision})`;
					}
					return 'DATETIME';
				} else {
					return 'DATE';
				}

			case 'object':
			case 'array':
				return 'JSON';

			case 'binary':
				if (hints?.maxSize === undefined || hints.maxSize > 65535) {
					return 'LONGBLOB';
				} else if (hints.maxSize > 16383) {
					return 'MEDIUMBLOB';
				} else if (hints.maxSize > 255) {
					return 'BLOB';
				} else {
					return `VARBINARY(${hints.maxSize || 255})`;
				}

			default:
				return 'TEXT';
		}
	}

	/**
	 * Returns the SQL representation of a default value for a field
	 */
	private getDefaultValueSQL(field: SchemaField): string | undefined {
		if (field.defaultValue === undefined) {
			return undefined;
		}

		// Handle common default value patterns
		if (field.type === 'date' && field.defaultValue === 'now') {
			return 'CURRENT_TIMESTAMP';
		}

		if (typeof field.defaultValue === 'string') {
			return this.escapeString(field.defaultValue);
		}

		if (typeof field.defaultValue === 'number') {
			return field.defaultValue.toString();
		}

		if (typeof field.defaultValue === 'boolean') {
			return field.defaultValue ? '1' : '0';
		}

		if (field.defaultValue === null) {
			return 'NULL';
		}

		if (typeof field.defaultValue === 'object') {
			return this.escapeString(JSON.stringify(field.defaultValue));
		}

		return undefined;
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
	toDatabase(field: SchemaField, value: any): any {
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
	fromDatabase(field: SchemaField, value: any): any {
		if (value === null || value === undefined) {
			return null;
		}

		switch (field.type) {
			case 'boolean':
				return Boolean(value);

			case 'number':
				return typeof value === 'string' ? parseFloat(value) : value;

			case 'date':
				// Convert MySQL datetime format to JS Date
				if (typeof value === 'string') {
					return new Date(value.replace(' ', 'T') + 'Z');
				}
				return value;

			case 'array':
			case 'object':
				if (typeof value === 'string') {
					try {
						return JSON.parse(value);
					} catch (e) {
						return value;
					}
				}
				return value;

			default:
				return value;
		}
	}
}
