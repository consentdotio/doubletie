/**
 * Database adapter interfaces for mapping schema fields to database structures
 */
import { StandardSchemaV1 } from '@standard-schema/spec';
import type { SchemaField } from '../../schema/schema.types';

/**
 * Represents a database column definition
 */
export interface ColumnDefinition<TColumnType extends string = string> {
	/**
	 * Column name
	 */
	name: string;

	/**
	 * Data type
	 */
	type: string;

	/**
	 * Whether the column can contain null values
	 */
	nullable?: boolean;

	/**
	 * Whether the column is a primary key
	 */
	primaryKey?: boolean;

	/**
	 * Whether the column has a unique constraint
	 */
	unique?: boolean;

	/**
	 * Whether the column auto-increments
	 * (specific implementation depends on the database)
	 */
	autoIncrement?: boolean;

	/**
	 * Default value expression
	 */
	defaultValue?: any;

	/**
	 * Whether this is a generated column
	 */
	generated?: boolean;

	/**
	 * Column expression for generated columns
	 */
	generatedExpression?: string;

	/**
	 * Relationship information
	 * Used to be populated during schema resolution
	 */
	relationship?: any;
}

/**
 * Represents a database table index definition
 */
export interface IndexDefinition {
	/**
	 * Index name
	 */
	name: string;

	/**
	 * Columns included in the index
	 */
	columns: string[];

	/**
	 * Whether this is a unique index
	 */
	unique?: boolean;
}

/**
 * Represents a primary key constraint
 */
export interface PrimaryKeyDefinition<TPrimaryKeyType extends string = string> {
	/**
	 * Constraint name
	 */
	name: string;

	/**
	 * Columns included in the primary key
	 */
	columns: string[];
}

/**
 * Represents a foreign key constraint
 */
export interface ForeignKeyDefinition<TOnAction extends string = string> {
	/**
	 * Constraint name
	 */
	name: string;

	/**
	 * Columns that reference another table
	 */
	columns: string[];

	/**
	 * Table being referenced
	 */
	referencedTable: string;

	/**
	 * Columns being referenced
	 */
	referencedColumns: string[];

	/**
	 * Action to take when referenced row is deleted
	 */
	onDelete?: TOnAction;

	/**
	 * Action to take when referenced row is updated
	 */
	onUpdate?: TOnAction;
}

/**
 * Represents a database table definition
 */
export interface TableDefinition<
	TTableOptions extends Record<string, any> = {},
	TColumnType extends string = string,
	TPrimaryKeyType extends string = string,
	TOnAction extends string = string,
> {
	/**
	 * Table name
	 */
	name: string;

	/**
	 * Column definitions
	 */
	columns: ColumnDefinition<TColumnType>[];

	/**
	 * Primary key constraint
	 */
	primaryKey?: PrimaryKeyDefinition<TPrimaryKeyType>;

	/**
	 * Foreign key constraints
	 */
	foreignKeys?: ForeignKeyDefinition<TOnAction>[];

	/**
	 * Index definitions
	 */
	indexes?: IndexDefinition[];

	/**
	 * Database-specific table options
	 */
	options?: TTableOptions;
}

/**
 * Base type mapping for common field types
 * This is only used as a fallback when we can't infer the type from validators or defaultValue
 */
export type BaseFieldTypeMap = {
	string: string;
	number: number;
	boolean: boolean;
	date: Date;
	timestamp: Date;
	array: unknown[];
	object: Record<string, unknown>;
	json: Record<string, unknown>;
	[key: string]: unknown;
};

/**
 * Extract the output type from a Zod validator if it exists on the field
 */
type ExtractZodType<T> = 
	T extends { validator: infer V } ? 
		V extends { _output: infer O } ? O :
		V extends { _type: infer O } ? O :
		unknown :
	unknown;

/**
 * Extract the return type of a default value function
 */
type ExtractDefaultType<T> = 
	T extends { defaultValue: infer D } ?
		D extends (() => infer R) ? R :
		D :
	unknown;

/**
 * Infer the field type based on all available information in the field definition
 * Prioritizes explicit TValueType, then validator output, then defaults
 */
