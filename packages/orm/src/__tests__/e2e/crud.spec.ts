import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import createModel from '~/model';
import { setupTestDatabase, teardownTestDatabase } from '../fixtures/test-db';

// Helper function to convert date to SQLite format
const toSqliteDate = (date: Date): string => date.toISOString();

describe('CRUD Operations - E2E Tests', () => {
	let db: any;
	let UserModel: any;
	let PostModel: any;
	let CommentModel: any;

	beforeEach(async () => {
		// Setup test database
		db = await setupTestDatabase();

		// Create models
		UserModel = createModel(db, 'users', 'id');
		PostModel = createModel(db, 'posts', 'id');
		CommentModel = createModel(db, 'comments', 'id');

		// Setup database schema
		await setupSchema();
	});

	afterEach(async () => {
		await teardownTestDatabase(db);
	});

	// Helper function to set up schema
	async function setupSchema() {
		// Create users table
		await db.schema
			.createTable('users')
			.ifNotExists()
			.addColumn('id', 'integer', (col) => col.primaryKey().autoIncrement())
			.addColumn('email', 'text', (col) => col.unique().notNull())
			.addColumn('name', 'text', (col) => col.notNull())
			.addColumn('username', 'text', (col) => col.unique().notNull())
			.addColumn('password', 'text', (col) => col.notNull())
			.addColumn('followersCount', 'integer', (col) => col.defaultTo(0))
			.addColumn('createdAt', 'text')
			.addColumn('updatedAt', 'text')
			.execute();

		// Create posts table
		await db.schema
			.createTable('posts')
			.ifNotExists()
			.addColumn('id', 'integer', (col) => col.primaryKey().autoIncrement())
			.addColumn('title', 'text', (col) => col.notNull())
			.addColumn('content', 'text', (col) => col.notNull())
			.addColumn('userId', 'integer', (col) =>
				col.notNull().references('users.id')
			)
			.addColumn('status', 'text', (col) => col.notNull().defaultTo('draft'))
			.addColumn('createdAt', 'text')
			.addColumn('updatedAt', 'text')
			.execute();

		// Create comments table
		await db.schema
			.createTable('comments')
			.ifNotExists()
			.addColumn('id', 'integer', (col) => col.primaryKey().autoIncrement())
			.addColumn('userId', 'integer', (col) =>
				col.notNull().references('users.id')
			)
			.addColumn('postId', 'integer', (col) =>
				col.notNull().references('posts.id')
			)
			.addColumn('content', 'text', (col) => col.notNull())
			.addColumn('createdAt', 'text')
			.execute();
	}

	// Define a blog service class to represent a complete application workflow
	class BlogService {
		private db: any;

		constructor(db: any) {
			this.db = db;
		}

		// User Management
		async createUser(userData: {
			email: string;
			name: string;
			username: string;
			password: string;
		}) {
			try {
				// Check if username or email already exists
				const existing = await this.db
					.selectFrom('users')
					.where((eb) =>
						eb.or([
							eb('email', '=', userData.email),
							eb('username', '=', userData.username),
						])
					)
					.executeTakeFirst();

				if (existing) {
					return {
						success: false,
						error: 'Email or username already exists',
					};
				}

				// Insert the user
				const now = new Date();
				const user = await this.db
					.insertInto('users')
					.values({
						...userData,
						followersCount: 0,
						createdAt: toSqliteDate(now),
						updatedAt: toSqliteDate(now),
					})
					.returning(['id', 'email', 'name', 'username', 'createdAt'])
					.executeTakeFirst();

				return {
					success: true,
					user,
				};
			} catch (error) {
				return {
					success: false,
					error: `Failed to create user: ${error.message}`,
				};
			}
		}

		async getUserProfile(userId: number) {
			try {
				// Get user
				const user = await this.db
					.selectFrom('users')
					.where('id', '=', userId)
					.select([
						'id',
						'email',
						'name',
						'username',
						'followersCount',
						'createdAt',
					])
					.executeTakeFirst();

				if (!user) {
					return {
						success: false,
						error: 'User not found',
					};
				}

				// Get user's posts
				const posts = await this.db
					.selectFrom('posts')
					.where('userId', '=', userId)
					.select(['id', 'title', 'status', 'createdAt'])
					.execute();

				// Get user's comments count
				const commentsCountResult = await this.db
					.selectFrom('comments')
					.where('userId', '=', userId)
					.select((eb) => [eb.fn.count('id').as('count')])
					.executeTakeFirst();

				const commentsCount = Number(commentsCountResult?.count || 0);

				return {
					success: true,
					profile: {
						...user,
						posts,
						commentsCount,
					},
				};
			} catch (error) {
				return {
					success: false,
					error: `Failed to get user profile: ${error.message}`,
				};
			}
		}

		async updateUserProfile(
			userId: number,
			updates: {
				name?: string;
				email?: string;
			}
		) {
			try {
				// Verify user exists
				const user = await this.db
					.selectFrom('users')
					.where('id', '=', userId)
					.executeTakeFirst();

				if (!user) {
					return {
						success: false,
						error: 'User not found',
					};
				}

				// Update user
				const updated = await this.db
					.updateTable('users')
					.set({
						...updates,
						updatedAt: toSqliteDate(new Date()),
					})
					.where('id', '=', userId)
					.returning(['id', 'email', 'name', 'username', 'updatedAt'])
					.executeTakeFirst();

				return {
					success: true,
					user: updated,
				};
			} catch (error) {
				return {
					success: false,
					error: `Failed to update profile: ${error.message}`,
				};
			}
		}

		// Posts Management
		async createPost(
			userId: number,
			postData: {
				title: string;
				content: string;
				status?: 'draft' | 'published';
			}
		) {
			try {
				// Verify user exists
				const user = await this.db
					.selectFrom('users')
					.where('id', '=', userId)
					.executeTakeFirst();

				if (!user) {
					return {
						success: false,
						error: 'User not found',
					};
				}

				// Create post
				const now = new Date();
				const post = await this.db
					.insertInto('posts')
					.values({
						userId,
						title: postData.title,
						content: postData.content,
						status: postData.status || 'draft',
						createdAt: toSqliteDate(now),
						updatedAt: toSqliteDate(now),
					})
					.returning(['id', 'title', 'status', 'createdAt'])
					.executeTakeFirst();

				return {
					success: true,
					post,
				};
			} catch (error) {
				return {
					success: false,
					error: `Failed to create post: ${error.message}`,
				};
			}
		}

		async getPostDetails(postId: number) {
			try {
				// Get post with author info
				const post = await this.db
					.selectFrom('posts as p')
					.innerJoin('users as u', 'u.id', 'p.userId')
					.where('p.id', '=', postId)
					.select([
						'p.id',
						'p.title',
						'p.content',
						'p.status',
						'p.createdAt',
						'u.id as authorId',
						'u.name as authorName',
						'u.username as authorUsername',
					])
					.executeTakeFirst();

				if (!post) {
					return {
						success: false,
						error: 'Post not found',
					};
				}

				// Get comments with commenter info
				const comments = await this.db
					.selectFrom('comments as c')
					.innerJoin('users as u', 'u.id', 'c.userId')
					.where('c.postId', '=', postId)
					.select([
						'c.id',
						'c.content',
						'c.createdAt',
						'u.id as userId',
						'u.name as userName',
						'u.username as userUsername',
					])
					.orderBy('c.createdAt', 'asc')
					.execute();

				return {
					success: true,
					post: {
						...post,
						comments,
					},
				};
			} catch (error) {
				return {
					success: false,
					error: `Failed to get post details: ${error.message}`,
				};
			}
		}

		async updatePost(
			postId: number,
			userId: number,
			updates: {
				title?: string;
				content?: string;
				status?: 'draft' | 'published';
			}
		) {
			try {
				// Verify post exists and belongs to user
				const post = await this.db
					.selectFrom('posts')
					.where('id', '=', postId)
					.where('userId', '=', userId)
					.executeTakeFirst();

				if (!post) {
					return {
						success: false,
						error: 'Post not found or you do not have permission to update it',
					};
				}

				// Update post
				const updated = await this.db
					.updateTable('posts')
					.set({
						...updates,
						updatedAt: toSqliteDate(new Date()),
					})
					.where('id', '=', postId)
					.returning(['id', 'title', 'status', 'updatedAt'])
					.executeTakeFirst();

				return {
					success: true,
					post: updated,
				};
			} catch (error) {
				return {
					success: false,
					error: `Failed to update post: ${error.message}`,
				};
			}
		}

		async deletePost(postId: number, userId: number) {
			try {
				// Verify post exists and belongs to user
				const post = await this.db
					.selectFrom('posts')
					.where('id', '=', postId)
					.where('userId', '=', userId)
					.executeTakeFirst();

				if (!post) {
					return {
						success: false,
						error: 'Post not found or you do not have permission to delete it',
					};
				}

				// Delete post's comments first (handle cascading manually for this example)
				await this.db
					.deleteFrom('comments')
					.where('postId', '=', postId)
					.execute();

				// Delete the post
				await this.db.deleteFrom('posts').where('id', '=', postId).execute();

				return {
					success: true,
				};
			} catch (error) {
				return {
					success: false,
					error: `Failed to delete post: ${error.message}`,
				};
			}
		}

		// Comments Management
		async addComment(userId: number, postId: number, content: string) {
			try {
				// Verify user and post exist
				const user = await this.db
					.selectFrom('users')
					.where('id', '=', userId)
					.executeTakeFirst();

				if (!user) {
					return {
						success: false,
						error: 'User not found',
					};
				}

				const post = await this.db
					.selectFrom('posts')
					.where('id', '=', postId)
					.executeTakeFirst();

				if (!post) {
					return {
						success: false,
						error: 'Post not found',
					};
				}

				// Add comment
				const now = new Date();
				const comment = await this.db
					.insertInto('comments')
					.values({
						userId,
						postId,
						content,
						createdAt: toSqliteDate(now),
					})
					.returning(['id', 'content', 'createdAt'])
					.executeTakeFirst();

				return {
					success: true,
					comment,
				};
			} catch (error) {
				return {
					success: false,
					error: `Failed to add comment: ${error.message}`,
				};
			}
		}

		async deleteComment(commentId: number, userId: number) {
			try {
				// Verify comment exists and belongs to user
				const comment = await this.db
					.selectFrom('comments')
					.where('id', '=', commentId)
					.where('userId', '=', userId)
					.executeTakeFirst();

				if (!comment) {
					return {
						success: false,
						error:
							'Comment not found or you do not have permission to delete it',
					};
				}

				// Delete the comment
				await this.db
					.deleteFrom('comments')
					.where('id', '=', commentId)
					.execute();

				return {
					success: true,
				};
			} catch (error) {
				return {
					success: false,
					error: `Failed to delete comment: ${error.message}`,
				};
			}
		}

		// Feed (combines multiple queries)
		async getFeed({
			page = 1,
			limit = 10,
		}: { page?: number; limit?: number } = {}) {
			try {
				const offset = (page - 1) * limit;

				// Get published posts with author and comment count
				const posts = await this.db
					.selectFrom('posts as p')
					.innerJoin('users as u', 'u.id', 'p.userId')
					.leftJoin(
						(eb) => {
							return eb
								.selectFrom('comments as c')
								.select((eb2) => [
									'c.postId',
									eb2.fn.count('c.id').as('commentCount'),
								])
								.groupBy('c.postId')
								.as('cc');
						},
						(join) => join.on('cc.postId', '=', 'p.id')
					)
					.where('p.status', '=', 'published')
					.select([
						'p.id',
						'p.title',
						'p.createdAt',
						'u.id as authorId',
						'u.name as authorName',
						'u.username as authorUsername',
						'cc.commentCount',
					])
					.orderBy('p.createdAt', 'desc')
					.limit(limit)
					.offset(offset)
					.execute();

				// Format the response
				const formattedPosts = posts.map((post) => ({
					...post,
					commentCount: Number(post.commentCount || 0),
				}));

				return {
					success: true,
					posts: formattedPosts,
					pagination: {
						page,
						limit,
						hasMore: formattedPosts.length === limit,
					},
				};
			} catch (error) {
				return {
					success: false,
					error: `Failed to get feed: ${error.message}`,
				};
			}
		}
	}

	// E2E Test for complete blog workflow
	it.skip('should support a complete blog workflow with multiple users and posts', async () => {
		// Create blog service
		const blogService = new BlogService(db);

		// 1. Create users
		const authorResult = await blogService.createUser({
			email: 'author@example.com',
			name: 'Test Author',
			username: 'testauthor',
			password: 'password123',
		});

		expect(authorResult.success).toBe(true);
		const authorId = authorResult.user.id;

		const readerResult = await blogService.createUser({
			email: 'reader@example.com',
			name: 'Test Reader',
			username: 'testreader',
			password: 'password123',
		});

		expect(readerResult.success).toBe(true);
		const readerId = readerResult.user.id;

		// 2. Author creates posts
		const post1Result = await blogService.createPost(authorId, {
			title: 'First Post',
			content: 'This is the first post content',
			status: 'published',
		});

		expect(post1Result.success).toBe(true);
		const post1Id = post1Result.post.id;

		const post2Result = await blogService.createPost(authorId, {
			title: 'Second Post',
			content: 'This is the second post content',
			status: 'draft', // Draft, should not appear in feed
		});

		expect(post2Result.success).toBe(true);
		const post2Id = post2Result.post.id;

		// 3. Reader adds comments to the published post
		const comment1Result = await blogService.addComment(
			readerId,
			post1Id,
			'Great post!'
		);
		expect(comment1Result.success).toBe(true);
		const comment1Id = comment1Result.comment.id;

		// 4. Author also comments on their own post
		const comment2Result = await blogService.addComment(
			authorId,
			post1Id,
			'Thanks for reading!'
		);
		expect(comment2Result.success).toBe(true);

		// 5. Get post details with comments
		const postDetailsResult = await blogService.getPostDetails(post1Id);
		expect(postDetailsResult.success).toBe(true);
		expect(postDetailsResult.post.title).toBe('First Post');
		expect(postDetailsResult.post.comments).toHaveLength(2);
		expect(postDetailsResult.post.comments[0].content).toBe('Great post!');
		expect(postDetailsResult.post.comments[1].content).toBe(
			'Thanks for reading!'
		);

		// 6. Update post title
		const updatePostResult = await blogService.updatePost(post1Id, authorId, {
			title: 'Updated First Post',
		});

		expect(updatePostResult.success).toBe(true);
		expect(updatePostResult.post.title).toBe('Updated First Post');

		// 7. Publish the draft post
		const publishDraftResult = await blogService.updatePost(post2Id, authorId, {
			status: 'published',
		});

		expect(publishDraftResult.success).toBe(true);
		expect(publishDraftResult.post.status).toBe('published');

		// 8. Get the feed (should show both posts now)
		const feedResult = await blogService.getFeed();
		expect(feedResult.success).toBe(true);
		expect(feedResult.posts).toHaveLength(2);

		// Second post should be first (more recent)
		expect(feedResult.posts[0].id).toBe(post2Id);
		expect(feedResult.posts[1].id).toBe(post1Id);
		expect(feedResult.posts[1].commentCount).toBe(2);

		// 9. Get author profile
		const authorProfileResult = await blogService.getUserProfile(authorId);
		expect(authorProfileResult.success).toBe(true);
		expect(authorProfileResult.profile.posts).toHaveLength(2);
		expect(authorProfileResult.profile.commentsCount).toBe(1);

		// 10. Reader deletes their comment
		const deleteCommentResult = await blogService.deleteComment(
			comment1Id,
			readerId
		);
		expect(deleteCommentResult.success).toBe(true);

		// 11. Verify comment was deleted
		const updatedPostDetailsResult = await blogService.getPostDetails(post1Id);
		expect(updatedPostDetailsResult.post.comments).toHaveLength(1);
		expect(updatedPostDetailsResult.post.comments[0].content).toBe(
			'Thanks for reading!'
		);

		// 12. Author deletes one post
		const deletePostResult = await blogService.deletePost(post2Id, authorId);
		expect(deletePostResult.success).toBe(true);

		// 13. Verify post was deleted
		const finalFeedResult = await blogService.getFeed();
		expect(finalFeedResult.posts).toHaveLength(1);
		expect(finalFeedResult.posts[0].id).toBe(post1Id);
	});

	// Test validation and error handling
	it.skip('should handle validation and errors correctly', async () => {
		const blogService = new BlogService(db);

		// 1. Try to create user with duplicate email
		const user1Result = await blogService.createUser({
			email: 'duplicate@example.com',
			name: 'User One',
			username: 'userone',
			password: 'password123',
		});

		expect(user1Result.success).toBe(true);

		const duplicateResult = await blogService.createUser({
			email: 'duplicate@example.com', // Same email
			name: 'User Two',
			username: 'usertwo',
			password: 'password123',
		});

		expect(duplicateResult.success).toBe(false);
		expect(duplicateResult.error).toContain('already exists');

		// 2. Try to get non-existent user
		const nonExistentUserResult = await blogService.getUserProfile(999);
		expect(nonExistentUserResult.success).toBe(false);
		expect(nonExistentUserResult.error).toContain('not found');

		// 3. Try to create post for non-existent user
		const invalidPostResult = await blogService.createPost(999, {
			title: 'Invalid Post',
			content: 'This should fail',
		});

		expect(invalidPostResult.success).toBe(false);
		expect(invalidPostResult.error).toContain('not found');

		// 4. Try to update post that doesn't belong to user
		const user1Id = user1Result.user.id;

		// Create user2
		const user2Result = await blogService.createUser({
			email: 'another@example.com',
			name: 'Another User',
			username: 'anotheruser',
			password: 'password123',
		});

		expect(user2Result.success).toBe(true);
		const user2Id = user2Result.user.id;

		// User1 creates post
		const postResult = await blogService.createPost(user1Id, {
			title: 'User 1 Post',
			content: 'This belongs to user 1',
		});

		expect(postResult.success).toBe(true);
		const postId = postResult.post.id;

		// User2 tries to update user1's post
		const unauthorizedUpdateResult = await blogService.updatePost(
			postId,
			user2Id,
			{
				title: 'Unauthorized Update',
			}
		);

		expect(unauthorizedUpdateResult.success).toBe(false);
		expect(unauthorizedUpdateResult.error).toContain('permission');

		// 5. Try to delete post that doesn't belong to user
		const unauthorizedDeleteResult = await blogService.deletePost(
			postId,
			user2Id
		);
		expect(unauthorizedDeleteResult.success).toBe(false);
		expect(unauthorizedDeleteResult.error).toContain('permission');
	});

	// Test pagination
	it.skip('should support pagination for the feed', async () => {
		const blogService = new BlogService(db);

		// Create a user
		const userResult = await blogService.createUser({
			email: 'pagination@example.com',
			name: 'Pagination Test',
			username: 'pagination',
			password: 'password123',
		});

		const userId = userResult.user.id;

		// Create 15 posts
		for (let i = 1; i <= 15; i++) {
			await blogService.createPost(userId, {
				title: `Post ${i}`,
				content: `Content for post ${i}`,
				status: 'published',
			});
		}

		// Get first page (10 posts by default)
		const page1Result = await blogService.getFeed({ page: 1 });
		expect(page1Result.success).toBe(true);
		expect(page1Result.posts).toHaveLength(10);
		expect(page1Result.pagination.hasMore).toBe(true);

		// First post should be post 15 (newest)
		expect(page1Result.posts[0].title).toBe('Post 15');

		// Get second page (5 remaining posts)
		const page2Result = await blogService.getFeed({ page: 2 });
		expect(page2Result.success).toBe(true);
		expect(page2Result.posts).toHaveLength(5);
		expect(page2Result.pagination.hasMore).toBe(false);

		// First post on page 2 should be post 5
		expect(page2Result.posts[0].title).toBe('Post 5');

		// Test with custom limit
		const customLimitResult = await blogService.getFeed({ limit: 5 });
		expect(customLimitResult.success).toBe(true);
		expect(customLimitResult.posts).toHaveLength(5);
		expect(customLimitResult.pagination.hasMore).toBe(true);
	});
});
