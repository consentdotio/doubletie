/**
 * Example demonstrating modular imports from different entry points
 *
 * This example shows how to use the more granular import paths to reduce bundle size
 * by only importing the specific modules needed.
 */

// Import only entity-related functionality
import { defineEntity } from '../src/entity';

// Import only schema field utilities
import {
	createdAtField,
	emailField,
	stringField,
	uuidField,
} from '../src/schema/fields';

// Import only database-related functionality
import { generateSQLForEntity, generateTableDefinition } from '../src/db';

// Import only validation functionality
import { validateEntity } from '../src/validation';

// Create a simple user entity using imports from different modules
const userEntity = defineEntity({
	name: 'user',
	fields: {
		id: uuidField(),
		username: stringField({
			required: true,
			databaseHints: { maxSize: 50, unique: true },
		}),
		email: emailField({ required: true }),
		createdAt: createdAtField(),
	},
	description: 'User account information',
});

// Example usage
async function demonstrateModularImports() {
	// Data to validate
	const userData = {
		username: 'johndoe',
		email: 'john@example.com',
	};

	try {
		// Validate the data - from validation module
		const validatedUser = validateEntity(userData, userEntity);
		console.log('Validated user:', validatedUser);

		// Generate SQL - from db module
		const sqlite = generateSQLForEntity(userEntity, 'sqlite');
		const postgres = generateSQLForEntity(userEntity, 'postgres');

		console.log('\nSQLite Table SQL:');
		console.log(sqlite);

		console.log('\nPostgreSQL Table SQL:');
		console.log(postgres);

		console.log('\nTable Definition:');
		console.log(
			JSON.stringify(generateTableDefinition(userEntity, 'sqlite'), null, 2)
		);
	} catch (error) {
		console.error('Validation error:', error);
	}
}

// Run the demonstration
demonstrateModularImports().catch(console.error);

/**
 * Benefits of this approach:
 *
 * 1. Reduced bundle size - only import what you need
 * 2. Better tree-shaking - more explicit imports help bundlers
 * 3. Improved code organization - clearer dependencies
 * 4. Progressive disclosure - start with basic modules, add more as needed
 *
 * Example bundle savings:
 * - Full import: ~150KB (theoretical example)
 * - Only entity + schema: ~70KB
 * - Only validation: ~30KB
 */
