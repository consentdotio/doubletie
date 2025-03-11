/**
 * Example demonstrating the different timestamp format options
 */
import {
	TimestampFormat,
	createdAtField,
	defineEntity,
	expiresAtField,
	stringField,
	updatedAtField,
} from '../src/index';

// Sample formats to demonstrate
const timestampFormats: TimestampFormat[] = [
	'iso',
	'unix',
	'unix_ms',
	'date',
	'custom',
];

// Create an event entity to demonstrate different timestamp formats
const eventEntity = defineEntity({
	name: 'event',
	fields: {
		id: stringField({ required: true }),
		name: stringField({ required: true }),

		// ISO 8601 string format (default)
		createdAt: createdAtField(),

		// Unix timestamp (seconds since epoch)
		startTime: createdAtField({
			format: 'unix',
			required: false,
		}),

		// Unix timestamp in milliseconds
		endTime: createdAtField({
			format: 'unix_ms',
			required: false,
		}),

		// Date object format
		lastRegistrationDate: createdAtField({
			format: 'date',
			required: false,
		}),

		// UTC timezone
		utcCreatedAt: createdAtField({
			timezone: 'UTC',
		}),

		// New York timezone
		localCreatedAt: createdAtField({
			timezone: 'America/New_York',
			includeTimezone: true,
		}),

		// Custom format (epoch days)
		customDaysSinceEpoch: createdAtField({
			format: 'custom',
			formatFn: (date) => Math.floor(date.getTime() / (1000 * 60 * 60 * 24)),
			parseFn: (value) => new Date((value as number) * 1000 * 60 * 60 * 24),
			required: false,
		}),

		// Expiration with timezone
		expiresAt: expiresAtField({
			format: 'unix',
			timezone: 'UTC',
		}),
	},
});

// An event tracking entity with different timestamp usages
const userActivityEntity = defineEntity({
	name: 'userActivity',
	fields: {
		id: stringField({ required: true }),
		userId: stringField({ required: true }),
		action: stringField({ required: true }),

		// Track when activity was created (ISO format)
		createdAt: createdAtField(),

		// Track when activity was last updated (Unix timestamp)
		updatedAt: updatedAtField({
			format: 'unix',
		}),

		// When the activity occurred in the user's local timezone
		localTimestamp: createdAtField({
			timezone: 'auto', // Will be set based on input data
			includeTimezone: true,
		}),
	},
});

// Demonstrate how to use these entities
async function demonstrateTimestampFormats() {
	try {
		// Create an event with various timestamps
		const event = await eventEntity.validate({
			id: 'event-123',
			name: 'Annual Conference',

			// These will be auto-populated:
			// createdAt, utcCreatedAt, localCreatedAt, customDaysSinceEpoch

			// Provide explicit values for some fields
			startTime: Math.floor(Date.now() / 1000) + 60 * 60 * 24, // Tomorrow
			endTime: Date.now() + 60 * 60 * 24 * 3 * 1000, // 3 days from now
			expiresAt: Math.floor(Date.now() / 1000) + 60 * 60 * 24 * 30, // 30 days from now
		});

		console.log('Event with different timestamp formats:');
		console.log('----------------------------------------');
		console.log('Event ID:', event.id);
		console.log('Event Name:', event.name);
		console.log('Created At (ISO):', event.createdAt);
		console.log('Start Time (Unix):', event.startTime);
		console.log('End Time (Unix MS):', event.endTime);
		console.log('UTC Created At:', event.utcCreatedAt);
		console.log('NY Local Created At:', event.localCreatedAt);
		console.log('Custom Days Since Epoch:', event.customDaysSinceEpoch);
		console.log('Expires At (Unix UTC):', event.expiresAt);
		console.log('----------------------------------------');

		// Create a user activity with explicit timestamp values
		const userActivity = await userActivityEntity.validate({
			id: 'activity-456',
			userId: 'user-789',
			action: 'login',
			localTimestamp: new Date().toISOString(),
		});

		console.log('\nUser Activity with different timestamp formats:');
		console.log('----------------------------------------');
		console.log('Activity ID:', userActivity.id);
		console.log('User ID:', userActivity.userId);
		console.log('Action:', userActivity.action);
		console.log('Created At (ISO):', userActivity.createdAt);
		console.log('Updated At (Unix):', userActivity.updatedAt);
		console.log('Local Timestamp:', userActivity.localTimestamp);
		console.log('----------------------------------------');
	} catch (error) {
		console.error('Validation error:', error);
	}
}

// Run the demonstration
demonstrateTimestampFormats();
