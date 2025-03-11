import type { StandardSchemaV1 } from '@standard-schema/spec';
import type { DatabaseConfig } from '../config/config.types';
import { mergeSchemaWithConfig } from '../db/merge';
import { generateTable } from '../db/table';
import type { EntitySchemaDefinition } from '../schema/schema.types';
import {
	validateEntity,
	validateEntityWithFieldValidators,
} from '../validation/validate';
import type {
	EntityFieldReference,
	EntityFields,
	EntityFromDefinition,
	EntityStructure,
	EntityWithRelationships,
	WithRelationships,
} from './entity.types';
import { createRelationshipHelpers } from './relationship';
import {
	RelationshipHelpers,
	ValidateRelationships,
} from './relationship.types';

/**
 * Define an entity with fields and optional validation schema
 * @param schema The entity schema definition
 * @param validator Optional Standard Schema validation
 * @param config Optional database configuration
 * @returns The entity definition with methods for validation and relationships
 */
export function defineEntity<
	T extends EntitySchemaDefinition,
	V extends StandardSchemaV1,
>(
	schema: T,
	validator?: V,
	config?: DatabaseConfig
): EntityFromDefinition<T, V> {
	// Create the base entity with schema fields
	const baseEntity = {
		name: schema.name,
		prefix: '',
		fields: { ...schema.fields },
		config: {},
		order: 0,
		validator,
	};

	function resolveWithConfig(runtimeConfig: DatabaseConfig) {
		return mergeSchemaWithConfig(baseEntity, runtimeConfig);
	}

	// Pre-resolve if config provided
	const resolved = config ? resolveWithConfig(config) : undefined;

	// Create the entity object with all its methods
	const entity = {
		...baseEntity,
		resolved,
		resolveWithConfig,

		// Validate using Standard Schema
		validate: async (data: StandardSchemaV1.InferInput<V>) => {
			if (validator) {
				return await validateEntity(validator, data);
			} else if (baseEntity.validator) {
				return await validateEntity(baseEntity.validator, data);
			} else {
				// Fall back to field-by-field validation
				return await validateEntityWithFieldValidators(
					baseEntity,
					data as Record<string, unknown>
				);
			}
		},

		// Type helpers
		type: {} as StandardSchemaV1.InferInput<V>,
		outputType: {} as StandardSchemaV1.InferOutput<V>,

		// Table generation
		getTable: (runtimeConfig?: DatabaseConfig) => {
			const entityDef =
				resolved ||
				(runtimeConfig ? resolveWithConfig(runtimeConfig) : baseEntity);
			return generateTable(entityDef as any);
		},

		// Builder pattern for type-safe relationships
		withRelationships<R extends Record<string, EntityFieldReference<any, any>>>(
			relationshipFn: (helpers: RelationshipHelpers) => R
		): EntityWithRelationships<EntityFromDefinition<T, V>, R> {
			// Calculate entity structure type for validation
			type ThisEntityStructure = EntityStructure<T['name'], T['fields']>;

			// Static type validation of relationships
			type ValidatedRels = ValidateRelationships<ThisEntityStructure, R>;

			// Ensure ValidatedRels doesn't contain any 'never' types
			// This will cause a compile error if invalid relationships are detected
			type _EnsureValidRelationships = [ValidatedRels] extends [R]
				? true
				: false;

			// Create relationship helpers
			const helpers = createRelationshipHelpers<ThisEntityStructure>(
				entity as ThisEntityStructure
			);

			// Apply relationships with type checking
			const relationships = relationshipFn(helpers);

			// Update fields with relationships
			for (const [fieldName, relationship] of Object.entries(relationships)) {
				if (entity.fields[fieldName]) {
					entity.fields[fieldName].relationship = relationship;
				} else {
					throw new Error(
						`Relationship Error: Cannot add relationship to non-existent field '${fieldName}' in entity '${entity.name}'.` +
							` Available fields: ${Object.keys(entity.fields).join(', ')}`
					);
				}
			}

			// Return new entity with relationships
			return {
				...entity,
				relationships,
			} as EntityWithRelationships<EntityFromDefinition<T, V>, R>;
		},
	};

	return entity as EntityFromDefinition<T, V>;
}
