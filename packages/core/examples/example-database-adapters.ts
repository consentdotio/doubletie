import { TableDefinition, getAdapter } from '../src/db/adapters';
import { defineEntity } from '../src/entity';
/**
 * Example demonstrating the database adapters with different entity types
 */
import {
	booleanField,
	createdAtField,
	deletedAtField,
	emailField,
	incrementalIdField,
	jsonField,
	numberField,
	stringArrayField,
	stringField,
	updatedAtField,
	uuidField,
} from '../src/schema/fields';

// Define a user entity with UUID primary key
const userEntity = defineEntity({
	name: 'user',
	fields: {
		id: uuidField(),
		username: stringField({
			required: true,
			databaseHints: {
				indexed: true,
				unique: true,
				maxSize: 50,
			},
		}),
		email: emailField({
			required: true,
			databaseHints: {
				indexed: true,
				unique: true,
			},
		}),
		firstName: stringField(),
		lastName: stringField(),
		active: booleanField({ defaultValue: true }),
		preferences: jsonField({
			defaultValue: { theme: 'light', notifications: true },
		}),
		tags: stringArrayField(),
		createdAt: createdAtField(),
		updatedAt: updatedAtField(),
		deletedAt: deletedAtField(),
	},
	description: 'User account information',
});

// Define a product entity with incremental ID
const productEntity = defineEntity({
	name: 'product',
	fields: {
		id: incrementalIdField(1000),
		name: stringField({ required: true }),
		description: stringField(),
		price: numberField({
			required: true,
			databaseHints: {
				precision: 10, // Total digits
				scale: 2, // Decimal places
			},
		}),
		sku: stringField({
			required: true,
			databaseHints: {
				indexed: true,
				unique: true,
			},
		}),
		inStock: booleanField({ defaultValue: true }),
		categories: stringArrayField(),
		createdAt: createdAtField(),
		updatedAt: updatedAtField(),
	},
	description: 'Product information',
});

// Define an order entity with relationships
const orderEntity = defineEntity({
	name: 'order',
	fields: {
		id: uuidField(),
		userId: stringField({
			required: true,
			relationship: {
				model: 'user',
				field: 'id',
				onDelete: 'CASCADE',
			},
		}),
		status: stringField({
			required: true,
			defaultValue: 'pending',
			databaseHints: {
				indexed: true,
			},
		}),
		total: numberField({
			required: true,
			databaseHints: {
				precision: 10,
				scale: 2,
			},
		}),
		items: jsonField({ required: true }),
		createdAt: createdAtField({
			format: 'unix',
			timezone: 'UTC',
		}),
		updatedAt: updatedAtField({
			format: 'unix',
			timezone: 'UTC',
		}),
	},
	description: 'Customer order information',
});

// Define a timestamped entity to show different timestamp formats
const eventEntity = defineEntity({
	name: 'event',
	fields: {
		id: uuidField(),
		name: stringField({ required: true }),
		description: stringField(),
		// ISO 8601 string (default)
		startDate: createdAtField(),
		// Unix timestamp with timezone
		endDate: createdAtField({
			format: 'unix',
			timezone: 'UTC',
			includeTimezone: true,
		}),
		location: stringField(),
		attendees: jsonField(),
		createdAt: createdAtField(),
		updatedAt: updatedAtField(),
	},
	description: 'Event information with different timestamp formats',
});

// Demonstrate using different database adapters
function generateSQLForDifferentDatabases() {
	const entities = [userEntity, productEntity, orderEntity, eventEntity];
	const adapterTypes = ['sqlite', 'mysql', 'postgres'];

	adapterTypes.forEach((adapterType) => {
		try {
			console.log(`\n==== Database Adapter: ${adapterType} ====\n`);
			const adapter = getAdapter(adapterType);

			entities.forEach((entity) => {
				console.log(`\n-- Entity: ${entity.name} --\n`);

				// Generate table definition
				const tableDef: TableDefinition =
					adapter.generateTableDefinition(entity);

				// Generate SQL for creating table
				const sql = adapter.generateCreateTableSQL(tableDef);
				console.log(`SQL for ${entity.name} (${adapterType}):`);
				console.log(sql);

				console.log('\n--------------------------------------------\n');
			});
		} catch (error) {
			console.error(`Error with adapter ${adapterType}:`, error);
		}
	});

	// Demonstrate data transformations
	const eventData = {
		id: '550e8400-e29b-41d4-a716-446655440000',
		name: 'Annual Conference',
		description: 'Our yearly gathering of industry experts',
		startDate: '2023-06-15T09:00:00.000Z',
		endDate: new Date('2023-06-17T17:00:00.000Z'),
		location: 'San Francisco, CA',
		attendees: [
			{ id: 1, name: 'John Doe', role: 'Speaker' },
			{ id: 2, name: 'Jane Smith', role: 'Attendee' },
		],
	};

	console.log('\n==== Data Transformations ====\n');

	adapterTypes.forEach((adapterType) => {
		try {
			console.log(`\nData transformations for ${adapterType}:`);
			const adapter = getAdapter(adapterType);

			// Transform to database format
			const dbData = {};
			Object.entries(eventEntity.fields).forEach(([fieldName, field]) => {
				if (eventData[fieldName] !== undefined) {
					dbData[fieldName] = adapter.toDatabase(field, eventData[fieldName]);
				}
			});

			console.log('\nTo Database:');
			console.log(JSON.stringify(dbData, null, 2));

			// Transform back from database format
			const appData = {};
			Object.entries(dbData).forEach(([fieldName, value]) => {
				const field = eventEntity.fields[fieldName];
				appData[fieldName] = adapter.fromDatabase(field, value);
			});

			console.log('\nFrom Database:');
			console.log(JSON.stringify(appData, null, 2));
		} catch (error) {
			console.error(
				`Error with data transformations for ${adapterType}:`,
				error
			);
		}
	});
}

// Run the demonstration
generateSQLForDifferentDatabases();
