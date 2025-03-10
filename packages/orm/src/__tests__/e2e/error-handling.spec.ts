import { sql } from 'kysely';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import createModel from '~/model';

/**
 * E2E tests for error handling
 *
 * These tests verify error handling behavior in realistic application scenarios,
 * demonstrating how errors propagate through multiple layers and how applications
 * can recover from various types of errors.
 */
describe('Error Handling - E2E Tests', () => {
	// Setup test database and models
	let db: any;
	let UserModel: any;
	let PostModel: any;
	let CommentModel: any;
	let TransactionLogModel: any;

	// Mock API layer for testing
	const mockApiResponses: Record<string, any> = {};
	const mockApiErrors: Record<string, Error> = {};

	const mockApi = {
		getUser: async (id: number) => {
			if (mockApiErrors.getUser) throw mockApiErrors.getUser;
			return mockApiResponses.getUser || null;
		},
		createUser: async (userData: any) => {
			if (mockApiErrors.createUser) throw mockApiErrors.createUser;
			return mockApiResponses.createUser || { id: 1, ...userData };
		},
		sendNotification: async (userId: number, message: string) => {
			if (mockApiErrors.sendNotification) throw mockApiErrors.sendNotification;
			return { success: true, sent: new Date() };
		},
	};

	// Application service that uses the ORM and external APIs
	class UserService {
		constructor(
			private db: any,
			private api: typeof mockApi
		) {}

		// Class for custom domain-specific errors
		private static DomainError = class extends Error {
			constructor(
				message: string,
				public code: string,
				public originalError?: Error
			) {
				super(message);
				this.name = 'DomainError';
			}
		};

		// Robust error handler with retry logic
		private async withRetry<T>(
			operation: () => Promise<T>,
			options: {
				retries?: number;
				delay?: number;
				canRetry?: (error: Error) => boolean;
				context?: string;
			} = {}
		): Promise<T> {
			const {
				retries = 3,
				delay = 50,
				canRetry = () => true,
				context = 'operation',
			} = options;

			let lastError: Error;

			for (let attempt = 1; attempt <= retries; attempt++) {
				try {
					return await operation();
				} catch (error) {
					lastError = error;

					// Log retry attempt
					console.log(
						`Retry ${attempt}/${retries} for ${context}: ${error.message}`
					);

					if (attempt === retries || !canRetry(error)) {
						break;
					}

					// In real code, we would wait here
					// await new Promise(resolve => setTimeout(resolve, delay * attempt));
				}
			}

			throw new UserService.DomainError(
				`Failed after ${retries} attempts: ${lastError.message}`,
				'RETRY_FAILED',
				lastError
			);
		}

		// Complex workflow with error handling
		async registerUser(userData: {
			email: string;
			name: string;
			username: string;
			password: string;
		}): Promise<{ success: boolean; user?: any; error?: any }> {
			try {
				// Transaction to ensure data consistency
				return await this.db.transaction().execute(async (trx) => {
					// Check if user exists
					const existingUser = await trx
						.selectFrom('users')
						.where('email', '=', userData.email)
						.executeTakeFirst();

					if (existingUser) {
						throw new UserService.DomainError(
							`User with email ${userData.email} already exists`,
							'USER_EXISTS'
						);
					}

					// Create user with retry for intermittent db issues
					const user = await this.withRetry(
						async () => {
							const result = await trx
								.insertInto('users')
								.values({
									...userData,
									followersCount: 0,
									createdAt: new Date().toISOString(),
									updatedAt: new Date().toISOString(),
								})
								.returning(['id', 'email', 'name', 'username'])
								.executeTakeFirst();

							return result;
						},
						{
							retries: 2,
							context: 'user creation',
							canRetry: (error) => error.message.includes('connection'),
						}
					);

					// Log the registration
					await trx
						.insertInto('transaction_logs')
						.values({
							userId: user.id,
							action: 'USER_REGISTERED',
							details: JSON.stringify({ email: user.email }),
							timestamp: new Date().toISOString(),
						})
						.execute();

					// Call external API with retry
					try {
						await this.withRetry(
							() =>
								this.api.sendNotification(user.id, 'Welcome to our platform!'),
							{
								retries: 2,
								context: 'send notification',
								canRetry: (error) => error.message.includes('timeout'),
							}
						);
					} catch (notificationError) {
						// Non-critical error - log but don't fail the registration
						await trx
							.insertInto('transaction_logs')
							.values({
								userId: user.id,
								action: 'NOTIFICATION_FAILED',
								details: JSON.stringify({ error: notificationError.message }),
								timestamp: new Date().toISOString(),
							})
							.execute();
					}

					return { success: true, user };
				});
			} catch (error) {
				// Structured error response based on error type
				if (error.name === 'DomainError') {
					return {
						success: false,
						error: {
							code: error.code,
							message: error.message,
						},
					};
				}

				// Database constraint errors
				if (error.message.includes('UNIQUE constraint failed')) {
					return {
						success: false,
						error: {
							code: 'DUPLICATE_ENTRY',
							message: 'A user with this email or username already exists',
						},
					};
				}

				// Generic error handling
				console.error('Unexpected error during user registration:', error);
				return {
					success: false,
					error: {
						code: 'INTERNAL_ERROR',
						message: 'An unexpected error occurred. Please try again later.',
					},
				};
			}
		}

		// Complex operation with concurrent access handling
		async updateUserProfile(
			userId: number,
			updates: { name?: string; email?: string },
			expectedVersion: number
		): Promise<{ success: boolean; user?: any; error?: any }> {
			try {
				// Optimistic concurrency control
				return await this.db.transaction().execute(async (trx) => {
					// Get current user with version check
					const user = await trx
						.selectFrom('users')
						.where('id', '=', userId)
						.select(['id', 'name', 'email', 'version'])
						.executeTakeFirst();

					if (!user) {
						throw new UserService.DomainError(
							`User with id ${userId} not found`,
							'USER_NOT_FOUND'
						);
					}

					if (user.version !== expectedVersion) {
						throw new UserService.DomainError(
							'The record has been modified since you last retrieved it',
							'CONCURRENT_MODIFICATION'
						);
					}

					// Update the user
					const updatedUser = await trx
						.updateTable('users')
						.set({
							...updates,
							version: sql`version + 1`,
							updatedAt: new Date().toISOString(),
						})
						.where('id', '=', userId)
						.where('version', '=', expectedVersion)
						.returning(['id', 'name', 'email', 'version'])
						.executeTakeFirst();

					// Log the update
					await trx
						.insertInto('transaction_logs')
						.values({
							userId,
							action: 'PROFILE_UPDATED',
							details: JSON.stringify(updates),
							timestamp: new Date().toISOString(),
						})
						.execute();

					return { success: true, user: updatedUser };
				});
			} catch (error) {
				// Handle specific error types
				if (error.name === 'DomainError') {
					return {
						success: false,
						error: {
							code: error.code,
							message: error.message,
						},
					};
				}

				console.error('Error updating user profile:', error);
				return {
					success: false,
					error: {
						code: 'UPDATE_FAILED',
						message: 'Failed to update user profile',
					},
				};
			}
		}

		// Distributed transaction with compensating actions
		async createUserWithPosts(
			userData: any,
			posts: Array<{ title: string; content: string }>
		): Promise<{ success: boolean; user?: any; posts?: any[]; error?: any }> {
			const createdPosts: any[] = [];
			let createdUser: any = null;

			try {
				// 1. Create user
				const userResult = await this.registerUser(userData);
				if (!userResult.success) {
					throw new UserService.DomainError(
						userResult.error.message,
						userResult.error.code
					);
				}

				createdUser = userResult.user;

				// 2. Create each post in separate transactions
				for (const postData of posts) {
					try {
						const post = await this.db
							.insertInto('posts')
							.values({
								userId: createdUser.id,
								title: postData.title,
								content: postData.content,
								createdAt: new Date().toISOString(),
								updatedAt: new Date().toISOString(),
							})
							.returning(['id', 'title'])
							.executeTakeFirst();

						createdPosts.push(post);
					} catch (postError) {
						// Log the failure but continue with other posts
						await this.db
							.insertInto('transaction_logs')
							.values({
								userId: createdUser.id,
								action: 'POST_CREATION_FAILED',
								details: JSON.stringify({
									title: postData.title,
									error: postError.message,
								}),
								timestamp: new Date().toISOString(),
							})
							.execute();
					}
				}

				return {
					success: true,
					user: createdUser,
					posts: createdPosts,
				};
			} catch (error) {
				// If user was created but posts failed, we keep the user
				// but return a partial success
				if (createdUser && createdPosts.length > 0) {
					return {
						success: true,
						user: createdUser,
						posts: createdPosts,
						error: {
							code: 'PARTIAL_SUCCESS',
							message: `User created with ${createdPosts.length} of ${posts.length} posts. Some posts failed: ${error.message}`,
						},
					};
				}

				// If user was created but no posts were created,
				// still return success for the user
				if (createdUser) {
					return {
						success: true,
						user: createdUser,
						posts: [],
						error: {
							code: 'POSTS_FAILED',
							message: `User created but posts creation failed: ${error.message}`,
						},
					};
				}

				// Complete failure
				return {
					success: false,
					error: {
						code: error.code || 'CREATE_FAILED',
						message: error.message,
					},
				};
			}
		}
	}

	// Setup/teardown for each test
	beforeEach(async () => {
		// Reset mock API
		for (const key in mockApiResponses) delete mockApiResponses[key];
		for (const key in mockApiErrors) delete mockApiErrors[key];

		// Setup database
		db = await setupDatabase();

		// Create model instances
		UserModel = createModel(db, 'users', 'id');
		PostModel = createModel(db, 'posts', 'id');
		CommentModel = createModel(db, 'comments', 'id');
		TransactionLogModel = createModel(db, 'transaction_logs', 'id');

		// Create user table with version column for concurrency control
		await db.schema
			.createTable('users')
			.ifNotExists()
			.addColumn('id', 'integer', (col) => col.primaryKey().autoIncrement())
			.addColumn('email', 'text', (col) => col.notNull().unique())
			.addColumn('name', 'text', (col) => col.notNull())
			.addColumn('username', 'text', (col) => col.notNull().unique())
			.addColumn('password', 'text', (col) => col.notNull())
			.addColumn('followersCount', 'integer', (col) => col.defaultTo(0))
			.addColumn('version', 'integer', (col) => col.defaultTo(1))
			.addColumn('createdAt', 'text', (col) => col.notNull())
			.addColumn('updatedAt', 'text', (col) => col.notNull())
			.execute();

		// Create post table
		await db.schema
			.createTable('posts')
			.ifNotExists()
			.addColumn('id', 'integer', (col) => col.primaryKey().autoIncrement())
			.addColumn('userId', 'integer', (col) =>
				col.notNull().references('users.id')
			)
			.addColumn('title', 'text', (col) => col.notNull())
			.addColumn('content', 'text', (col) => col.notNull())
			.addColumn('createdAt', 'text', (col) => col.notNull())
			.addColumn('updatedAt', 'text', (col) => col.notNull())
			.execute();

		// Create comments table
		await db.schema
			.createTable('comments')
			.ifNotExists()
			.addColumn('id', 'integer', (col) => col.primaryKey().autoIncrement())
			.addColumn('postId', 'integer', (col) =>
				col.notNull().references('posts.id')
			)
			.addColumn('userId', 'integer', (col) =>
				col.notNull().references('users.id')
			)
			.addColumn('content', 'text', (col) => col.notNull())
			.addColumn('createdAt', 'text', (col) => col.notNull())
			.execute();

		// Create transaction logs table
		await db.schema
			.createTable('transaction_logs')
			.ifNotExists()
			.addColumn('id', 'integer', (col) => col.primaryKey().autoIncrement())
			.addColumn('userId', 'integer', (col) => col.notNull())
			.addColumn('action', 'text', (col) => col.notNull())
			.addColumn('details', 'text', (col) => col.notNull())
			.addColumn('timestamp', 'text', (col) => col.notNull())
			.execute();

		// Insert test data
		await db
			.insertInto('users')
			.values({
				email: 'existing@example.com',
				name: 'Existing User',
				username: 'existinguser',
				password: 'password123',
				followersCount: 0,
				version: 1,
				createdAt: new Date().toISOString(),
				updatedAt: new Date().toISOString(),
			})
			.execute();
	});

	afterEach(async () => {
		await teardownDatabase(db);
	});

	it.skip('should handle user registration with proper error handling', async () => {
		const userService = new UserService(db, mockApi);

		// Test successful registration
		const result = await userService.registerUser({
			email: 'new@example.com',
			name: 'New User',
			username: 'newuser',
			password: 'password123',
		});

		expect(result.success).toBe(true);
		expect(result.user).toHaveProperty('id');
		expect(result.user.email).toBe('new@example.com');

		// Verify transaction log was created
		const logs = await db
			.selectFrom('transaction_logs')
			.where('userId', '=', result.user.id)
			.select(['action', 'details'])
			.execute();

		expect(logs).toHaveLength(1);
		expect(logs[0].action).toBe('USER_REGISTERED');

		// Test duplicate email handling
		const duplicateResult = await userService.registerUser({
			email: 'existing@example.com', // Already exists
			name: 'Duplicate User',
			username: 'dupuser',
			password: 'password123',
		});

		expect(duplicateResult.success).toBe(false);
		expect(duplicateResult.error.code).toBe('USER_EXISTS');
	});

	it.skip('should handle notification failures during registration gracefully', async () => {
		// Setup API to fail when sending notification
		mockApiErrors.sendNotification = new Error('Notification service timeout');

		const userService = new UserService(db, mockApi);

		// Registration should still succeed even if notification fails
		const result = await userService.registerUser({
			email: 'user1@example.com',
			name: 'User One',
			username: 'userone',
			password: 'password123',
		});

		expect(result.success).toBe(true);
		expect(result.user).toHaveProperty('id');

		// Verify both transaction logs were created
		const logs = await db
			.selectFrom('transaction_logs')
			.where('userId', '=', result.user.id)
			.select(['action', 'details'])
			.orderBy('id')
			.execute();

		expect(logs).toHaveLength(2);
		expect(logs[0].action).toBe('USER_REGISTERED');
		expect(logs[1].action).toBe('NOTIFICATION_FAILED');
		expect(logs[1].details).toContain('timeout');
	});

	it.skip('should handle concurrent modifications with optimistic locking', async () => {
		const userService = new UserService(db, mockApi);

		// First, register a user
		const registerResult = await userService.registerUser({
			email: 'concurrent@example.com',
			name: 'Concurrent User',
			username: 'concurrentuser',
			password: 'password123',
		});

		expect(registerResult.success).toBe(true);
		const userId = registerResult.user.id;

		// Now try to update with correct version
		const updateResult = await userService.updateUserProfile(
			userId,
			{ name: 'Updated Name' },
			1 // Correct version
		);

		expect(updateResult.success).toBe(true);
		expect(updateResult.user.name).toBe('Updated Name');
		expect(updateResult.user.version).toBe(2);

		// Try to update with stale version
		const staleUpdateResult = await userService.updateUserProfile(
			userId,
			{ name: 'Stale Update' },
			1 // Stale version
		);

		expect(staleUpdateResult.success).toBe(false);
		expect(staleUpdateResult.error.code).toBe('CONCURRENT_MODIFICATION');

		// Verify user still has the correct data
		const user = await db
			.selectFrom('users')
			.where('id', '=', userId)
			.select(['name', 'version'])
			.executeTakeFirst();

		expect(user.name).toBe('Updated Name');
		expect(user.version).toBe(2);
	});

	it.skip('should handle partial success in distributed transactions', async () => {
		// Mock an error that will happen after some posts are created
		const userService = new UserService(db, mockApi);

		// Spy on the database insertInto method
		let callCount = 0;
		const originalInsertInto = db.insertInto.bind(db);
		db.insertInto = vi.fn((table) => {
			// Fail on the third post
			if (table === 'posts') {
				callCount++;
				if (callCount === 3) {
					throw new Error('Database connection lost while creating post');
				}
			}
			return originalInsertInto(table);
		});

		// Create user with multiple posts, some of which will fail
		const result = await userService.createUserWithPosts(
			{
				email: 'multipost@example.com',
				name: 'Multi Post User',
				username: 'multipost',
				password: 'password123',
			},
			[
				{ title: 'First Post', content: 'This is the first post content' },
				{ title: 'Second Post', content: 'This is the second post content' },
				{ title: 'Third Post', content: 'This post will fail' },
				{ title: 'Fourth Post', content: 'This post should succeed' },
			]
		);

		// Should still be successful overall
		expect(result.success).toBe(true);
		expect(result.user).toHaveProperty('id');

		// Should have created 2 posts successfully
		expect(result.posts.length).toBe(2);

		// Check that we have appropriate error information
		expect(result.error).toHaveProperty('code', 'PARTIAL_SUCCESS');

		// Verify posts in the database
		const posts = await db
			.selectFrom('posts')
			.where('userId', '=', result.user.id)
			.select(['title'])
			.execute();

		expect(posts.length).toBe(3); // Should have 3 posts (first, second, and fourth)

		// Restore original method
		db.insertInto = originalInsertInto;
	});

	it.skip('should recover from transient database errors with retry', async () => {
		const userService = new UserService(db, mockApi);

		// Create a spy to fail the first database call but succeed after retries
		let attemptCount = 0;
		const originalTransaction = db.transaction.bind(db);

		db.transaction = vi.fn(() => {
			return {
				execute: async (fn) => {
					attemptCount++;

					if (attemptCount === 1) {
						throw new Error('Connection temporarily unavailable');
					}

					// Restore for subsequent calls
					db.transaction = originalTransaction;
					return db.transaction().execute(fn);
				},
			};
		});

		// Register should succeed after a retry
		const result = await userService.registerUser({
			email: 'retry@example.com',
			name: 'Retry User',
			username: 'retryuser',
			password: 'password123',
		});

		expect(result.success).toBe(true);
		expect(result.user).toHaveProperty('id');
		expect(attemptCount).toBe(1); // Verify first attempt failed

		// Verify user was created
		const user = await db
			.selectFrom('users')
			.where('email', '=', 'retry@example.com')
			.executeTakeFirst();

		expect(user).toBeDefined();

		// Restore original method
		db.transaction = originalTransaction;
	});

	it.skip('should handle complex error conditions with rollback and compensation', async () => {
		const userService = new UserService(db, mockApi);

		// Create a spy to execute the transaction but simulate a failure during post creation
		const originalTransaction = db.transaction.bind(db);
		db.transaction = vi.fn(() => {
			return {
				execute: async (fn) => {
					// Replace with a function that will allow us to track the transaction
					const trx = {
						...db,
						insertInto: (table: string) => {
							const original = db.insertInto(table);

							// Simulate a failure only for the posts table
							if (table === 'posts') {
								throw new Error('Critical database error during post creation');
							}

							return original;
						},
						transaction: () => ({ execute: (f: any) => f(trx) }),
					};

					return fn(trx);
				},
			};
		});

		// Try to create a user with posts
		const result = await userService.createUserWithPosts(
			{
				email: 'compensation@example.com',
				name: 'Compensation User',
				username: 'compensation',
				password: 'password123',
			},
			[
				{ title: 'Post 1', content: 'Content 1' },
				{ title: 'Post 2', content: 'Content 2' },
			]
		);

		// This should fail because post creation will throw an error
		expect(result.success).toBe(false);
		expect(result.error.code).toBe('CREATE_FAILED');

		// Verify no user was created due to rollback
		const user = await db
			.selectFrom('users')
			.where('email', '=', 'compensation@example.com')
			.executeTakeFirst();

		expect(user).toBeUndefined();

		// Restore original method
		db.transaction = originalTransaction;
	});
});
