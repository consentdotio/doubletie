import type { SchemaField } from '../schema/schema.types';

/**
 * Helper function to convert values to appropriate types based on field definition
 * @param value The value to convert
 * @param fieldDef The field definition
 * @param fieldName The name of the field
 * @returns The converted value with the appropriate type
 */
export function convertValueToFieldType(
	value: unknown, 
	fieldDef: SchemaField<any, any>, 
	fieldName: string
): unknown {
	// Handle null explicitly
	if (value === null) {
		return null;
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
		return value instanceof Date ? value : new Date(value as any);
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
			return String(value);
		}
	}
	
	// Number fields
	if (fieldType === 'number' || fieldType === 'incremental_id') {
		// Convert to number if not already
		return typeof value === 'number' ? value : Number(value);
	}
	
	// Boolean fields
	if (
		fieldType === 'boolean' || 
		fieldName.startsWith('is') || 
		fieldName.startsWith('has')
	) {
		// Convert to boolean if not already
		return typeof value === 'boolean' ? value : Boolean(value);
	}
	
	// For all other cases, return as is
	return value;
} 