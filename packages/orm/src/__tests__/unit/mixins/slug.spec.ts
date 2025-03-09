import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
	Operation,
	type Options,
	generateSlugValue,
	default as withSlug,
} from '~/mixins/slug';
import type { ModelFunctions } from '~/model';

// Define test database type for testing
interface TestDB {
	users: {
		id: number;
		name: string;
		email: string;
		slug: string;
		title: string;
	};
	posts: {
		id: number;
		title: string;
		slug: string;
		content: string;
	};
}

describe('unit: slug mixin', () => {
	describe('generateSlugValue', () => {
		it('should generate a valid slug from a string', () => {
			const data = { title: 'This is a Test Title' };
			const options: Options<TestDB, 'posts'> = {
				field: 'slug',
				sources: ['title'],
			};

			const result = generateSlugValue(data, options);

			expect(result).toBe('this-is-a-test-title');
		});

		it('should generate a slug from multiple source fields', () => {
			const data = {
				name: 'John',
				title: 'Developer',
			};
			const options: Options<TestDB, 'users'> = {
				field: 'slug',
				sources: ['name', 'title'],
			};

			const result = generateSlugValue(data, options);

			expect(result).toBe('john-developer');
		});

		it('should not override an existing slug', () => {
			const data = {
				title: 'New Title',
				slug: 'existing-slug',
			};
			const options: Options<TestDB, 'posts'> = {
				field: 'slug',
				sources: ['title'],
			};

			const result = generateSlugValue(data, options);

			expect(result).toBe('existing-slug');
		});

		it('should return undefined if source fields are empty', () => {
			const data = { title: '' };
			const options: Options<TestDB, 'posts'> = {
				field: 'slug',
				sources: ['title'],
			};

			const result = generateSlugValue(data, options);

			expect(result).toBeUndefined();
		});

		it('should handle special characters in source fields', () => {
			const data = { title: 'Title with & special @ characters!' };
			const options: Options<TestDB, 'posts'> = {
				field: 'slug',
				sources: ['title'],
			};

			const result = generateSlugValue(data, options);

			expect(result).toBe('title-with-and-special-at-characters');
		});

		it('should apply the LOWERCASE operation', () => {
			const data = { title: 'UPPERCASE TITLE' };
			const options: Options<TestDB, 'posts'> = {
				field: 'slug',
				sources: ['title'],
				operation: Operation.LOWERCASE,
			};

			const result = generateSlugValue(data, options);

			expect(result).toBe('uppercase-title');
		});

		it('should apply the UPPERCASE operation', () => {
			const data = { title: 'lowercase title' };
			const options: Options<TestDB, 'posts'> = {
				field: 'slug',
				sources: ['title'],
				operation: Operation.UPPERCASE,
			};

			const result = generateSlugValue(data, options);

			expect(result).toBe('LOWERCASE-TITLE');
		});

		it('should apply the CAPITALIZE operation', () => {
			const data = { title: 'this is a title' };
			const options: Options<TestDB, 'posts'> = {
				field: 'slug',
				sources: ['title'],
				operation: Operation.CAPITALIZE,
			};

			const result = generateSlugValue(data, options);

			expect(result).toBe('This-Is-A-Title');
		});

		it('should respect the separator option', () => {
			const data = { title: 'This is a title' };
			const options: Options<TestDB, 'posts'> = {
				field: 'slug',
				sources: ['title'],
				slugOptions: {
					separator: '_',
				},
			};

			const result = generateSlugValue(data, options);

			expect(result).toBe('this_is_a_title');
		});

		it('should respect the truncate option', () => {
			const data = {
				title: 'This is a very long title that should be truncated',
			};
			const options: Options<TestDB, 'posts'> = {
				field: 'slug',
				sources: ['title'],
				slugOptions: {
					truncate: 15,
				},
			};

			const result = generateSlugValue(data, options);

			expect(result?.length).toBe(15);
			expect(result).toBe('this-is-a-very');
		});

		it('should apply dictionary replacements', () => {
			const data = { title: 'C++ and JavaScript' };
			const options: Options<TestDB, 'posts'> = {
				field: 'slug',
				sources: ['title'],
				slugOptions: {
					dictionary: {
						'c\\+\\+': 'cpp',
						javascript: 'js',
					},
				},
			};

			const result = generateSlugValue(data, options);

			expect(result).toBe('cpp-and-js');
		});
	});

	describe('withSlug', () => {
		let mockModel: ModelFunctions<TestDB, 'posts', 'id'>;
		let modelWithSlug: any;

		beforeEach(() => {
			// Mock model
			mockModel = {
				db: {} as any,
				table: 'posts',
				id: 'id',
				noResultError: Error as any,
				isolated: false,

				// Mock methods
				selectFrom: vi.fn(() => ({
					where: vi.fn(() => ({
						executeTakeFirst: vi.fn(),
					})),
				})),
				findOne: vi.fn(),
				insertInto: vi.fn(() => ({
					values: vi.fn(() => ({
						returning: vi.fn(() => ({
							executeTakeFirst: vi.fn(),
						})),
					})),
				})),
				updateTable: vi.fn(() => ({
					set: vi.fn(() => ({
						where: vi.fn(() => ({
							returning: vi.fn(() => ({
								executeTakeFirst: vi.fn(),
							})),
						})),
					})),
				})),
			} as any;

			// Apply mixin
			modelWithSlug = withSlug(mockModel, {
				field: 'slug',
				sources: ['title'],
			});
		});

		it('should enhance the model with additional methods', () => {
			expect(modelWithSlug).toHaveProperty('findBySlug');
			expect(modelWithSlug).toHaveProperty('insertWithSlug');
			expect(modelWithSlug).toHaveProperty('insertIfNotExistsWithSlug');
			expect(modelWithSlug).toHaveProperty('upsertWithSlug');
			expect(modelWithSlug).toHaveProperty('processDataBeforeInsert');
		});

		it('should generate a slug during insertWithSlug', async () => {
			// Mock the executeTakeFirst to return a successful result
			const mockResult = { id: 1, title: 'Test Post', slug: 'test-post' };
			const executeTakeFirstMock = vi.fn().mockResolvedValue(mockResult);

			mockModel.insertInto = vi.fn(() => ({
				values: vi.fn(() => ({
					returning: vi.fn(() => ({
						executeTakeFirst: executeTakeFirstMock,
					})),
				})),
			}));

			const result = await modelWithSlug.insertWithSlug({ title: 'Test Post' });

			expect(mockModel.insertInto).toHaveBeenCalled();
			expect(result).toEqual(mockResult);
		});

		it('should use an existing slug if provided', async () => {
			const mockResult = { id: 1, title: 'Test Post', slug: 'custom-slug' };
			const executeTakeFirstMock = vi.fn().mockResolvedValue(mockResult);
			const valuesMock = vi.fn(() => ({
				returning: vi.fn(() => ({
					executeTakeFirst: executeTakeFirstMock,
				})),
			}));

			mockModel.insertInto = vi.fn(() => ({
				values: valuesMock,
			}));

			await modelWithSlug.insertWithSlug({
				title: 'Test Post',
				slug: 'custom-slug',
			});

			// Check that the values passed to insert had the custom slug
			expect(valuesMock).toHaveBeenCalledWith(
				expect.objectContaining({ slug: 'custom-slug' })
			);
		});

		it('should provide a findBySlug method', async () => {
			mockModel.findOne = vi.fn().mockResolvedValue({
				id: 1,
				title: 'Test Post',
				slug: 'test-post',
			});

			const result = await modelWithSlug.findBySlug('test-post');

			expect(mockModel.findOne).toHaveBeenCalledWith('slug', expect.anything());
			expect(result).toEqual({
				id: 1,
				title: 'Test Post',
				slug: 'test-post',
			});
		});

		it('should handle array of objects in processDataBeforeInsert', () => {
			const data = [
				{ title: 'Post 1' },
				{ title: 'Post 2' },
				{ title: 'Post 3', slug: 'custom-slug' },
			];

			const processed = modelWithSlug.processDataBeforeInsert(data);

			expect(processed).toHaveLength(3);
			expect(processed[0]).toHaveProperty('slug', 'post-1');
			expect(processed[1]).toHaveProperty('slug', 'post-2');
			expect(processed[2]).toHaveProperty('slug', 'custom-slug');
		});
	});

	describe('curried usage', () => {
		it('should support curried usage with options', () => {
			const mockModel = {} as ModelFunctions<TestDB, 'posts', 'id'>;

			// Test curried usage
			const slugMixin = withSlug<TestDB, 'posts', 'id'>(mockModel);
			const modelWithSlug = slugMixin({
				field: 'slug',
				sources: ['title'],
			});

			expect(modelWithSlug).toHaveProperty('findBySlug');
			expect(modelWithSlug).toHaveProperty('insertWithSlug');
		});

		it('should support direct usage with field and source', () => {
			const mockModel = {} as ModelFunctions<TestDB, 'users', 'id'>;

			// Test direct usage
			const modelWithSlug = withSlug(mockModel, 'slug', 'name');

			expect(modelWithSlug).toHaveProperty('findBySlug');
			expect(modelWithSlug).toHaveProperty('insertWithSlug');
		});
	});
});
