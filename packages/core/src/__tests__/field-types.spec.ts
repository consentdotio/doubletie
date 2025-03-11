import { describe, test, expect, vi, beforeEach, afterEach } from 'vitest';
import { z } from 'zod';

import {
    // Timestamp fields
    createdAtField,
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
} from '../schema/fields';
import { defineEntity } from '../entity/entity';


// Mock UUID generation for consistent tests
vi.mock('uuid', () => ({
    v4: () => '123e4567-e89b-12d3-a456-426614174000'
}));

// Mock nanoid for prefixed IDs
vi.mock('nanoid', () => ({
    nanoid: (length: number) => 'abcdef1234'.substring(0, length || 10)
}));

describe('Field Types', () => {
    beforeEach(() => {
        // Reset mocks
        vi.restoreAllMocks();
        
        // Mock Date.now() for consistent timestamp tests
        const mockDate = new Date('2024-01-01T12:00:00Z');
        vi.setSystemTime(mockDate);
    });

    afterEach(() => {
        vi.useRealTimers();
    });

    test('User entity validates with various field types', async () => {
        const userEntity = defineEntity({
            name: 'user',
            fields: {
                // ID field using UUID - make not required for testing
                id: uuidField({ required: false }),
        
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
        
                // Audit timestamps - make not required for testing
                createdAt: createdAtField({ required: false }),
                updatedAt: updatedAtField({ required: false }),
                deletedAt: deletedAtField(),
            },
        });

        const userData = {
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
        };

        const user = await userEntity.validate(userData);

        // Test auto-populated fields
        expect(user.id).toBe('123e4567-e89b-12d3-a456-426614174000');
        expect(user.createdAt).toBeInstanceOf(Date);
        expect(user.updatedAt).toBeInstanceOf(Date);
        expect(user.deletedAt).toBeUndefined();

        // Use snapshot for the full validated object
        expect(user).toMatchSnapshot();
    });

    test('Organization entity with prefixed IDs', async () => {
        const orgEntity = defineEntity({
            name: 'organization',
            fields: {
                // Prefixed ID like "org_abc123" - make not required for testing
                id: prefixedIdField('org_', { length: 10, required: false }),
        
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
        
                // Audit timestamps - make not required for testing
                createdAt: createdAtField({ required: false }),
                updatedAt: updatedAtField({ required: false }),
            },
        });

        const orgData = {
            name: 'Acme Inc',
            description: 'A fictional company',
            domains: [
                { domain: 'acme.com', verified: true, primary: true },
                { domain: 'acme.org', verified: false, primary: false },
            ],
        };

        const org = await orgEntity.validate(orgData);

        // Test the organization ID has the right prefix
        expect(org.id).toMatch(/^org_/);
        // Use exact match given our mock
        expect(org.id).toBe('org_abcdef1234');
        
        // Test auto-populated fields
        expect(org.createdAt).toBeInstanceOf(Date);
        expect(org.updatedAt).toBeInstanceOf(Date);

        // Use snapshot for the full validated object
        expect(org).toMatchSnapshot();
    });

    test('Field validations work properly', async () => {
        const userEntity = defineEntity({
            name: 'user',
            fields: {
                id: uuidField({ required: false }), // Make not required for testing
                username: stringField({
                    minLength: 3,
                    maxLength: 20,
                    pattern: /^[a-z0-9_]+$/,
                    required: true,
                }),
                email: emailField({ required: true }),
            },
        });

        // Test invalid username (too short)
        await expect(
            userEntity.validate({
                username: 'ab',
                email: 'test@example.com',
            })
        ).rejects.toThrow();

        // Test invalid username (invalid character)
        await expect(
            userEntity.validate({
                username: 'User!Name',
                email: 'test@example.com',
            })
        ).rejects.toThrow();

        // Test invalid email
        await expect(
            userEntity.validate({
                username: 'valid_user',
                email: 'not-an-email',
            })
        ).rejects.toThrow();

        // Test valid data passes
        const validUser = await userEntity.validate({
            username: 'valid_user',
            email: 'valid@example.com',
        }) as { username: string; email: string };
        
        expect(validUser.username).toBe('valid_user');
        expect(validUser.email).toBe('valid@example.com');
    });
}); 