import type {
	DatabaseConfig,
	EntityOverrideConfig,
} from '../config/config.types';
import type { EntitySchemaDefinition } from '../schema/schema.types';
import type { ResolvedField, SchemaField } from '../schema/schema.types';

/**
 * Resolved entity schema with merged config
 */
export type ResolvedEntitySchema<T extends EntitySchemaDefinition> = {
	entityName: string;
	entityPrefix: string;
	fields: Record<string, ResolvedField>;
	order?: number;
	validator?: T['validator'];
};

/**
 * Merge a schema definition with database configuration
 * @param baseSchema The base schema to merge
 * @param config The database configuration to apply
 * @returns A resolved entity schema with merged config
 */
export function mergeSchemaWithConfig<T extends EntitySchemaDefinition>(
	baseSchema: T,
	config: DatabaseConfig
): ResolvedEntitySchema<T> {
	// Find entity override from config tables
	const entityConfig = config.tables?.[baseSchema.name];

	return {
		entityName: entityConfig?.entityName || baseSchema.name,
		entityPrefix: entityConfig?.entityPrefix || baseSchema.prefix || '',
		order: baseSchema.order || 0,
		validator: baseSchema.validator,
		fields: mergeFields(baseSchema.fields, entityConfig, config),
	};
}

/**
 * Merge base schema fields with configuration overrides
 * @param baseFields Base schema fields
 * @param entityConfig Entity config overrides
 * @param fullConfig Full database config
 * @returns Merged field definitions
 */
function mergeFields(
	baseFields: Record<string, SchemaField>,
	entityConfig?: EntityOverrideConfig,
	fullConfig?: DatabaseConfig
): Record<string, ResolvedField> {
	const result: Record<string, ResolvedField> = {};

	// Process base fields and apply any overrides
	for (const [fieldName, fieldDef] of Object.entries(baseFields)) {
		const override = entityConfig?.fields?.[fieldName];
		const fieldOverride =
			typeof override === 'string' ? { fieldName: override } : override;

		// Set field with overrides
		result[fieldName] = {
			...fieldDef,
			fieldName: fieldOverride?.fieldName || fieldName,
			required:
				fieldOverride?.required !== undefined
					? fieldOverride.required
					: fieldDef.required,
			defaultValue:
				fieldOverride?.defaultValue !== undefined
					? fieldOverride.defaultValue
					: fieldDef.defaultValue,
			relationship:
				fieldDef.relationship && fieldOverride?.relationship
					? {
							...fieldDef.relationship,
							model:
								fieldOverride.relationship?.model ||
								fieldDef.relationship.model,
							field:
								fieldOverride.relationship?.field ||
								fieldDef.relationship.field,
						}
					: fieldDef.relationship,
			validator: fieldDef.validator,
		};

		// Handle transforms that might depend on config values
		if (
			fieldDef.transform?.input &&
			typeof fieldDef.transform.input === 'function'
		) {
			result[fieldName].transform = {
				...fieldDef.transform,
				input: (val: unknown, data: Record<string, unknown>) => {
					// Pass config values to transform functions
					return fieldDef.transform!.input!(val, data, entityConfig);
				},
			};
		}
	}

	// Add additional fields from config
	if (entityConfig?.additionalFields) {
		for (const [fieldName, fieldDef] of Object.entries(
			entityConfig.additionalFields
		)) {
			result[fieldName] = {
				...fieldDef,
				fieldName: fieldName,
			};
		}
	}

	return result;
}
