import { sql } from 'kysely';
import {
	setupTestDatabase,
	teardownTestDatabase,
} from 'tests/fixtures/test-db';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import createModel from '~/model';

// Helper function to convert date to SQLite format
const toSqliteDate = (date: Date): string => date.toISOString();

describe('Advanced Operations - E2E Tests', () => {
	let db: any;
	let UserModel: any;
	let ArticleModel: any;

	beforeEach(async () => {
		db = await setupTestDatabase();

		// Create models
		UserModel = createModel(db, 'users', 'id');
		ArticleModel = createModel(db, 'articles', 'id');

		// Set up database schema
		await setupSchema();

		// Seed with test data
		await seedTestData();
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
			.addColumn('username', 'text', (col) => col.notNull())
			.addColumn('password', 'text', (col) => col.notNull())
			.addColumn('status', 'text', (col) => col.notNull().defaultTo('active'))
			.addColumn('followersCount', 'integer', (col) => col.defaultTo(0))
			.addColumn('version', 'integer', (col) => col.defaultTo(1))
			.addColumn('createdAt', 'text')
			.addColumn('updatedAt', 'text')
			.execute();

		// Create articles table
		await db.schema
			.createTable('articles')
			.ifNotExists()
			.addColumn('id', 'text', (col) => col.primaryKey())
			.addColumn('title', 'text', (col) => col.notNull())
			.addColumn('slug', 'text', (col) => col.notNull())
			.addColumn('content', 'text', (col) => col.notNull())
			.addColumn('userId', 'integer', (col) =>
				col.notNull().references('users.id')
			)
			.addColumn('status', 'text', (col) => col.notNull().defaultTo('draft'))
			.addColumn('viewCount', 'integer', (col) => col.defaultTo(0))
			.addColumn('createdAt', 'text')
			.addColumn('updatedAt', 'text')
			.execute();

		// Create user-article relationship table for favorites
		await db.schema
			.createTable('user_favorites')
			.ifNotExists()
			.addColumn('user_id', 'integer', (col) =>
				col.notNull().references('users.id')
			)
			.addColumn('article_id', 'text', (col) =>
				col.notNull().references('articles.id')
			)
			.addPrimaryKeyConstraint('pk_user_favorites', ['user_id', 'article_id'])
			.execute();

		// Create comments table
		await db.schema
			.createTable('comments')
			.ifNotExists()
			.addColumn('id', 'integer', (col) => col.primaryKey().autoIncrement())
			.addColumn('content', 'text', (col) => col.notNull())
			.addColumn('userId', 'integer', (col) =>
				col.notNull().references('users.id')
			)
			.addColumn('articleId', 'text', (col) =>
				col.notNull().references('articles.id')
			)
			.addColumn('createdAt', 'text')
			.execute();

		// Create tags table
		await db.schema
			.createTable('tags')
			.ifNotExists()
			.addColumn('id', 'integer', (col) => col.primaryKey().autoIncrement())
			.addColumn('name', 'text', (col) => col.unique().notNull())
			.execute();

		// Create article_tags junction table
		await db.schema
			.createTable('article_tags')
			.ifNotExists()
			.addColumn('article_id', 'text', (col) =>
				col.notNull().references('articles.id')
			)
			.addColumn('tag_id', 'integer', (col) =>
				col.notNull().references('tags.id')
			)
			.addPrimaryKeyConstraint('pk_article_tags', ['article_id', 'tag_id'])
			.execute();
	}

	// Helper function to seed test data
	async function seedTestData() {
		const now = new Date();

		// Insert users
		const users = await Promise.all([
			// Author
			db
				.insertInto('users')
				.values({
					email: 'author@example.com',
					name: 'Test Author',
					username: 'testauthor',
					password: 'password',
					status: 'active',
					followersCount: 5,
					version: 1,
					createdAt: toSqliteDate(now),
					updatedAt: toSqliteDate(now),
				})
				.returning('id')
				.executeTakeFirstOrThrow(),

			// Reader
			db
				.insertInto('users')
				.values({
					email: 'reader@example.com',
					name: 'Test Reader',
					username: 'testreader',
					password: 'password',
					status: 'active',
					followersCount: 0,
					version: 1,
					createdAt: toSqliteDate(now),
					updatedAt: toSqliteDate(now),
				})
				.returning('id')
				.executeTakeFirstOrThrow(),

			// Commenter
			db
				.insertInto('users')
				.values({
					email: 'commenter@example.com',
					name: 'Test Commenter',
					username: 'testcommenter',
					password: 'password',
					status: 'active',
					followersCount: 2,
					version: 1,
					createdAt: toSqliteDate(now),
					updatedAt: toSqliteDate(now),
				})
				.returning('id')
				.executeTakeFirstOrThrow(),
		]);

		const authorId = users[0].id;
		const readerId = users[1].id;
		const commenterId = users[2].id;

		// Insert articles
		const articles = await Promise.all([
			db
				.insertInto('articles')
				.values({
					id: 'article1',
					title: 'JavaScript Tips',
					slug: 'javascript-tips',
					content: 'This is an article about JavaScript tips',
					userId: authorId,
					status: 'published',
					viewCount: 120,
					createdAt: toSqliteDate(now),
					updatedAt: toSqliteDate(now),
				})
				.returning('id')
				.executeTakeFirstOrThrow(),

			db
				.insertInto('articles')
				.values({
					id: 'article2',
					title: 'TypeScript Tricks',
					slug: 'typescript-tricks',
					content: 'This is an article about TypeScript tricks',
					userId: authorId,
					status: 'published',
					viewCount: 85,
					createdAt: toSqliteDate(now),
					updatedAt: toSqliteDate(now),
				})
				.returning('id')
				.executeTakeFirstOrThrow(),

			db
				.insertInto('articles')
				.values({
					id: 'article3',
					title: 'React Patterns',
					slug: 'react-patterns',
					content: 'This is an article about React patterns',
					userId: authorId,
					status: 'draft',
					viewCount: 0,
					createdAt: toSqliteDate(now),
					updatedAt: toSqliteDate(now),
				})
				.returning('id')
				.executeTakeFirstOrThrow(),
		]);

		// Insert favorites
		await sql`INSERT INTO user_favorites (user_id, article_id) VALUES (${readerId}, 'article1')`.execute(
			db
		);
		await sql`INSERT INTO user_favorites (user_id, article_id) VALUES (${readerId}, 'article2')`.execute(
			db
		);
		await sql`INSERT INTO user_favorites (user_id, article_id) VALUES (${commenterId}, 'article1')`.execute(
			db
		);

		// Insert comments
		await db
			.insertInto('comments')
			.values([
				{
					content: 'Great article!',
					userId: readerId,
					articleId: 'article1',
					createdAt: toSqliteDate(now),
				},
				{
					content: 'This was very helpful',
					userId: commenterId,
					articleId: 'article1',
					createdAt: toSqliteDate(now),
				},
				{
					content: 'Looking forward to more',
					userId: readerId,
					articleId: 'article2',
					createdAt: toSqliteDate(now),
				},
			])
			.execute();

		// Insert tags
		const tags = await db
			.insertInto('tags')
			.values([
				{ name: 'JavaScript' },
				{ name: 'TypeScript' },
				{ name: 'React' },
				{ name: 'Tutorial' },
				{ name: 'Advanced' },
			])
			.returning(['id', 'name'])
			.execute();

		// Get tag IDs by name
		const getTagId = (name: string) => {
			const tag = tags.find((t) => t.name === name);
			return tag ? tag.id : null;
		};

		// Insert article tags
		await db
			.insertInto('article_tags')
			.values([
				{ article_id: 'article1', tag_id: getTagId('JavaScript') },
				{ article_id: 'article1', tag_id: getTagId('Tutorial') },
				{ article_id: 'article2', tag_id: getTagId('TypeScript') },
				{ article_id: 'article2', tag_id: getTagId('Advanced') },
				{ article_id: 'article3', tag_id: getTagId('React') },
				{ article_id: 'article3', tag_id: getTagId('Advanced') },
			])
			.execute();
	}

	// E2E test for a blog service with complex queries
	it('should implement a complete blog service with complex queries', async () => {
		// Create service layer functions

		// 1. Get published articles with comments count, author info, and favorite count
		async function getPublishedArticles() {
			return db
				.selectFrom('articles as a')
				.innerJoin('users as u', 'u.id', 'a.userId')
				.leftJoin(
					db
						.selectFrom('comments')
						.select([
							'articleId',
							sql`count(*) as commentCount`.as('commentCount'),
						])
						.groupBy('articleId')
						.as('c'),
					'c.articleId',
					'a.id'
				)
				.leftJoin(
					db
						.selectFrom('user_favorites')
						.select([
							'article_id',
							sql`count(*) as favoriteCount`.as('favoriteCount'),
						])
						.groupBy('article_id')
						.as('f'),
					'f.article_id',
					'a.id'
				)
				.select([
					'a.id as articleId',
					'a.title',
					'a.slug',
					'a.viewCount',
					'a.createdAt',
					'u.id as authorId',
					'u.name as authorName',
					'u.username as authorUsername',
					'c.commentCount',
					'f.favoriteCount',
				])
				.where('a.status', '=', 'published')
				.orderBy('a.createdAt', 'desc')
				.execute();
		}

		// 2. Get article details with tags, comments, and favorite status
		async function getArticleDetails(slug: string, currentUserId?: number) {
			// First get the article with author
			const article = await db
				.selectFrom('articles as a')
				.innerJoin('users as u', 'u.id', 'a.userId')
				.leftJoin(
					db
						.selectFrom('user_favorites')
						.select([
							'article_id',
							sql`count(*) as favoriteCount`.as('favoriteCount'),
						])
						.groupBy('article_id')
						.as('f'),
					'f.article_id',
					'a.id'
				)
				.select([
					'a.id as articleId',
					'a.title',
					'a.slug',
					'a.content',
					'a.viewCount',
					'a.createdAt',
					'u.id as authorId',
					'u.name as authorName',
					'u.username as authorUsername',
					'f.favoriteCount',
					sql`CASE WHEN EXISTS (
            SELECT 1 FROM user_favorites 
            WHERE article_id = a.id AND user_id = ${currentUserId || 0}
          ) THEN 1 ELSE 0 END`.as('favorited'),
				])
				.where('a.slug', '=', slug)
				.executeTakeFirst();

			if (!article) {
				return null;
			}

			// Get the tags for this article
			const tags = await db
				.selectFrom('tags as t')
				.innerJoin('article_tags as at', 'at.tag_id', 't.id')
				.select(['t.id as tagId', 't.name as tagName'])
				.where('at.article_id', '=', article.articleId)
				.execute();

			// Get comments with author info
			const comments = await db
				.selectFrom('comments as c')
				.innerJoin('users as u', 'u.id', 'c.userId')
				.select([
					'c.id as commentId',
					'c.content',
					'c.createdAt',
					'u.id as userId',
					'u.name as userName',
					'u.username as userUsername',
				])
				.where('c.articleId', '=', article.articleId)
				.orderBy('c.createdAt', 'asc')
				.execute();

			// Construct full article response
			return {
				...article,
				tags,
				comments,
			};
		}

		// 3. Toggle favorite status
		async function toggleFavorite(userId: number, articleId: string) {
			// Check if already favorited
			const existing = await db
				.selectFrom('user_favorites')
				.selectAll()
				.where('user_id', '=', userId)
				.where('article_id', '=', articleId)
				.executeTakeFirst();

			if (existing) {
				// Remove favorite
				await db
					.deleteFrom('user_favorites')
					.where('user_id', '=', userId)
					.where('article_id', '=', articleId)
					.execute();

				return false; // Not favorited anymore
			} else {
				// Add favorite
				await db
					.insertInto('user_favorites')
					.values({
						user_id: userId,
						article_id: articleId,
					})
					.execute();

				return true; // Now favorited
			}
		}

		// 4. Update article with optimistic locking
		async function updateArticle(
			articleId: string,
			userId: number,
			data: { title?: string; content?: string; status?: string },
			expectedVersion: number
		) {
			// First get the article and verify ownership
			const article = await db
				.selectFrom('articles')
				.select(['id', 'userId', 'version'])
				.where('id', '=', articleId)
				.executeTakeFirst();

			if (!article) {
				throw new Error('Article not found');
			}

			if (article.userId !== userId) {
				throw new Error('Not authorized to edit this article');
			}

			if (article.version !== expectedVersion) {
				throw new Error('Article has been modified since last retrieved');
			}

			// Update article with version increment
			return db.transaction().execute(async (trx) => {
				// Update the article
				const updated = await trx
					.updateTable('articles')
					.set({
						...data,
						version: sql`version + 1`,
						updatedAt: toSqliteDate(new Date()),
					})
					.where('id', '=', articleId)
					.where('version', '=', expectedVersion)
					.returning(['id', 'title', 'content', 'status', 'version'])
					.executeTakeFirst();

				if (!updated) {
					throw new Error('Concurrent update detected');
				}

				return updated;
			});
		}

		// 5. Search articles with filters and pagination
		async function searchArticles({
			term,
			tag,
			author,
			favorited,
			limit = 10,
			offset = 0,
		}: {
			term?: string;
			tag?: string;
			author?: string;
			favorited?: string;
			limit?: number;
			offset?: number;
		}) {
			let query = db
				.selectFrom('articles as a')
				.innerJoin('users as u', 'u.id', 'a.userId')
				.leftJoin(
					db
						.selectFrom('comments')
						.select([
							'articleId',
							sql`count(*) as commentCount`.as('commentCount'),
						])
						.groupBy('articleId')
						.as('c'),
					'c.articleId',
					'a.id'
				)
				.leftJoin(
					db
						.selectFrom('user_favorites')
						.select([
							'article_id',
							sql`count(*) as favoriteCount`.as('favoriteCount'),
						])
						.groupBy('article_id')
						.as('f'),
					'f.article_id',
					'a.id'
				);

			// Apply search term filter
			if (term) {
				query = query.where((eb) =>
					eb.or([
						eb('a.title', 'like', `%${term}%`),
						eb('a.content', 'like', `%${term}%`),
					])
				);
			}

			// Apply tag filter
			if (tag) {
				query = query
					.innerJoin('article_tags as at', 'at.article_id', 'a.id')
					.innerJoin('tags as t', 't.id', 'at.tag_id')
					.where('t.name', '=', tag);
			}

			// Apply author filter
			if (author) {
				query = query.where('u.username', '=', author);
			}

			// Apply favorited filter
			if (favorited) {
				query = query.innerJoin(
					db
						.selectFrom('user_favorites as uf')
						.innerJoin('users as fu', 'fu.id', 'uf.user_id')
						.select(['uf.article_id'])
						.where('fu.username', '=', favorited)
						.as('ff'),
					'ff.article_id',
					'a.id'
				);
			}

			// Only published articles
			query = query.where('a.status', '=', 'published');

			// Select the fields we want
			query = query.select([
				'a.id as articleId',
				'a.title',
				'a.slug',
				'a.viewCount',
				'a.createdAt',
				'u.id as authorId',
				'u.name as authorName',
				'u.username as authorUsername',
				'c.commentCount',
				'f.favoriteCount',
			]);

			// Apply pagination
			query = query.orderBy('a.createdAt', 'desc').limit(limit).offset(offset);

			return query.execute();
		}

		// Test the service functions

		// Test 1: Get published articles
		const publishedArticles = await getPublishedArticles();
		expect(publishedArticles.length).toBe(2); // Only the published ones
		expect(publishedArticles[0].favoriteCount).toBe(2); // 2 users favorited article1
		expect(publishedArticles[1].favoriteCount).toBe(1); // 1 user favorited article2
		expect(publishedArticles[0].commentCount).toBe(2); // 2 comments on article1

		// Test 2: Get article details
		const articleDetails = await getArticleDetails('javascript-tips', 2); // As reader (id=2)
		expect(articleDetails.articleId).toBe('article1');
		expect(articleDetails.favorited).toBe(1); // Reader has favorited this
		expect(articleDetails.tags.length).toBe(2); // Has 2 tags
		expect(articleDetails.comments.length).toBe(2); // Has 2 comments

		// Test 3: Toggle favorite
		const isNowFavorited = await toggleFavorite(2, 'article3'); // Reader favorites article3
		expect(isNowFavorited).toBe(true);

		const isNotFavorited = await toggleFavorite(2, 'article1'); // Reader unfavorites article1
		expect(isNotFavorited).toBe(false);

		// Test 4: Update article with optimistic locking
		const updated = await updateArticle(
			'article3',
			1,
			{
				title: 'Updated React Patterns',
				status: 'published',
			},
			1
		);
		expect(updated.title).toBe('Updated React Patterns');
		expect(updated.status).toBe('published');
		expect(updated.version).toBe(2);

		// Test 5: Search articles
		const jsArticles = await searchArticles({ tag: 'JavaScript' });
		expect(jsArticles.length).toBe(1);
		expect(jsArticles[0].articleId).toBe('article1');

		const readerFavoritedArticles = await searchArticles({
			favorited: 'testreader',
		});
		// Should now be 2 due to removing article1 favorite and adding article3
		expect(readerFavoritedArticles.length).toBe(2);

		const termSearch = await searchArticles({ term: 'React' });
		expect(termSearch.length).toBe(1); // Now published after update
		expect(termSearch[0].title).toBe('Updated React Patterns');
	});
});
