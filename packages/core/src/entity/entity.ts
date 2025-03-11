import type { StandardSchemaV1 } from '@standard-schema/spec';
import type { DatabaseConfig } from '../config/config.types';
import { mergeSchemaWithConfig } from '../db/merge';
import { generateTable } from '../db/table';
import type { EntitySchemaDefinition } from '../schema/schema.types';
import {
	validateEntity,
	validateEntityWithFieldValidators,
} from '../validation/validate';
import { convertValueToFieldType } from '../validation/type-conversion';
import type {
	EntityFromDefinition,
	EntityStructure,
	EntityWithRelationships,
	SchemaFields,
} from './entity.types';
import { createRelationshipHelpers } from './relationship';
import type { RelationshipHelpers } from './relationship.types';
import { EntityFieldsMap } from '../db/adapters';

// Type alias to prevent circular reference issues
type EntityType<
	TSchema extends EntitySchemaDefinition,
	TValidator extends StandardSchemaV1,
> = EntityFromDefinition<TSchema, TValidator>;

/**
 * Define a new entity with validation and relationships
 * @param schema The entity schema definition
 * @param validator Optional schema validator
 * @param config Optional database configuration
 * @returns The entity definition with methods for validation and relationships
 */
export function defineEntity<
	TSchema extends EntitySchemaDefinition,
	TValidator extends StandardSchemaV1 = StandardSchemaV1,
>(
	schema: TSchema,
	validator?: TValidator,
	config?: DatabaseConfig
): EntityFromDefinition<TSchema, TValidator> {
	// Create the base entity structure
	const baseEntity = {
		name: schema.name,
		prefix: '',
		fields: { ...schema.fields },
		config: {},
		order: 0,
		validator,
		description: schema.description,
	};

	// Create a resolved entity based on configuration if provided
	let resolved: ReturnType<typeof mergeSchemaWithConfig> | undefined;

	function resolveWithConfig(runtimeConfig: DatabaseConfig) {
		if (!resolved) {
			resolved = mergeSchemaWithConfig(baseEntity, runtimeConfig);
		}
		return resolved;
	}

	// Create the entity with explicit type annotation to avoid circular reference
	const entity: EntityType<TSchema, TValidator> = {
		...baseEntity,

		// Validate data against the entity schema
		validate: async <TInput extends StandardSchemaV1.InferInput<TValidator>>(
			data: TInput
		): Promise<EntityFieldsMap<SchemaFields<TSchema>>> => {
			const entityDef =
				resolved || (config ? resolveWithConfig(config) : baseEntity);

			// Use field-level validators when there's no explicit validator
			if (!validator) {
				// When no validator is provided, perform field-level validation with proper typing
				// Pass input data and schema, specifying output type will be EntityFieldsMap<SchemaFields<TSchema>>
				const validatedData = await validateEntityWithFieldValidators<
					Record<string, unknown>, 
					EntityFieldsMap<SchemaFields<TSchema>>
				>(
					data as Record<string, unknown>,
					schema
				);
				
				// Return the validated data with proper type
				return validatedData;
			}

			// When using an explicit validator, validate with the schema first
			const result = await validateEntity(validator, data);
			
			// Ensure the data has correct types based on field definitions
			const typedResult: Record<string, unknown> = {};
			
			// Process any required field conversions
			for (const [fieldName, fieldDef] of Object.entries(schema.fields)) {
				// Include all fields from the validated data if they exist
				if (result && typeof result === 'object' && fieldName in result) {
					const fieldValue = (result as Record<string, unknown>)[fieldName];
					// Apply automated type conversions based on field type
					typedResult[fieldName] = convertValueToFieldType(fieldValue, fieldDef, fieldName);
				}
			}
			
			// Return the result with the correct EntityFieldsMap type
			return typedResult as EntityFieldsMap<SchemaFields<TSchema>>;
		},

		// Type references for TypeScript autocompletion
		type: {} as StandardSchemaV1.InferInput<TValidator>,
		outputType: {} as StandardSchemaV1.InferOutput<TValidator>,

		// Generate a table definition - using any to avoid complex type issues
		getTable: (runtimeConfig?: DatabaseConfig) => {
			// If config is provided, use mergeSchemaWithConfig to properly format the entity
			const entityDef =
				resolved ||
				(runtimeConfig ? resolveWithConfig(runtimeConfig) : undefined);

			// This uses 'any' to bypass the complex type issues while maintaining runtime functionality
			return entityDef ? generateTable(entityDef) : ({} as any);
		},

		// Builder pattern for type-safe relationships
		withRelationships: function <
			TRel extends Record<
				string,
				{ entity: string; field: string; relationship?: any }
			>,
		>(
			relationshipFn: (
				helpers: RelationshipHelpers<EntityType<TSchema, TValidator>>
			) => TRel
		): EntityWithRelationships<EntityType<TSchema, TValidator>, TRel> {
			// Create relationship helpers instance
			const selfEntity = this as unknown as EntityStructure;
			const helpers = createRelationshipHelpers(selfEntity);
			const typedHelpers = helpers as RelationshipHelpers<
				EntityType<TSchema, TValidator>
			>;
			const relationships = relationshipFn(typedHelpers);

			// Create entity with relationships
			return {
				...this,
				relationships,
			} as any; // Using 'any' to bypass complex type issues
		},
	};

	return entity;
}
