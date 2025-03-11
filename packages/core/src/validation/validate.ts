import type { StandardSchemaV1 } from '@standard-schema/spec';
import type { EntitySchemaDefinition } from '../schema/schema.types';

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

	if (result.issues) {
		throw new Error(
			`Validation failed: ${JSON.stringify(result.issues, null, 2)}`
		);
	}

	return result.value as StandardSchemaV1.InferOutput<T>;
}

/**
 * Validate entity data using field-by-field validation
 * @param entityDef Entity definition with field validators
 * @param data Input data to validate
 * @returns Validated data
 */
export async function validateEntityWithFieldValidators(
	entityDef: EntitySchemaDefinition,
	data: Record<string, unknown>
) {
	const errors: Array<{ field: string; issues: string }> = [];

	// Collect validation errors
	for (const [fieldName, fieldDef] of Object.entries(entityDef.fields)) {
		// Check required fields
		if (
			fieldDef.required &&
			(data[fieldName] === undefined || data[fieldName] === null)
		) {
			errors.push({ field: fieldName, issues: 'Field is required' });
		}

		// Validate field with schema if present
		if (fieldDef.validator && data[fieldName] !== undefined) {
			try {
				await validateEntity(fieldDef.validator, data[fieldName]);
			} catch (error: any) {
				errors.push({ field: fieldName, issues: error.message });
			}
		}
	}

	// Throw if validation errors
	if (errors.length > 0) {
		throw new Error(`Validation failed: ${JSON.stringify(errors, null, 2)}`);
	}

	return data;
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

			if (result.issues) {
				throw new Error(
					`Validation failed: ${JSON.stringify(result.issues, null, 2)}`
				);
			}

			return result.value as StandardSchemaV1.InferOutput<T>;
		},
		schema,
	};
}
