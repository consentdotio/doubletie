import { beforeEach, describe, expect, it, vi } from 'vitest';
import { withGlobalId, withIdGenerator, withSlug } from '../../mixins';
import createModel from '../../model';

describe('unit: mixin composition', () => {
	// Define test database types
	interface TestDB {
		users: {
			id: number;
			name: string;
			email: string;
			slug: string;
			status: string;
		};
	}

	let mockDb;
	let UserModel;

	beforeEach(() => {
		// Set up mock database with query builder
		mockDb = {
			selectFrom: vi.fn().mockReturnThis(),
			select: vi.fn().mockReturnThis(),
			where: vi.fn().mockReturnThis(),
			execute: vi.fn().mockResolvedValue([]),
			executeTakeFirst: vi.fn().mockResolvedValue(null),
			insertInto: vi.fn().mockReturnThis(),
			values: vi.fn().mockReturnThis(),
			returning: vi.fn().mockReturnThis(),
			updateTable: vi.fn().mockReturnThis(),
			set: vi.fn().mockReturnThis(),
		};

		// Create base model
		UserModel = createModel<TestDB, 'users', 'id'>(mockDb, 'users', 'id');
	});

	describe('basic mixin application', () => {
		it('should apply a single mixin to a model', () => {
			const ModelWithSlug = withSlug(UserModel, {
				field: 'slug',
				sources: ['name'],
			});

			// Verify the mixin added methods
			expect(ModelWithSlug).toHaveProperty('insertWithSlug');
			expect(ModelWithSlug).toHaveProperty('findBySlug');

			// Verify original methods are preserved
			expect(ModelWithSlug).toHaveProperty('findById');
			expect(ModelWithSlug).toHaveProperty('selectFrom');
		});

		it('should apply multiple mixins to a model', () => {
			const ModelWithSlug = withSlug(UserModel, {
				field: 'slug',
				sources: ['name'],
			});

			const ModelWithSlugAndGlobalId = withGlobalId(ModelWithSlug, {
				type: 'User',
			});

			// Verify both mixins added their methods
			expect(ModelWithSlugAndGlobalId).toHaveProperty('insertWithSlug');
			expect(ModelWithSlugAndGlobalId).toHaveProperty('findBySlug');
			expect(ModelWithSlugAndGlobalId).toHaveProperty('getGlobalId');
			expect(ModelWithSlugAndGlobalId).toHaveProperty('findByGlobalId');

			// Verify original methods are preserved
			expect(ModelWithSlugAndGlobalId).toHaveProperty('findById');
			expect(ModelWithSlugAndGlobalId).toHaveProperty('selectFrom');
		});
	});

	describe('mixin interaction', () => {
		it('should preserve functionality from all mixins', async () => {
			// Apply multiple mixins
			const MixinUserModel = withGlobalId(
				withSlug(
					withIdGenerator(UserModel, {
						type: 'numeric',
						fieldName: 'id',
					}),
					{
						field: 'slug',
						sources: ['name'],
					}
				),
				{
					type: 'User',
				}
			);

			// Mock executeTakeFirst to return a user
			mockDb.executeTakeFirst.mockResolvedValue({
				id: 1,
				name: 'Test User',
				email: 'test@example.com',
				slug: 'test-user',
				status: 'active',
			});

			// Test findById (base functionality)
			const user = await MixinUserModel.findById(1);
			expect(mockDb.where).toHaveBeenCalled();
			expect(user).toHaveProperty('id', 1);

			// Test findBySlug (slug mixin)
			await MixinUserModel.findBySlug('test-user');
			expect(mockDb.where).toHaveBeenCalledWith(
				'slug',
				'=',
				expect.any(String)
			);

			// Test getGlobalId (global ID mixin)
			const globalId = MixinUserModel.getGlobalId(1);
			expect(globalId).toBeDefined();
			expect(typeof globalId).toBe('string');

			// Test generateId (ID generator mixin)
			mockDb.executeTakeFirst.mockResolvedValueOnce({ maxId: 42 });
			const nextId = await MixinUserModel.generateId();
			expect(nextId).toBe(43);
		});

		it('should handle mixins that extend the same methods', async () => {
			// Create mock mixins that extend the same method
			const withLoggedFind = (model) => {
				const findById = model.findById;

				return {
					...model,
					findById: async (id) => {
						console.log('Logged find called');
						return findById.call(model, id);
					},
				};
			};

			const withCachedFind = (model) => {
				const findById = model.findById;

				return {
					...model,
					findById: async (id) => {
						console.log('Cached find called');
						return findById.call(model, id);
					},
				};
			};

			// Apply mixins in different orders
			const LoggedThenCached = withCachedFind(withLoggedFind(UserModel));
			const CachedThenLogged = withLoggedFind(withCachedFind(UserModel));

			// Spy on console.log
			const consoleSpy = vi.spyOn(console, 'log');

			// Test the order of execution
			await LoggedThenCached.findById(1);
			expect(consoleSpy).toHaveBeenNthCalledWith(1, 'Cached find called');
			expect(consoleSpy).toHaveBeenNthCalledWith(2, 'Logged find called');

			consoleSpy.mockClear();

			await CachedThenLogged.findById(1);
			expect(consoleSpy).toHaveBeenNthCalledWith(1, 'Logged find called');
			expect(consoleSpy).toHaveBeenNthCalledWith(2, 'Cached find called');

			consoleSpy.mockRestore();
		});
	});

	describe('mixin with custom options', () => {
		it('should handle custom options in mixins', () => {
			// Define a custom mixin that takes options
			const withStatus = (model, options: { defaultStatus: string }) => {
				return {
					...model,
					findByStatus: async (status: string) => {
						return model.selectFrom().where('status', '=', status).execute();
					},
					insertWithStatus: async (data) => {
						const dataWithStatus = {
							...data,
							status: data.status || options.defaultStatus,
						};

						return model
							.insertInto()
							.values(dataWithStatus)
							.returning(['*'])
							.executeTakeFirst();
					},
				};
			};

			// Apply multiple mixins with custom options
			const EnhancedUserModel = withStatus(
				withSlug(UserModel, {
					field: 'slug',
					sources: ['name'],
				}),
				{
					defaultStatus: 'active',
				}
			);

			// Verify the custom mixin methods are added
			expect(EnhancedUserModel).toHaveProperty('findByStatus');
			expect(EnhancedUserModel).toHaveProperty('insertWithStatus');

			// Verify slug mixin methods are preserved
			expect(EnhancedUserModel).toHaveProperty('insertWithSlug');
			expect(EnhancedUserModel).toHaveProperty('findBySlug');
		});
	});

	describe('advanced composition patterns', () => {
		it('should support mixin factories', () => {
			// Define a mixin factory that returns a mixin function
			const createUserExtensionMixin = (extensions: Record<string, any>) => {
				return (model) => {
					return {
						...model,
						getExtensions: () => extensions,
						withExtensions: (data) => ({
							...data,
							...extensions,
						}),
					};
				};
			};

			// Create mixins with different extensions
			const withUserStatus = createUserExtensionMixin({
				status: 'active',
				lastLogin: new Date(),
			});

			const withUserPermissions = createUserExtensionMixin({
				permissions: ['read', 'write'],
				isAdmin: false,
			});

			// Apply multiple factory-created mixins
			const EnhancedUserModel = withUserPermissions(withUserStatus(UserModel));

			// Verify the mixin methods are added
			expect(EnhancedUserModel).toHaveProperty('getExtensions');
			expect(EnhancedUserModel).toHaveProperty('withExtensions');

			// Test the extensions are merged correctly
			const extensions = EnhancedUserModel.getExtensions();
			expect(extensions).toHaveProperty('status', 'active');
			expect(extensions).toHaveProperty('lastLogin');
			expect(extensions).toHaveProperty('permissions');
			expect(extensions).toHaveProperty('isAdmin', false);
		});

		it('should support dynamic mixin application', () => {
			// Define a function that dynamically applies mixins based on config
			const applyMixins = (baseModel, config) => {
				let model = baseModel;

				if (config.withSlug) {
					model = withSlug(model, {
						field: 'slug',
						sources: ['name'],
					});
				}

				if (config.withGlobalId) {
					model = withGlobalId(model, {
						type: 'User',
					});
				}

				if (config.withIdGenerator) {
					model = withIdGenerator(model, {
						type: 'numeric',
						fieldName: 'id',
					});
				}

				return model;
			};

			// Test different configurations
			const ModelWithAllMixins = applyMixins(UserModel, {
				withSlug: true,
				withGlobalId: true,
				withIdGenerator: true,
			});

			const ModelWithSomeMixins = applyMixins(UserModel, {
				withSlug: true,
				withGlobalId: false,
				withIdGenerator: true,
			});

			// Verify the expected methods are present
			expect(ModelWithAllMixins).toHaveProperty('findBySlug');
			expect(ModelWithAllMixins).toHaveProperty('getGlobalId');
			expect(ModelWithAllMixins).toHaveProperty('generateId');

			expect(ModelWithSomeMixins).toHaveProperty('findBySlug');
			expect(ModelWithSomeMixins).not.toHaveProperty('getGlobalId');
			expect(ModelWithSomeMixins).toHaveProperty('generateId');
		});
	});
});

