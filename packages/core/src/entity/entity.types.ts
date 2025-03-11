import type { StandardSchemaV1 } from '@standard-schema/spec';
import type { DatabaseConfig } from '../config/config.types';
import type { SchemaField } from '../schema/schema.types';
import type {
	EntityFieldReference,
	RelationshipConfig,
	RelationshipHelpers,
} from './relationship.types';

/**
 * Extract all field names from an entity
 */
export type EntityFields<E extends { fields: Record<string, any> }> =
	keyof E['fields'];

/**
 * Type to represent the structure of an entity
 */
export type EntityStructure<
	Name extends string = string,
	Fields extends Record<string, SchemaField> = Record<string, SchemaField>,
> = {
	name: Name;
	fields: Fields;
};

/**
 * Entity result type after applying relationships
 */
export type EntityWithRelationships<
	E extends EntityStructure,
	R extends Record<string, EntityFieldReference<any, any>>,
> = E & {
	relationships: R;
};

/**
 * Get the full entity type from a schema definition
 */
export type EntityFromDefinition<T extends any, V extends StandardSchemaV1> = {
	name: T['name'];
	prefix: string;
	fields: T['fields'];
	config: Record<string, unknown>;
	order: number;
	validator?: V;
	validate: (data: unknown) => Promise<unknown>;
	type: StandardSchemaV1.InferInput<V>;
	outputType: StandardSchemaV1.InferOutput<V>;
	getTable: (config?: any) => any;
	withRelationships: <R extends Record<string, EntityFieldReference<any, any>>>(
		relationshipFn: (helpers: RelationshipHelpers) => R
	) => EntityWithRelationships<EntityFromDefinition<T, V>, R>;
};

/**
 * Helper type to infer input type from an entity
 */
export type EntityInput<T extends { validate: (data: any) => any }> =
	Parameters<T['validate']>[0];

/**
 * Helper type to infer output type from an entity
 */
export type EntityOutput<T extends { validate: (data: any) => Promise<any> }> =
	Awaited<ReturnType<T['validate']>>;

/**
 * Helper type to infer an entity's relationship capabilities
 */
export type WithRelationships<T> = T & {
	withRelationships: <
		R extends Record<
			string,
			{
				model: string;
				field: string;
				relationship?: RelationshipConfig<any, any>;
			}
		>,
	>(
		relationshipFn: (helpers: RelationshipHelpers) => R
	) => T & { relationships: R };
};
