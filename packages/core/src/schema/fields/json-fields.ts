/**
 * JSON field utilities for entity schema definitions
 */
import { z } from 'zod';
import { SchemaField } from '../schema.types';
import { createField } from './basic-fields';
import { DatabaseHints } from './field-hints';

export interface JsonFieldOptions extends Partial<Omit<SchemaField, 'type'>> {
	/**
	 * Zod schema for validating the JSON structure
	 */
	schema?: z.ZodType<any>;
}

/**
 * Creates a JSON field with optional schema validation
 *
 * @param options Configuration options for the JSON field
 * @returns A schema field configured for JSON data
 *
 * @example
 * // Basic JSON field
 * jsonField()
 *
 * @example
 * // JSON field with schema validation
 * jsonField({
 *   schema: z.object({
 *     name: z.string(),
 *     age: z.number()
 *   })
 * })
 */
export function jsonField(options?: JsonFieldOptions): SchemaField {
	const { schema, ...rest } = options || {};

	// Create validator based on provided schema
	let validator;
	if (schema) {
		validator = z.preprocess((data) => {
			// Handle JSON strings by parsing them
			if (typeof data === 'string') {
				try {
					return JSON.parse(data);
				} catch (e) {
					return data; // Let zod handle the validation error
				}
			}
			return data;
		}, schema);
	} else {
		// Default validator just ensures it's a valid object or array
		validator = z.preprocess(
			(data) => {
				if (typeof data === 'string') {
					try {
						return JSON.parse(data);
					} catch (e) {
						return data;
					}
				}
				return data;
			},
			z.union([z.object({}).passthrough(), z.array(z.any())])
		);
	}

	// Transform functions to handle serialization/deserialization
	const inputTransform = (value: unknown) => {
		if (typeof value === 'string') {
			try {
				return JSON.parse(value);
			} catch (e) {
				return value; // Let validation handle the error
			}
		}
		return value;
	};

	const outputTransform = (value: unknown) => {
		if (value === null || value === undefined) {
			return value;
		}
		// Ensure the value is stringified if it's an object or array
		if (typeof value === 'object') {
			return JSON.stringify(value);
		}
		return value;
	};

	return createField('json', {
		validator,
		transform: {
			input: inputTransform,
			output: outputTransform,
		},
		...rest,
	});
}

/**
 * Creates a metadata field for storing flexible entity metadata
 *
 * @param options Additional options for the metadata field
 * @returns A schema field configured for metadata
 *
 * @example
 * // Basic metadata field
 * metadataField()
 */
export function metadataField(
	options?: Omit<JsonFieldOptions, 'schema'>
): SchemaField {
	return jsonField({
		required: false,
		defaultValue: {},
		...options,
	});
}

/**
 * Creates a settings field for storing configuration settings
 *
 * @param schema Optional schema for validating settings
 * @param options Additional options for the settings field
 * @returns A schema field configured for settings
 *
 * @example
 * // Settings field with schema
 * settingsField(z.object({
 *   theme: z.enum(['light', 'dark']),
 *   notifications: z.boolean()
 * }))
 */
export function settingsField(
	schema?: z.ZodType<any>,
	options?: Omit<JsonFieldOptions, 'schema'>
): SchemaField {
	return jsonField({
		schema,
		required: false,
		defaultValue: {},
		...options,
	});
}
