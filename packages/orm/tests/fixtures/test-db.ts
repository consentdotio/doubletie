import { Kysely, PostgresDialect } from 'kysely';
import { Pool } from 'pg';

/**
 * Creates an in-memory test database for unit/integration tests
 */
export async function setupTestDatabase() {
	// Create a connection pool to the test database
	const pool = new Pool({
		host: process.env.TEST_DB_HOST || 'localhost',
		database: process.env.TEST_DB_NAME || 'test_db',
		user: process.env.TEST_DB_USER || 'postgres',
		password: process.env.TEST_DB_PASSWORD || 'postgres',
		port: Number(process.env.TEST_DB_PORT || 5432),
		max: 10,
	});

	// Create Kysely instance
	const db = new Kysely({
		dialect: new PostgresDialect({ pool }),
	});

	return db;
}

/**
 * Tears down the test database after tests
 */
export async function teardownTestDatabase(db: Kysely<any>) {
	// Drop test tables
	try {
		await db.schema.dropTable('posts').ifExists().execute();
	} catch (e) {
		// Ignore errors
	}

	// Destroy the database connection
	await db.destroy();
}
