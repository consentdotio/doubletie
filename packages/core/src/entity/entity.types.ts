import type { StandardSchemaV1 } from '@standard-schema/spec';
import type { DatabaseConfig } from '../config/config.types';
import type { TableDefinition, EntityFieldsMap } from '../db/adapters/adapter';
import type { SchemaField } from '../schema/schema.types';
import type { EntitySchemaDefinition } from '../schema/schema.types';
import type {
	EntityFieldReference,
	RelationshipConfig,
	RelationshipHelpers,
	RelationshipType,
} from './relationship.types';

/**
 * Extract all field names from an entity with their types
 * @template TEntity The entity type to extract fields from
 * @template TFieldType Optional field type filter
 */
export type EntityFields<
	TEntity extends { fields: Record<string, SchemaField<any>> },
	TFieldType extends string = string,
> = {
	[K in keyof TEntity['fields'] &
		string]: TEntity['fields'][K]['type'] extends TFieldType ? K : never;
}[keyof TEntity['fields'] & string];

/**
 * Extract the value type for a given field
 * @template TEntity The entity containing fields
 * @template TFieldName The name of the field to get the type for
 */
export type EntityFieldValue<
	TEntity extends { fields: Record<string, SchemaField<any>> },
	TFieldName extends keyof TEntity['fields'] & string,
> = TEntity['fields'][TFieldName] extends SchemaField<infer TType, infer TValue>
	? TValue
	: unknown;

/**
 * Type to represent the structure of an entity
 * @template TName The entity name type
 * @template TFields The entity fields record type
 */
export interface EntityStructure<
	TName extends string = string,
	TFields extends Record<string, SchemaField<any>> = Record<
		string,
		SchemaField<any>
	>,
> {
	name: TName;
	fields: TFields;
	description?: string;
}

/**
 * Type-safe relationship reference - alias for EntityFieldReference for backward compatibility
 * @template TEntity Target entity type
 * @template TFieldName Field name in target entity
 */
export type TypedRelationshipReference<
	TEntity extends EntityStructure,
	TFieldName extends keyof TEntity['fields'] &
		string = keyof TEntity['fields'] & string,
> = EntityFieldReference<EntityStructure, TEntity, TFieldName>;

/**
 * Entity result type after applying relationships
 * @template TEntity The base entity type
 * @template TRelationships Record of relationship references
 */
export type EntityWithRelationships<
	TEntity extends EntityStructure,
	TRelationships extends Record<string, TypedRelationshipReference<any>>,
> = TEntity & {
	relationships: TRelationships;
};

/**
 * Extracts the name type from a schema definition
 */
export type SchemaName<TSchema extends EntitySchemaDefinition> =
	TSchema['name'] extends string ? TSchema['name'] : string;

/**
 * Extracts the fields type from a schema definition
 */
export type SchemaFields<TSchema extends EntitySchemaDefinition> =
	TSchema['fields'] extends Record<string, SchemaField<any>>
		? TSchema['fields']
		: Record<string, SchemaField<any>>;

/**
 * Get the full entity type from a schema definition
 * @template TSchema The schema definition type
 * @template TValidator Validator schema type
 */
export interface EntityFromDefinition<
	TSchema extends EntitySchemaDefinition = EntitySchemaDefinition,
	TValidator extends StandardSchemaV1 = StandardSchemaV1,
> extends EntityStructure<SchemaName<TSchema>, SchemaFields<TSchema>> {
	name: SchemaName<TSchema>;
	prefix: string;
	fields: SchemaFields<TSchema>;
	config: Record<string, unknown>;
	order: number;
	validator?: TValidator;

	// Type-safe validation method that properly infers types from field definitions
	validate: <TInput extends StandardSchemaV1.InferInput<TValidator>>(
		data: TInput
	) => Promise<
		EntityFieldsMap<SchemaFields<TSchema>> 
	>;

	// Type references for input/output
	type: StandardSchemaV1.InferInput<TValidator>;
	outputType: StandardSchemaV1.InferOutput<TValidator>;

	// Type-safe table generation
	getTable: <TOptions extends Record<string, any> = {}>(
		config?: DatabaseConfig
	) => TableDefinition<TOptions>;

	// Type-safe relationship builder
	withRelationships: <
		TRel extends Record<string, TypedRelationshipReference<any>>,
	>(
		relationshipFn: (
			helpers: RelationshipHelpers<EntityFromDefinition<TSchema, TValidator>>
		) => TRel
	) => EntityWithRelationships<EntityFromDefinition<TSchema, TValidator>, TRel>;
}

/**
 * Helper type to infer input type from an entity with improved type safety
 * @template TEntity Entity with validate method
 */
export type EntityInput<
	TEntity extends {
		validate: (data: any) => any;
		fields: Record<string, SchemaField<any>>;
	},
> = Parameters<TEntity['validate']>[0];

/**
 * Helper type to infer output type from an entity with improved type safety
 * @template TEntity Entity with validate method
 */
export type EntityOutput<
	TEntity extends {
		validate: (data: any) => Promise<any>;
		fields: Record<string, SchemaField<any>>;
	},
> = Awaited<ReturnType<TEntity['validate']>>;

/**
 * Type to get keys of an entity's fields that match a specific field type
 * @template TEntity The entity to extract fields from
 * @template TFieldType The field type to filter by
 */
export type EntityFieldsByType<
	TEntity extends EntityStructure,
	TFieldType extends string,
> = Extract<keyof TEntity['fields'], EntityFields<TEntity, TFieldType>>;

/**
 * Helper type to infer an entity's relationship capabilities
 * @template TEntity The base entity type
 */
export type WithRelationships<TEntity extends EntityStructure> = TEntity & {
	withRelationships: <
		TRel extends Record<string, TypedRelationshipReference<EntityStructure>>,
	>(
		relationshipFn: (
			helpers: RelationshipHelpers<TEntity | EntityStructure>
		) => TRel
	) => EntityWithRelationships<TEntity, TRel>;
};

/**
 * Extract all the fields from an entity that have a specific property
 * @template TEntity The entity to extract fields from
 * @template TProp The property name to check for
 */
export type EntityFieldsWithProperty<
	TEntity extends EntityStructure,
	TProp extends keyof SchemaField<any>,
> = {
	[K in keyof TEntity['fields'] &
		string]: TProp extends keyof TEntity['fields'][K] ? K : never;
}[keyof TEntity['fields'] & string];

/**
 * Get primary key fields from an entity
 * @template TEntity The entity to extract primary key fields from
 */
export type EntityPrimaryKeys<TEntity extends EntityStructure> =
	EntityFieldsWithProperty<TEntity, 'primaryKey'>;

/**
 * Get required fields from an entity
 * @template TEntity The entity to extract required fields from
 */
export type EntityRequiredFields<TEntity extends EntityStructure> = {
	[K in keyof TEntity['fields'] &
		string]: TEntity['fields'][K]['required'] extends true ? K : never;
}[keyof TEntity['fields'] & string];

/**
 * Create a type-safe input object for an entity
 * @template TEntity The entity to create input type for
 */
export type TypedEntityInput<TEntity extends EntityStructure> = {
	[K in EntityRequiredFields<TEntity>]: EntityFieldValue<TEntity, K>;
} & {
	[K in Exclude<
		keyof TEntity['fields'] & string,
		EntityRequiredFields<TEntity>
	>]?: EntityFieldValue<TEntity, K>;
};
