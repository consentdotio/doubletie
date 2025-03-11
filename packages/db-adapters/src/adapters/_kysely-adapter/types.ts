/**
 * Re-export types from @doubletie/query-builder
 */
export { type Database, type DatabaseConfig, type ModelRegistry } from '@doubletie/query-builder';

/**
 * Database types supported by the Kysely adapter
 */
export type KyselyDatabaseType = 'postgres' | 'mysql' | 'sqlite' | 'mssql';

/**
 * Configuration options for the Kysely adapter
 */
export interface KyselyAdapterConfig {
  /**
   * Database type
   */
  type?: KyselyDatabaseType;
} 