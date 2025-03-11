/**
 * Database adapter interfaces for mapping schema fields to database structures
 */
import type { SchemaField } from '../../schema/schema.types';
import type { EntitySchemaDefinition } from '../../schema/schema.types';

/**
 * Basic column definition for SQL databases
 */
export interface ColumnDefinition {
	name: string;
	type: string;
	nullable: boolean;
	defaultValue?: any;
	primaryKey?: boolean;
	unique?: boolean;
	autoIncrement?: boolean;
	comment?: string;
}

/**
 * Definition for a database index
 */
export interface IndexDefinition {
	name: string;
	columns: string[];
	unique?: boolean;
	type?: string;
}

/**
 * Definition for a foreign key constraint
 */
export interface ForeignKeyDefinition {
	name: string;
	columns: string[];
	referencedTable: string;
	referencedColumns: string[];
	onDelete?: 'CASCADE' | 'SET NULL' | 'RESTRICT' | 'NO ACTION';
	onUpdate?: 'CASCADE' | 'SET NULL' | 'RESTRICT' | 'NO ACTION';
}

/**
 * Table definition for SQL databases
 */
export interface TableDefinition {
	name: string;
	columns: ColumnDefinition[];
	primaryKey?: string[];
	indexes?: IndexDefinition[];
	foreignKeys?: ForeignKeyDefinition[];
	comment?: string;
}

/**
 * Core database adapter interface
 */
export interface DatabaseAdapter {
	/**
	 * Database type identifier
	 */
	readonly type: string;

	/**
	 * Database name for display purposes
	 */
	readonly displayName: string;

	/**
	 * Map a schema field to a database column definition
	 */
	mapFieldToColumn(
		field: SchemaField,
		fieldName: string,
		entity: EntitySchemaDefinition
	): ColumnDefinition;

	/**
	 * Generate a SQL statement to create a table
	 */
	generateCreateTableSQL(tableDef: TableDefinition): string;

	/**
	 * Transform a value from application format to database format for storage
	 */
	toDatabase(field: SchemaField, value: any): any;

	/**
	 * Transform a value from database format to application format
	 */
	fromDatabase(field: SchemaField, dbValue: any): any;

	/**
	 * Generate a complete table definition from an entity schema
	 */
	generateTableDefinition(entity: EntitySchemaDefinition): TableDefinition;
}
