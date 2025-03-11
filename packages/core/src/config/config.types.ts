import type { StandardSchemaV1 } from '@standard-schema/spec';
import type { SchemaField } from '../schema/schema.types';

/**
 * Field override configuration options
 */
export interface FieldOverrideConfig {
	fieldName?: string; // Override the field name in the database
	required?: boolean; // Override whether the field is required
	defaultValue?: unknown; // Override the default value
	relationship?: {
		model?: string; // Override the referenced model
		field?: string; // Override the referenced field
	};
	// Validator override
	validator?: StandardSchemaV1;
}

/**
 * Entity override configuration options
 */
export interface EntityOverrideConfig {
	entityName?: string; // Override the entity name
	entityPrefix?: string; // Override the entity prefix
	fields?: Record<string, string | FieldOverrideConfig>; // Field name overrides or full config
	additionalFields?: Record<string, SchemaField>; // Extra fields to add
	expiresIn?: number; // Entity-specific configuration
	updateAge?: number; // Entity-specific configuration
	// Entity validator override
	validator?: StandardSchemaV1;
}

/**
 * Database configuration options
 */
export interface DatabaseConfig {
	tables?: Record<string, EntityOverrideConfig>;
}
