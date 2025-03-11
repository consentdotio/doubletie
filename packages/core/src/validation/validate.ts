import type { StandardSchemaV1 } from '@standard-schema/spec';
import type { EntitySchemaDefinition } from '../schema/schema.types';
import { convertValueToFieldType } from './type-conversion';

/**
 * Validate entity data using a Standard Schema validator
 * @param schema Standard Schema validator
 * @param data Input data to validate
 * @returns Validated data
 */
export async function validateEntity<T extends StandardSchemaV1>(
	schema: T,
	data: StandardSchemaV1.InferInput<T>
): Promise<StandardSchemaV1.InferOutput<T>> {
	let result = schema['~standard'].validate(data);
	if (result instanceof Promise) result = await result;

	// Check if result has issues property
	if ('issues' in result && result.issues) {
		throw new Error(
			`Validation failed: ${JSON.stringify(result.issues, null, 2)}`
		);
	}

	// Handle result with value property
	if ('value' in result) {
		return result.value as StandardSchemaV1.InferOutput<T>;
	}

	// Fallback
	return data as StandardSchemaV1.InferOutput<T>;
}

/**
 * Validate entity data using field-by-field validation
 * @param data Input data to validate
 * @param entityDef Entity definition with field validators
 * @returns Validated data with proper typing
 */
export async function validateEntityWithFieldValidators<
	TInput extends Record<string, unknown>,
	TOutput extends Record<string, unknown> = TInput
>(
	data: TInput,
	entityDef: EntitySchemaDefinition
): Promise<TOutput> {
	const errors: Array<{ field: string; issues: string }> = [];
	// First create a deep copy of the input data to avoid mutations
	const initialData = { ...data };
	// Then create our output object with the correct expected type
	const validatedData = initialData as unknown as TOutput;

	// Process and validate all fields defined in the entity schema
	for (const [fieldName, fieldDef] of Object.entries(entityDef.fields)) {
		// Check required fields
		if (
			fieldDef.required &&
			(data[fieldName] === undefined || data[fieldName] === null)
		) {
			errors.push({ field: fieldName, issues: 'Field is required' });
			continue;
		}

		// Handle default values for undefined fields
		if (data[fieldName] === undefined && fieldDef.defaultValue !== undefined) {
			// Generate the default value (handle function or direct value)
			const defaultValue = typeof fieldDef.defaultValue === 'function'
				? fieldDef.defaultValue()
				: fieldDef.defaultValue;
			
			// Apply the value with automatic type conversion based on field definition
			validatedData[fieldName as keyof TOutput] = convertValueToFieldType(
				defaultValue, 
				fieldDef, 
				fieldName
			) as any;
			
			continue;
		}

		// Validate fields with schema if the field has a value
		if (fieldDef.validator && data[fieldName] !== undefined) {
			try {
				// Run validation using the field's validator
				const validatedValue = await validateEntity(fieldDef.validator, data[fieldName]);
				
				// Apply the validated value (validation should handle type conversion)
				validatedData[fieldName as keyof TOutput] = validatedValue as any;
			} catch (error: any) {
				errors.push({ field: fieldName, issues: error.message });
			}
		} else if (data[fieldName] !== undefined) {
			// For fields with values but no validator, apply type conversion
			validatedData[fieldName as keyof TOutput] = convertValueToFieldType(
				data[fieldName],
				fieldDef,
				fieldName
			) as any;
		}
	}

	// Throw if validation errors
	if (errors.length > 0) {
		throw new Error(`Validation failed: ${JSON.stringify(errors, null, 2)}`);
	}

	return validatedData;
}

/**
 * Create a Standard Schema compatible validator
 * @param schema Standard Schema validator
 * @returns An object with a validate method
 */
export function createValidator<T extends StandardSchemaV1>(schema: T) {
	return {
		validate: async (data: unknown) => {
			let result = schema['~standard'].validate(data);
			if (result instanceof Promise) result = await result;

			// Check if result has issues property
			if ('issues' in result && result.issues) {
				throw new Error(
					`Validation failed: ${JSON.stringify(result.issues, null, 2)}`
				);
			}

			// Handle result with value property
			if ('value' in result) {
				return result.value as StandardSchemaV1.InferOutput<T>;
			}

			// Fallback
			return data as StandardSchemaV1.InferOutput<T>;
		},
		schema,
	};
}
