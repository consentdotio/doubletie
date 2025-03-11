/**
 * @doubletie/db-adapters - A database abstraction layer with multiple adapters
 *
 * This package provides a unified interface for working with different database systems.
 * It includes adapters for common database technologies and utilities for managing database connections.
 */

// Core adapter types
export type {
	Adapter,
	AdapterFactory,
	Value,
	Where,
	WhereCondition,
	ComparisonOperator,
	LogicalConnector,
	SortOptions,
	AdapterSchemaCreation,
	AdapterOptions,
} from './adapters/types';

// Adapter factory utilities
export {
	getAdapter,
	registerAdapter,
	getMemoryAdapter,
	type DBOptions,
	DBAdapterError,
} from './utils/adapter-factory';

// Memory adapter
export { memoryAdapter } from './adapters/memory-adapter';

// Drizzle adapter
export { drizzleAdapter, type DrizzleDB, type DrizzleAdapterConfig } from './adapters/drizzle-adapter';

// Kysely adapter
export { 
	kyselyAdapter, 
	createKyselyAdapter, 
	type KyselyDatabaseType, 
	type KyselyAdapterConfig 
} from './adapters/kysely-adapter';

// Prisma adapter
export { prismaAdapter, type PrismaClient, type PrismaConfig } from './adapters/prisma-adapter';

// Re-export additional utilities as needed
// export { ... } from './utils/...';

// Re-export schema-related utilities as needed
// export { ... } from './schema/...';

/**
 * Centralized configuration for the database package
 */
export type DBConfig = {
	/** The adapter to use */
	adapter?: string;
	/** The database connection options */
	connection?: Record<string, unknown>;
	/** Whether to enable debug logging */
	debug?: boolean;
	/** The schema definition */
	schema?: Record<string, unknown>;
	/** Additional options */
	[key: string]: unknown;
};
