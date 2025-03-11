/**
 * Example of enhanced ID field types with multiple generation strategies
 */
import { z } from 'zod';
import {
	defineEntity,
	createField as field,
	idField,
	incrementalIdField,
	prefixedIdField,
	uuidField,
} from '../src/index';

// For development purposes, we need to install these packages
// Run: npm install uuid nanoid

// Example entities using different ID strategies
const userEntity = defineEntity({
	name: 'user',
	fields: {
		// UUID: "123e4567-e89b-12d3-a456-426614174000"
		id: uuidField(),
		name: field('string', { required: true }),
		email: field('string', { required: true }),
	},
});

const productEntity = defineEntity({
	name: 'product',
	fields: {
		// Prefixed nanoid: "prod_Xc9aEb3Z1f"
		id: prefixedIdField('prod_', { length: 8 }),
		name: field('string', { required: true }),
		price: field('number', { required: true }),
	},
});

const orderEntity = defineEntity({
	name: 'order',
	fields: {
		// Incremental ID: 1000, 1001, 1002...
		id: incrementalIdField(1000),
		items: field('array', { required: true }),
	},
});

const ticketEntity = defineEntity({
	name: 'ticket',
	fields: {
		// Custom generator - ticket numbers like "TKT-2023-00001"
		id: idField({
			idType: 'custom',
			generator: () => {
				const year = new Date().getFullYear();
				// For demo purposes only - in production we'd use a database sequence
				if (!(globalThis as any).__sequences) {
					(globalThis as any).__sequences = { ticket: 1 };
				}
				const num = (globalThis as any).__sequences.ticket++;
				return `TKT-${year}-${num.toString().padStart(5, '0')}`;
			},
		}),
		subject: field('string', { required: true }),
	},
});

// Usage examples
async function demonstrateIdTypes() {
	try {
		// Create instances with auto-generated IDs
		const user = await userEntity.validate({
			name: 'John Doe',
			email: 'john@example.com',
		});
		console.log('User with UUID:', user);

		const product = await productEntity.validate({
			name: 'Premium Widget',
			price: 49.99,
		});
		console.log('Product with prefixed ID:', product);

		const order = await orderEntity.validate({ items: ['item1', 'item2'] });
		console.log('Order with incremental ID:', order);

		const ticket = await ticketEntity.validate({ subject: 'Technical issue' });
		console.log('Ticket with custom ID format:', ticket);

		// Create another ticket to show incrementing custom ID
		const ticket2 = await ticketEntity.validate({ subject: 'Feature request' });
		console.log('Second ticket with incremented ID:', ticket2);
	} catch (error) {
		console.error('Validation error:', error);
	}
}

demonstrateIdTypes();
