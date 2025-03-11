/**
 * Database adapters registry
 *
 * This file contains the adapter registry for database adapters.
 * Each database type (SQLite, MySQL, PostgreSQL) has its own adapter implementation.
 */
import { DatabaseAdapter } from './adapter';
import { MySQLAdapter } from './mysql-adapter';
import { PostgresAdapter } from './postgres-adapter';
import { SQLiteAdapter } from './sqlite-adapter';

// Export all adapter modules
export * from './adapter';
export * from './base-adapter';
export * from './sqlite-adapter';
export * from './postgres-adapter';
export * from './mysql-adapter';

// Adapter registry
const adapters: Map<string, DatabaseAdapter> = new Map();

/**
 * Register a database adapter in the adapter registry
 */
export function registerAdapter(adapter: DatabaseAdapter): void {
	adapters.set(adapter.type, adapter);
}

/**
 * Get a database adapter by type
 * @param adapterType The type of adapter to get ('sqlite', 'mysql', 'postgres')
 * @returns The database adapter instance
 * @throws Error if adapter type is not found
 */
export function getAdapter(adapterType: string): DatabaseAdapter {
	const adapter = adapters.get(adapterType);
	if (!adapter) {
		throw new Error(`Database adapter '${adapterType}' not found`);
	}
	return adapter;
}

/**
 * Get all registered database adapters
 * @returns A record of all registered adapters, keyed by type
 */
export function getAdapters(): Record<string, DatabaseAdapter> {
	return Object.fromEntries(adapters);
}

// Register default adapters
registerAdapter(new SQLiteAdapter());
registerAdapter(new PostgresAdapter());
registerAdapter(new MySQLAdapter());