describe('mixin order effects', () => {
	it('should respect the order of mixin application', async () => {
		// Define a mixin that modifies data before insertion
		const withTimestamps = (model) => {
			return {
				...model,
				processDataBeforeInsert: (data) => {
					const timestamp = new Date();

					if (Array.isArray(data)) {
						return data.map((item) => ({
							...item,
							created_at: timestamp,
							updated_at: timestamp,
						}));
					}

					return {
						...data,
						created_at: timestamp,
						updated_at: timestamp,
					};
				},
			};
		};

		// Define a mixin that logs data before insertion
		const withLogging = (model) => {
			const originalProcess = model.processDataBeforeInsert || ((data) => data);

			return {
				...model,
				processDataBeforeInsert: (data) => {
					console.log('Processing data:', data);
					return originalProcess(data);
				},
			};
		};

		// Apply mixins in different orders
		const TimestampsThenLogging = withLogging(withTimestamps(UserModel));
		const LoggingThenTimestamps = withTimestamps(withLogging(UserModel));

		// Mock console.log
		const consoleSpy = vi.spyOn(console, 'log');

		// Test with timestamps first, logging second
		const data1 = { name: 'User 1' };
		const processed1 = TimestampsThenLogging.processDataBeforeInsert(data1);

		// Log should contain timestamps
		expect(consoleSpy).toHaveBeenCalledWith(
			'Processing data:',
			expect.objectContaining({
				name: 'User 1',
				created_at: expect.any(Date),
				updated_at: expect.any(Date),
			})
		);

		consoleSpy.mockClear();

		// Test with logging first, timestamps second
		const data2 = { name: 'User 2' };
		const processed2 = LoggingThenTimestamps.processDataBeforeInsert(data2);

		// Log should not contain timestamps
		expect(consoleSpy).toHaveBeenCalledWith('Processing data:', {
			name: 'User 2',
		});

		// But result should have timestamps
		expect(processed2).toHaveProperty('created_at');
		expect(processed2).toHaveProperty('updated_at');

		consoleSpy.mockRestore();
	});
});
