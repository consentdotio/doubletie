import type { StandardSchemaV1 } from '@standard-schema/spec';
import type { EntityFieldReference } from '../entity/relationship.types';
import type { DatabaseHints } from './fields/field-hints';

/**
 * Represents a field in an entity schema
 * @template TFieldType The type of field (string, number, etc.)
 * @template TValueType The JavaScript type that this field represents
 * @template TValidatorType The validator type
 */
export interface SchemaField<
	TFieldType extends string = string,
	TValueType = unknown,
	TValidatorType extends StandardSchemaV1 = StandardSchemaV1,
> {
	type: TFieldType;
	required?: boolean;
	defaultValue?: TValueType | (() => TValueType);
	/**
	 * Relationship to another entity's field
	 * For type-safety, use the withRelationships builder pattern instead of setting this directly
	 */
	relationship?: {
		entity: string;
		field: string;
		relationship?: any;
	};
	// Standard Schema validation
	validator?: TValidatorType;
	// Transform functions for input/output
	transform?: {
		input?: (value: unknown) => TValueType;
		output?: <T extends TValueType>(value: T) => unknown;
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
	fields: Record<string, SchemaField<string>>;
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
export type ResolvedField = SchemaField<string> & {
	fieldName: string;
};