export type InferFieldType<T extends SchemaField<any, any>> = 
	// First check if we have an explicit TValueType (from the enhanced createField)
	T extends SchemaField<any, infer V> ?
		V extends unknown ? (
			// If V is unknown (not specified), try other means of inference
			ExtractZodType<T> extends unknown ? 
				ExtractDefaultType<T> extends unknown ?
					// Fall back to field type string hint
					T extends { type: infer FT } ? 
						FT extends keyof BaseFieldTypeMap ? BaseFieldTypeMap[FT & keyof BaseFieldTypeMap] : 
						FT extends 'email' | 'url' | 'slug' | 'phone' | 'uuid' ? string :
						FT extends `${string}_id` ? string :
						FT extends 'incremental_id' ? number :
						unknown :
					unknown :
				ExtractDefaultType<T> :
			ExtractZodType<T>
		) : 
		// If V is a specific type (not unknown), use it
		V :
	unknown;

/**
 * Extract type based on field name when type can't be inferred from the field definition
 */
type InferTypeFromFieldName<K extends string> =
	// ID fields
	K extends 'id' | `${string}Id` | `${string}_id` ? string :
	// Timestamp fields
	K extends 'createdAt' | 'updatedAt' | 'deletedAt' | `${string}At` | `${string}_at` ? Date :
	// Boolean flags
	K extends `is${string}` | `has${string}` | `${string}Flag` ? boolean :
	// Count fields
	K extends `${string}Count` | `${string}Total` ? number :
	// Default to unknown
	unknown;

/**
 * Enhanced field type extraction that considers both the field name and definition 
 * to provide better type inference
 */
export type ExtractFieldType<K extends string, T extends SchemaField<any, any>> =
	// First check if we have an explicit TValueType
	T extends SchemaField<any, infer V> ?
		V extends unknown ? (
			// If no explicit type, try to infer from field definition
			InferFieldType<T> extends unknown ? 
				// If that fails, use field name as a hint
				InferTypeFromFieldName<K> extends unknown ?
					// Last resort - check primaryKey to infer ID fields
					T extends { primaryKey: true } ? string :
					unknown :
				InferTypeFromFieldName<K> :
			InferFieldType<T>
		) : 
		// If we have an explicit type, use it
		V :
	unknown; 

/**
 * Extracts TypeScript types from schema fields
 * Uses a multi-stage approach for best type inference
 */
export type EntityFieldsMap<
	TFields extends Record<string, SchemaField<any, any>> = Record<string, SchemaField<any, any>>,
> = {
	[K in keyof TFields]: ExtractFieldType<K & string, TFields[K]>;
};

/**
 * Interface for database adapters
 *
 * This defines the contract for how the core schema types map
 * to database-specific implementations.
 */
export interface DatabaseAdapter<TColumnType extends string = string> {
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
	mapFieldToColumn<
		TFieldType extends string = string,
		TColumnType extends string = string,
	>(
		field: SchemaField<TFieldType>,
		fieldName: string,
		entity: EntitySchemaDefinition
	): ColumnDefinition<TColumnType>;

	/**
	 * Generate a table definition from an entity schema
	 */
	generateTableDefinition<
		TTableOptions extends Record<string, any> = {},
		TColumnType extends string = string,
		TPrimaryKeyType extends string = string,
		TOnAction extends string = string,
	>(
		entity: EntitySchemaDefinition
	): TableDefinition<TTableOptions, TColumnType, TPrimaryKeyType, TOnAction>;

	/**
	 * Generate a SQL statement to create a table
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
	): string;

	/**
	 * Transform a value from application format to database format
	 */
	toDatabase(value: any, field: SchemaField): any;

	/**
	 * Transform a value from database format to application format
	 */
	fromDatabase(dbValue: any, field: SchemaField): any;
}

/**
 * Improved entity schema definition
 * @template TEntityName The entity name
 * @template TFields The entity fields
 */
export interface EntitySchemaDefinition<
	TEntityName extends string = string,
	TFields extends Record<string, SchemaField<any>> = Record<
		string,
		SchemaField<any>
	>,
> {
	name: TEntityName;
	prefix?: string;
	fields: TFields;
	config?: Record<string, unknown>;
	order?: number;
	validator?: StandardSchemaV1;
	description?: string;
}
