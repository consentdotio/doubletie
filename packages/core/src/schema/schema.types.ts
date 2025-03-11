import type { StandardSchemaV1 } from '@standard-schema/spec';
import type { DatabaseHints } from './fields/field-hints';

/**
 * Represents a field in an entity schema
 */
export interface SchemaField {
	type: 'string' | 'number' | 'boolean' | 'date' | 'uuid' | 'json' | 'array';
	required?: boolean;
	defaultValue?: unknown;
	/**
	 * Relationship to another entity's field
	 * For type-safety, use the withRelationships builder pattern instead of setting this directly
	 */
	relationship?: {
		model: string;
		field: string;
		relationship?: any;
		onDelete?: 'CASCADE' | 'SET NULL' | 'RESTRICT' | 'NO ACTION';
		onUpdate?: 'CASCADE' | 'SET NULL' | 'RESTRICT' | 'NO ACTION';
	};
	// Standard Schema validation
	validator?: StandardSchemaV1;
	// Transform functions for input/output
	transform?: {
		input?: (
			value: unknown,
			data: Record<string, unknown>,
			config?: any
		) => unknown;
		output?: (value: unknown, data: Record<string, unknown>) => unknown;
	};
	// Whether this field is the primary key (or part of a composite primary key)
	primaryKey?: boolean;
	// Database-specific hints for adapters
	databaseHints?: DatabaseHints;
	// Field description
	description?: string;
}

/**
 * Entity schema definition
 */
export interface EntitySchemaDefinition {
	name: string;
	prefix?: string;
	fields: Record<string, SchemaField>;
	config?: Record<string, unknown>;
	order?: number;
	// Add Standard Schema for the entire entity
	validator?: StandardSchemaV1;
	// Entity description
	description?: string;
}

/**
 * A field with resolved configuration
 */
export type ResolvedField = SchemaField & {
	fieldName: string;
};
