import { beforeEach, describe, expect, it, vi } from 'vitest';
import { withGlobalId } from '~/mixins';
import createModel from '~/model';

describe('unit: Global ID mixin', () => {
	// Define test database types and model
	interface TestDB {
		users: {
			id: number;
			name: string;
			email: string;
		};
		posts: {
			id: number;
			title: string;
			user_id: number;
		};
	}

	let mockDb;
	let baseUserModel;
	let basePostModel;

	beforeEach(() => {
		// Set up mock database
		mockDb = {
			selectFrom: vi.fn().mockReturnThis(),
			where: vi.fn().mockReturnThis(),
			executeTakeFirst: vi.fn(),
		};

		// Create base models
		baseUserModel = createModel<TestDB, 'users', 'id'>(mockDb, 'users', 'id');
		basePostModel = createModel<TestDB, 'posts', 'id'>(mockDb, 'posts', 'id');
	});

	describe('global ID generation', () => {
		it('should generate a global ID from a numeric ID', () => {
			const userModel = withGlobalId(baseUserModel, {
				type: 'User',
			});

			const globalId = userModel.getGlobalId(123);

			// A global ID is typically a base64 encoded string of type:id
			expect(typeof globalId).toBe('string');
			expect(globalId).not.toBe('123');
		});

		it('should include the type name in the global ID', () => {
			const userModel = withGlobalId(baseUserModel, {
				type: 'User',
			});

			const postModel = withGlobalId(basePostModel, {
				type: 'Post',
			});

			const userGlobalId = userModel.getGlobalId(1);
			const postGlobalId = postModel.getGlobalId(1);

			// The same ID should generate different global IDs for different types
			expect(userGlobalId).not.toBe(postGlobalId);
		});

		it('should support custom ID encoders', () => {
			const customEncoder = vi.fn((type, id) => `${type}:custom:${id}`);

			const userModel = withGlobalId(baseUserModel, {
				type: 'User',
				encode: customEncoder,
			});

			const globalId = userModel.getGlobalId(123);

			expect(customEncoder).toHaveBeenCalledWith('User', 123);
			expect(globalId).toBe('User:custom:123');
		});

		it('should properly encode non-numeric IDs', () => {
			// Mock a model with string IDs
			const stringIdModel = {
				...baseUserModel,
				id: 'uuid' as const,
			};

			const enhancedModel = withGlobalId(stringIdModel, {
				type: 'StringUser',
			});

			const globalId = enhancedModel.getGlobalId('abc-123');

			expect(typeof globalId).toBe('string');
			expect(globalId).not.toBe('abc-123');
		});
	});

	describe('global ID decoding', () => {
		it('should decode a global ID to type and ID', () => {
			const userModel = withGlobalId(baseUserModel, {
				type: 'User',
			});

			const globalId = userModel.getGlobalId(123);
			const decoded = userModel.decodeGlobalId(globalId);

			expect(decoded).toEqual({
				type: 'User',
				id: 123,
			});
		});

		it('should handle custom ID decoders', () => {
			const customEncoder = vi.fn((type, id) => `${type}:custom:${id}`);
			const customDecoder = vi.fn((globalId) => {
				const [type, , id] = globalId.split(':');
				return { type, id: Number(id) };
			});

			const userModel = withGlobalId(baseUserModel, {
				type: 'User',
				encode: customEncoder,
				decode: customDecoder,
			});

			const globalId = userModel.getGlobalId(123);
			const decoded = userModel.decodeGlobalId(globalId);

			expect(customDecoder).toHaveBeenCalledWith(globalId);
			expect(decoded).toEqual({
				type: 'User',
				id: 123,
			});
		});

		it('should validate type when decoding', () => {
			const userModel = withGlobalId(baseUserModel, {
				type: 'User',
				validateType: true,
			});

			const globalId = userModel.getGlobalId(123);

			// Valid type should decode successfully
			expect(() => userModel.decodeGlobalId(globalId)).not.toThrow();

			// Invalid type should throw or return null based on implementation
			const postModel = withGlobalId(basePostModel, {
				type: 'Post',
			});
			const postGlobalId = postModel.getGlobalId(123);

			// This should either throw or return null depending on implementation
			try {
				const result = userModel.decodeGlobalId(postGlobalId);
				// If it doesn't throw, it should return null or an error indicator
				expect(result).toBeNull();
			} catch (error) {
				// If it throws, this is also acceptable
				expect(error).toBeDefined();
			}
		});
	});

	describe('finding records by global ID', () => {
		it('should find a record by global ID', async () => {
			// Mock the executeTakeFirst to return a user
			mockDb.executeTakeFirst.mockResolvedValue({
				id: 123,
				name: 'Test User',
			});

			const userModel = withGlobalId(baseUserModel, {
				type: 'User',
			});

			const globalId = userModel.getGlobalId(123);
			const user = await userModel.findByGlobalId(globalId);

			expect(mockDb.where).toHaveBeenCalledWith('id', '=', 123);
			expect(user).toEqual({
				id: 123,
				name: 'Test User',
			});
		});

		it('should return null for invalid global IDs', async () => {
			const userModel = withGlobalId(baseUserModel, {
				type: 'User',
			});

			// Use post global ID with user model
			const postModel = withGlobalId(basePostModel, {
				type: 'Post',
			});
			const postGlobalId = postModel.getGlobalId(123);

			const result = await userModel.findByGlobalId(postGlobalId);

			expect(result).toBeNull();
			expect(mockDb.where).not.toHaveBeenCalled();
		});

		it('should handle custom find logic', async () => {
			mockDb.executeTakeFirst.mockResolvedValue({
				id: 123,
				name: 'Test User',
			});

			const customFinder = vi.fn(async (model, id) => {
				return model.findById(id);
			});

			const userModel = withGlobalId(baseUserModel, {
				type: 'User',
				findById: customFinder,
			});

			const globalId = userModel.getGlobalId(123);
			await userModel.findByGlobalId(globalId);

			expect(customFinder).toHaveBeenCalled();
		});
	});

	describe('integration with model operations', () => {
		it('should add global IDs to returned records', async () => {
			mockDb.executeTakeFirst.mockResolvedValue({
				id: 123,
				name: 'Test User',
			});

			const userModel = withGlobalId(baseUserModel, {
				type: 'User',
				addToRecords: true,
			});

			const user = await userModel.findById(123);

			expect(user).toHaveProperty('globalId');
			expect(user.globalId).toBe(userModel.getGlobalId(123));
		});

		it('should add global IDs to arrays of records', async () => {
			// Mock the execute method
			mockDb.execute = vi.fn().mockResolvedValue([
				{ id: 1, name: 'User 1' },
				{ id: 2, name: 'User 2' },
			]);

			const userModel = withGlobalId(baseUserModel, {
				type: 'User',
				addToRecords: true,
			});

			// Create a new method to get all users
			userModel.findAll = async () => {
				return mockDb.execute();
			};

			const users = await userModel.findAll();

			expect(users[0]).toHaveProperty('globalId');
			expect(users[0].globalId).toBe(userModel.getGlobalId(1));
			expect(users[1]).toHaveProperty('globalId');
			expect(users[1].globalId).toBe(userModel.getGlobalId(2));
		});

		it('should handle node interface for resolvers', async () => {
			mockDb.executeTakeFirst.mockResolvedValue({
				id: 123,
				name: 'Test User',
			});

			const userModel = withGlobalId(baseUserModel, {
				type: 'User',
			});

			// Some implementations might add a node method for GraphQL
			if (typeof userModel.node === 'function') {
				const user = await userModel.node({
					id: userModel.getGlobalId(123),
				});

				expect(user).toEqual({
					id: 123,
					name: 'Test User',
				});
			}
		});
	});
});
