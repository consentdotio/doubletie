import SQLiteDatabase from 'better-sqlite3';

/**
 * Creates a setup function for database tests
 * @returns Object containing methods for test database setup and teardown
 */
export function createDbSetup(): {
	createDatabase: () => any;
	setupDb: () => Promise<void>;
	cleanupDb: () => Promise<void>;
} {
	let db: any; // Use any to avoid type issues with better-sqlite3

	/**
	 * Create an in-memory SQLite database for testing
	 * @returns The database instance
	 */
	const createDatabase = () => {
		db = new SQLiteDatabase(':memory:');
		return db;
	};

	/**
	 * Set up test tables and data
	 */
	const setupDb = async () => {
		// Create users table for tests
		await db.exec(`
      CREATE TABLE IF NOT EXISTS users (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL,
        email TEXT NOT NULL UNIQUE,
        username TEXT NOT NULL UNIQUE,
        password TEXT,
        status TEXT DEFAULT 'active',
        followers_count INTEGER DEFAULT 0,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);
	};

	/**
	 * Clean up test database after tests
	 */
	const cleanupDb = async () => {
		// Drop all tables
		await db.exec(`
      DROP TABLE IF EXISTS users;
    `);

		// Close the database connection
		db.close();
	};

	return {
		createDatabase,
		setupDb,
		cleanupDb,
	};
}
