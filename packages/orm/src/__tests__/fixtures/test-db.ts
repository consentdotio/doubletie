//@ts-ignore
import SQLite from 'better-sqlite3';
import { ColumnType, Kysely, SqliteDialect } from 'kysely';
import { Database, ModelRegistry } from '../../database.js'; // Adjust the import path as necessary
import { cleanupDatabase, initializeDatabase } from './migration.js';

export type Generated<T> = T extends ColumnType<infer S, infer I, infer U>
	? ColumnType<S, I | undefined, U>
	: ColumnType<T, T | undefined, T>;

export type Timestamp = ColumnType<Date, Date | string, Date | string>;

// Define the database interface
interface TestDB {
	users: {
		id: Generated<string>;
		email: string;
		name: string;
		username: string;
		password: string;
		followersCount: number;
		createdAt: Generated<Timestamp>;
		updatedAt: Timestamp;
	};
	posts: {
		id: Generated<string>;
		title: string;
		content: string;
		userId: string;
		status: 'draft' | 'published';
		createdAt: Generated<Timestamp>;
		updatedAt: Timestamp;
	};
	comments: {
		id: Generated<string>;
		userId: string;
		postId: string;
		content: string;
		createdAt: Generated<Timestamp>;
	};
}

/**
 * Creates an in-memory SQLite database for unit/integration tests
 */
export async function setupTestDatabase() {
	// Create an in-memory SQLite database
	const sqlite = new SQLite(':memory:');

	// Create Kysely instance with SQLite dialect
	const db = new Kysely<TestDB>({
		dialect: new SqliteDialect({
			database: sqlite,
		}),
	});

	return db;
}

/**
 * Tears down the test database after tests
 */
export async function teardownTestDatabase(db: Kysely<TestDB>) {
	// For in-memory SQLite, we can just destroy the connection
	// The database will be deleted automatically when the connection closes
	await db.destroy();
}

// Export the TestDB interface for use in tests
export type { TestDB };

/**
 * Sets up a real in-memory SQLite database for e2e tests.
 * It initializes the database schema using the migration functions.
 */
export async function setupRealDatabase() {
	const sqlite = new SQLite(':memory:');

	const dialect = new SqliteDialect({ database: sqlite });

	const database = new Database<TestDB>({
		dialect,
		isolated: true,
		debug: true,
		log: (event) => console.log(event),
	});

	await initializeDatabase();

	return database;
}

/**
 * Tears down the real database after e2e tests.
 * It cleans up the database using the cleanupDatabase migration function.
 */

export async function teardownRealDatabase(database: Database<TestDB>) {
	await cleanupDatabase();
	await database.destroy();
}
