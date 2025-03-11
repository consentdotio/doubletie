/**
 * Example of migrating the consent policy table to the new structure
 * with custom field types
 */
import { z } from 'zod';
import {
	DatabaseConfig,
	SchemaField,
	defineEntity,
	createField as field,
	generateTable,
} from '../src/index';

// Custom field type creators
function idField(options?: Partial<Omit<SchemaField, 'type'>>): SchemaField {
	return field('uuid', {
		required: true,
		validator: z.string().uuid(),
		...options,
	});
}

function timestampField(
	options?: Partial<Omit<SchemaField, 'type'>> & {
		autoCreate?: boolean; // Set to true for createdAt fields
	}
): SchemaField {
	const defaultValue = options?.autoCreate ? new Date() : undefined;

	return field('date', {
		required: true,
		defaultValue,
		transform: {
			input: (value) => value || defaultValue || new Date(),
			output: (value) => (value instanceof Date ? value.toISOString() : value),
		},
		...options,
	});
}

function jsonField(options?: Partial<Omit<SchemaField, 'type'>>): SchemaField {
	return field('json', {
		required: false,
		...options,
	});
}

function stringArrayField(
	options?: Partial<Omit<SchemaField, 'type'>>
): SchemaField {
	return field('array', {
		required: false,
		validator: z.array(z.string()),
		...options,
	});
}

// Define the consent policy schema with custom field types
const consentPolicyEntity = defineEntity({
	name: 'consentPolicy',
	prefix: 'c15_',
	fields: {
		id: idField(),
		name: field('string', { required: true }),
		description: field('string', { required: false }),
		version: field('string', { required: true }),
		active: field('boolean', { required: true, defaultValue: true }),
		effectiveDate: timestampField(),
		expiryDate: timestampField({ required: false }),
		dataCategories: stringArrayField(),
		purposes: stringArrayField(),
		jurisdictions: stringArrayField(),
		metadata: jsonField(),
		createdAt: timestampField({ autoCreate: true }),
		updatedAt: timestampField({
			transform: {
				input: () => new Date(),
			},
		}),
	},
});

// Example database configuration
const dbConfig: DatabaseConfig = {
	tables: {
		consentPolicy: {
			entityName: 'consent_policy',
			entityPrefix: 'c15_',
			fields: {
				// Custom field mapping example
				dataCategories: {
					fieldName: 'data_categories',
					required: true,
				},
				// Add any other overrides
			},
			// Add any additional fields
			additionalFields: {
				createdBy: field('string', { required: false }),
			},
		},
	},
};

// Generate the table with configuration
function getConsentPolicyTable(config: DatabaseConfig = dbConfig) {
	// Use our entity with the provided config
	return consentPolicyEntity.getTable(config);
}

// Usage example
const policyTable = getConsentPolicyTable();
console.log(`Table name: ${policyTable.name}`);

// Generate SQL for the table
const postgreSql = policyTable.getSqlSchema('postgresql');
console.log(postgreSql);

// Example of mapping data to database format
const policyData = {
	id: '123e4567-e89b-12d3-a456-426614174000',
	name: 'Marketing Policy',
	version: '1.0',
	active: true,
	effectiveDate: new Date(),
	dataCategories: ['email', 'name'],
	purposes: ['marketing', 'analytics'],
};

const dbData = policyTable.mapToDb(policyData);
console.log('Mapped to DB:', dbData);
