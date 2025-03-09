import { beforeEach, describe, expect, it, vi } from 'vitest';
import withIdGenerator from '~/mixins/id-generator';
import createModel from '~/model';

// Assuming the ID generator interface based on standard patterns
interface TestDB {
	users: {
		id: string | number;
		name: string;
		email: string;
	};
	posts: {
		id: string;
		title: string;
		content: string;
	};
}

describe('unit: ID Generator mixin', () => {
	let mockDb;
	let baseModel;

	beforeEach(() => {
		// Set up mock database
		mockDb = {
			selectFrom: vi.fn().mockReturnThis(),
			where: vi.fn().mockReturnThis(),
			orderBy: vi.fn().mockReturnThis(),
			limit: vi.fn().mockReturnThis(),
			executeTakeFirst: vi.fn(),
			execute: vi.fn(),
			insertInto: vi.fn().mockReturnThis(),
			values: vi.fn().mockReturnThis(),
			returning: vi.fn().mockReturnThis(),
		};

		// Create base model
		baseModel = createModel<TestDB, 'users', 'id'>(mockDb, 'users', 'id');
	});

	describe('numeric ID generation', () => {
		it('should generate sequential numeric IDs', () => {
			// Configure mock to return the last ID
			mockDb.executeTakeFirst.mockResolvedValue({ maxId: 42 });

			const modelWithIdGenerator = withIdGenerator(baseModel, {
				type: 'numeric',
				fieldName: 'id',
			});

			// Access the generator directly to test
			return expect(modelWithIdGenerator.generateId()).resolves.toBe(43);
		});

		it('should start from 1 if no records exist', () => {
			// Return null to simulate no records
			mockDb.executeTakeFirst.mockResolvedValue(null);

			const modelWithIdGenerator = withIdGenerator(baseModel, {
				type: 'numeric',
				fieldName: 'id',
			});

			return expect(modelWithIdGenerator.generateId()).resolves.toBe(1);
		});

		it('should support a custom starting value', () => {
			mockDb.executeTakeFirst.mockResolvedValue(null);

			const modelWithIdGenerator = withIdGenerator(baseModel, {
				type: 'numeric',
				fieldName: 'id',
				startValue: 1000,
			});

			return expect(modelWithIdGenerator.generateId()).resolves.toBe(1000);
		});

		it('should support a custom increment value', () => {
			mockDb.executeTakeFirst.mockResolvedValue({ maxId: 50 });

			const modelWithIdGenerator = withIdGenerator(baseModel, {
				type: 'numeric',
				fieldName: 'id',
				increment: 10,
			});

			return expect(modelWithIdGenerator.generateId()).resolves.toBe(60);
		});
	});

	describe('UUID generation', () => {
		it('should generate a valid UUID', () => {
			const modelWithIdGenerator = withIdGenerator(baseModel, {
				type: 'uuid',
				fieldName: 'id',
			});

			return modelWithIdGenerator.generateId().then((uuid) => {
				// Test for UUID format (8-4-4-4-12)
				expect(uuid).toMatch(
					/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
				);
			});
		});

		it('should generate unique UUIDs', async () => {
			const modelWithIdGenerator = withIdGenerator(baseModel, {
				type: 'uuid',
				fieldName: 'id',
			});

			const uuid1 = await modelWithIdGenerator.generateId();
			const uuid2 = await modelWithIdGenerator.generateId();

			expect(uuid1).not.toBe(uuid2);
		});

		it('should support UUID v4 format', () => {
			const modelWithIdGenerator = withIdGenerator(baseModel, {
				type: 'uuid',
				fieldName: 'id',
				version: 4,
			});

			return modelWithIdGenerator.generateId().then((uuid) => {
				// UUID v4 has specific pattern in certain positions
				expect(uuid).toMatch(
					/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i
				);
			});
		});
	});

	describe('prefixed ID generation', () => {
		it('should generate IDs with a prefix', () => {
			mockDb.executeTakeFirst.mockResolvedValue({ maxId: 42 });

			const modelWithIdGenerator = withIdGenerator(baseModel, {
				type: 'prefixed',
				fieldName: 'id',
				prefix: 'USER',
				separator: '-',
			});

			return expect(modelWithIdGenerator.generateId()).resolves.toBe('USER-43');
		});

		it('should support numeric padding', () => {
			mockDb.executeTakeFirst.mockResolvedValue({ maxId: 7 });

			const modelWithIdGenerator = withIdGenerator(baseModel, {
				type: 'prefixed',
				fieldName: 'id',
				prefix: 'USER',
				separator: '-',
				padding: 4,
			});

			return expect(modelWithIdGenerator.generateId()).resolves.toBe(
				'USER-0008'
			);
		});

		it('should extract the numeric part from existing prefixed IDs', () => {
			// Mock the existing max ID with a prefixed format
			mockDb.executeTakeFirst.mockResolvedValue({ maxId: 'USER-42' });

			const modelWithIdGenerator = withIdGenerator(baseModel, {
				type: 'prefixed',
				fieldName: 'id',
				prefix: 'USER',
				separator: '-',
			});

			return expect(modelWithIdGenerator.generateId()).resolves.toBe('USER-43');
		});
	});

	describe('timestamp-based ID generation', () => {
		it('should generate IDs based on the current timestamp', () => {
			// Mock Date.now()
			const originalNow = Date.now;
			Date.now = vi.fn(() => 1609459200000); // 2021-01-01

			const modelWithIdGenerator = withIdGenerator(baseModel, {
				type: 'timestamp',
				fieldName: 'id',
			});

			const result = modelWithIdGenerator.generateId();

			// Restore Date.now
			Date.now = originalNow;

			return expect(result).resolves.toBe(1609459200000);
		});

		it('should support timestamp with a random suffix for uniqueness', async () => {
			// Mock Date.now() and Math.random()
			const originalNow = Date.now;
			const originalRandom = Math.random;

			Date.now = vi.fn(() => 1609459200000); // 2021-01-01
			Math.random = vi.fn(() => 0.5);

			const modelWithIdGenerator = withIdGenerator(baseModel, {
				type: 'timestamp',
				fieldName: 'id',
				withRandomSuffix: true,
			});

			const result = await modelWithIdGenerator.generateId();

			// Restore originals
			Date.now = originalNow;
			Math.random = originalRandom;

			// Should concatenate timestamp with random suffix
			expect(result).toMatch(/^1609459200000/);
			expect(result.length).toBeGreaterThan(String(1609459200000).length);
		});
	});

	describe('custom ID generation', () => {
		it('should support custom generator functions', () => {
			const customGenerator = vi.fn().mockResolvedValue('CUSTOM-ID-123');

			const modelWithIdGenerator = withIdGenerator(baseModel, {
				type: 'custom',
				fieldName: 'id',
				generator: customGenerator,
			});

			return expect(modelWithIdGenerator.generateId()).resolves.toBe(
				'CUSTOM-ID-123'
			);
		});

		it('should pass the model to custom generator functions', async () => {
			const customGenerator = vi.fn().mockResolvedValue('CUSTOM-ID-123');

			const modelWithIdGenerator = withIdGenerator(baseModel, {
				type: 'custom',
				fieldName: 'id',
				generator: customGenerator,
			});

			await modelWithIdGenerator.generateId();

			expect(customGenerator).toHaveBeenCalledWith(
				expect.objectContaining({
					table: 'users',
					id: 'id',
				})
			);
		});
	});

	describe('integration with model operations', () => {
		it('should automatically generate IDs during insert', async () => {
			// Set up mocks
			mockDb.executeTakeFirst.mockResolvedValueOnce({ maxId: 42 }); // For ID generation
			mockDb.executeTakeFirst.mockResolvedValueOnce({
				id: 43,
				name: 'Test User',
			}); // For insert result

			const modelWithIdGenerator = withIdGenerator(baseModel, {
				type: 'numeric',
				fieldName: 'id',
			});

			// Spy on generateId
			const generateIdSpy = vi.spyOn(modelWithIdGenerator, 'generateId');

			// Call the insertWithGeneratedId method (assuming such a method exists)
			await modelWithIdGenerator.insertWithGeneratedId({
				name: 'Test User',
			});

			// Verify the ID was generated
			expect(generateIdSpy).toHaveBeenCalled();

			// Verify insert was called with the generated ID
			expect(mockDb.values).toHaveBeenCalledWith(
				expect.objectContaining({
					id: 43,
					name: 'Test User',
				})
			);
		});

		it('should not override existing IDs during insert', async () => {
			mockDb.executeTakeFirst.mockResolvedValueOnce({
				id: 99,
				name: 'Test User',
			}); // For insert result

			const modelWithIdGenerator = withIdGenerator(baseModel, {
				type: 'numeric',
				fieldName: 'id',
			});

			// Spy on generateId
			const generateIdSpy = vi.spyOn(modelWithIdGenerator, 'generateId');

			// Call insert with an existing ID
			await modelWithIdGenerator.insertWithGeneratedId({
				id: 99,
				name: 'Test User',
			});

			// Verify the ID was not generated
			expect(generateIdSpy).not.toHaveBeenCalled();

			// Verify insert was called with the provided ID
			expect(mockDb.values).toHaveBeenCalledWith({
				id: 99,
				name: 'Test User',
			});
		});
	});
});
