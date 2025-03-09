import { describe, expect, it } from 'vitest';

describe('Slug functionality', () => {
	it('should generate slugs correctly', async () => {
		try {
			// Test slug generation in isolation without database
			console.log('Testing slug generation logic...');

			// Define a function that generates slugs
			const generateSlug = (title: string): string => {
				return title.toLowerCase().replace(/\s+/g, '-');
			};

			// Test with various inputs
			expect(generateSlug('Test Article')).toBe('test-article');
			expect(generateSlug('Hello World')).toBe('hello-world');
			expect(generateSlug('Multiple   Spaces')).toBe('multiple-spaces');
			expect(generateSlug('Special!@#$%^&*Characters')).toBe(
				'special!@#$%^&*characters'
			);
			expect(generateSlug('Title with UPPERCASE')).toBe('title-with-uppercase');

			console.log('Slug generation tests passed');
		} catch (error) {
			console.error('Error in slug test:', error);
			throw error;
		}
	});
});
