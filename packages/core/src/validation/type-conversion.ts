import type { SchemaField } from '../schema/schema.types';

/**
 * Common field types used in the schema system
 */
export type FieldType =
	| 'string'
	| 'number'
	| 'boolean'
	| 'date'
	| 'timestamp'
	| 'uuid'
	| 'id'
	| 'incremental_id'
	| 'json'
	| 'array'
	| string;

/**
 * Map field types to their JavaScript type
 */
export type FieldTypeToValueType<T extends FieldType> =
	T extends 'string' | 'uuid' | 'id' ? string :
	T extends 'number' | 'incremental_id' ? number :
	T extends 'boolean' ? boolean :
	T extends 'date' | 'timestamp' ? Date :
	T extends 'json' ? Record<string, unknown> :
	T extends 'array' ? Array<unknown> :
	unknown;

/**
 * Helper function to convert values to appropriate types based on field definition
 * @param value The value to convert
 * @param fieldDef The field definition
 * @param fieldName The name of the field
 * @returns The converted value with the appropriate type
 */
export function convertValueToFieldType<
	TFieldType extends FieldType = FieldType,
	TValue = FieldTypeToValueType<TFieldType>,
>(
	value: unknown,
	fieldDef: SchemaField<TFieldType, TValue>,
	fieldName: string
): TValue {
	// Handle null explicitly
	if (value === null) {
		return null as TValue;
	}

	// If the field has a custom input transform, use it
	if (fieldDef.transform?.input) {
		return fieldDef.transform.input(value);
	}

	// Handle conversion based on field type
	const fieldType = fieldDef.type;

	// Timestamp/Date fields
	if (
		fieldType === 'date' ||
		fieldType === 'timestamp' ||
		fieldName === 'createdAt' ||
		fieldName === 'updatedAt' ||
		fieldName === 'deletedAt' ||
		fieldName.endsWith('At') ||
		fieldName.endsWith('_at')
	) {
		// Convert to Date if not already
		return (value instanceof Date ? value : new Date(String(value))) as TValue;
	}

	// ID fields - ensure they're strings (except incremental IDs)
	if (
		fieldName === 'id' ||
		fieldDef.primaryKey === true ||
		fieldName.endsWith('Id') ||
		fieldName.endsWith('_id') ||
		fieldType === 'uuid' ||
		fieldType === 'id'
	) {
		// Only convert to string if it's not an incremental ID
		if (fieldType !== 'incremental_id' && fieldType !== 'number') {
			return String(value) as TValue;
		}
	}

	// Number fields
	if (fieldType === 'number' || fieldType === 'incremental_id') {
		// Convert to number if not already
		return (typeof value === 'number' ? value : Number(value)) as TValue;
	}

	// Boolean fields
	if (
		fieldType === 'boolean' ||
		fieldName.startsWith('is') ||
		fieldName.startsWith('has')
	) {
		// Convert to boolean if not already
		return (typeof value === 'boolean' ? value : Boolean(value)) as TValue;
	}

	// For all other cases, return as is
	return value as TValue;
}
