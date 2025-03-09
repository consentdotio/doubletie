import SQLite from 'better-sqlite3';
import { Kysely, SqliteDialect } from 'kysely';

/**
 * Creates an in-memory SQLite database for unit/integration tests
 */
export async function setupTestDatabase() {
	// Create an in-memory SQLite database
	const sqlite = new SQLite(':memory:');

	// Create Kysely instance with SQLite dialect
	const db = new Kysely({
		dialect: new SqliteDialect({
			database: sqlite,
		}),
	});

	// Create test tables
	await setupTestTables(db);

	return db;
}

/**
 * Set up test tables in the SQLite database
 */
async function setupTestTables(db: Kysely<any>) {
	// Create users table
	await db.schema
		.createTable('users')
		.ifNotExists()
		.addColumn('id', 'integer', (col) => col.primaryKey().autoIncrement())
		.addColumn('name', 'text', (col) => col.notNull())
		.addColumn('email', 'text', (col) => col.notNull())
		.addColumn('slug', 'text')
		.addColumn('status', 'text', (col) => col.defaultTo('active'))
		.addColumn('created_at', 'text', (col) =>
			col.defaultTo('CURRENT_TIMESTAMP')
		)
		.execute();

	// Create user_favorites table
	await db.schema
		.createTable('user_favorites')
		.ifNotExists()
		.addColumn('user_id', 'integer', (col) =>
			col.notNull().references('users.id')
		)
		.addColumn('article_id', 'text', (col) => col.notNull())
		.execute();

	return db;
}

/**
 * Tears down the test database after tests
 */
export async function teardownTestDatabase(db: Kysely<any>) {
	// For in-memory SQLite, we can just destroy the connection
	// The database will be deleted automatically when the connection closes
	await db.destroy();
}
