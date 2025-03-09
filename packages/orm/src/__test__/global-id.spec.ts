import { describe, expect, it } from 'vitest';
import { ProductModel } from './utils/common-setup';

describe('Global ID functionality', () => {
	it('should convert between string and numeric IDs', async () => {
		try {
			// Skip the table creation for now, it should be created by the test setup

			// Generate a global ID for a local ID
			const numericId = '123';
			const globalId = ProductModel.getGlobalId(numericId);

			// Verify the format is correct
			expect(globalId).toBe(`PRD_${numericId}`);

			// Test parsing a global ID back to a local ID
			const parsedId = ProductModel.parseGlobalId(globalId);
			expect(parsedId).toBe(numericId);

			// Also test with a non-numeric ID value
			const customId = 'custom_id';
			const customGlobalId = ProductModel.getGlobalId(customId);
			expect(customGlobalId).toBe(`PRD_${customId}`);

			const parsedCustomId = ProductModel.parseGlobalId(customGlobalId);
			expect(parsedCustomId).toBe(customId);
		} catch (error) {
			console.error('Error in global ID test:', error);
			throw error;
		}
	});

	it('should handle edge cases properly', async () => {
		// Test with null or empty values
		expect(() => ProductModel.getGlobalId(null as any)).not.toThrow();
		expect(() => ProductModel.getGlobalId(undefined as any)).not.toThrow();
		expect(() => ProductModel.getGlobalId('')).not.toThrow();

		// Null/invalid inputs should be handled gracefully
		expect(ProductModel.parseGlobalId(null as any)).toBeNull();
		expect(ProductModel.parseGlobalId(undefined as any)).toBeNull();
		expect(ProductModel.parseGlobalId('')).toBeNull();

		// Invalid global IDs should be handled without errors
		expect(() =>
			ProductModel.parseGlobalId('INVALID_PREFIX_123')
		).not.toThrow();

		// Invalid global IDs should return the original value
		expect(ProductModel.parseGlobalId('INVALID_PREFIX_123')).toBe(
			'INVALID_PREFIX_123'
		);
	});
});
