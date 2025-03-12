import type { StandardSchemaV1 } from '@standard-schema/spec';
import type { EntityFromDefinition } from '../entity/entity.types';
import type {
	EntitySchemaDefinition,
	FieldValueType,
} from '../schema/schema.types';

/**
 * Convert EntityFromDefinition to EntitySchemaDefinition
 * This is needed for compatibility with database adapters
 */
export function toEntitySchemaDefinition<T extends EntityFromDefinition>(
	entity: T
): EntitySchemaDefinition {
	return {
		name: entity.name,
		prefix: entity.prefix,
		fields: entity.fields,
		config: entity.config as Record<string, FieldValueType>,
		order: entity.order,
		validator: entity.validator as StandardSchemaV1 | undefined,
		description: entity.description as string | undefined,
	};
}
