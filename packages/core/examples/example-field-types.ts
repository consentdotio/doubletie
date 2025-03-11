import { z } from 'zod';
/**
 * Example demonstrating all the specialized field types
 */
import {
	// Timestamp fields
	createdAtField,
	defineEntity,
	deletedAtField,
	emailField,
	// JSON fields
	jsonField,
	metadataField,
	phoneField,
	prefixedIdField,
	refArrayField,
	settingsField,
	slugField,
	// Array fields
	stringArrayField,
	// String fields
	stringField,
	timezoneField,
	updatedAtField,
	urlField,
	// ID fields
	uuidField,
} from '../src/index';

// User entity with various field types
const userEntity = defineEntity({
	name: 'user',
	fields: {
		// ID field using UUID
		id: uuidField(),

		// Basic string fields with validation
		username: stringField({
			minLength: 3,
			maxLength: 20,
			pattern: /^[a-z0-9_]+$/,
			required: true,
		}),
		name: stringField({ required: true }),

		// Email field with validation
		email: emailField({ required: true }),

		// Website URL
		website: urlField(),

		// User profile slug for URLs
		slug: slugField({ required: true }),

		// Contact information
		phone: phoneField(),

		// User's preferred timezone
		timezone: timezoneField({ defaultValue: 'UTC' }),

		// User preferences as JSON with schema validation
		preferences: settingsField(
			z.object({
				theme: z.enum(['light', 'dark', 'system']).default('system'),
				notifications: z.boolean().default(true),
				language: z.string().default('en'),
			})
		),

		// Flexible metadata for extending the user entity
		metadata: metadataField(),

		// Tags/categories for the user
		tags: stringArrayField({ uniqueItems: true }),

		// References to other entities
		roleIds: refArrayField({ minItems: 1 }),

		// Audit timestamps
		createdAt: createdAtField(),
		updatedAt: updatedAtField(),
		deletedAt: deletedAtField(),
	},
});

// Organization entity with prefixed IDs
const orgEntity = defineEntity({
	name: 'organization',
	fields: {
		// Prefixed ID like "org_abc123"
		id: prefixedIdField('org_', { length: 10 }),

		name: stringField({ required: true }),
		description: stringField(),

		// Domain information with schema validation
		domains: jsonField({
			schema: z.array(
				z.object({
					domain: z.string(),
					verified: z.boolean().default(false),
					primary: z.boolean().default(false),
				})
			),
		}),

		// Audit timestamps
		createdAt: createdAtField(),
		updatedAt: updatedAtField(),
	},
});

// Usage demonstration
async function demonstrateFieldTypes() {
	try {
		// Create a user with the specialized fields
		const user = await userEntity.validate({
			username: 'johndoe',
			name: 'John Doe',
			email: 'john@example.com',
			website: 'https://example.com/john',
			slug: 'john-doe',
			phone: '+12125551234',
			timezone: 'America/New_York',
			preferences: {
				theme: 'dark',
				notifications: true,
				language: 'en-US',
			},
			metadata: {
				signupSource: 'website',
				lastLoginIp: '192.168.1.1',
			},
			tags: ['developer', 'admin'],
			roleIds: ['role_123', 'role_456'],
		});

		console.log('Validated user:', user);

		// All timestamps should be auto-populated
		console.log('Created at:', user.createdAt);
		console.log('Updated at:', user.updatedAt);

		// Create an organization
		const org = await orgEntity.validate({
			name: 'Acme Inc',
			description: 'A fictional company',
			domains: [
				{ domain: 'acme.com', verified: true, primary: true },
				{ domain: 'acme.org', verified: false, primary: false },
			],
		});

		console.log('Validated organization:', org);
		console.log('Organization ID:', org.id); // Should have 'org_' prefix
	} catch (error) {
		console.error('Validation error:', error);
	}
}

demonstrateFieldTypes();
