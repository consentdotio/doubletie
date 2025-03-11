/**
 * Kysely Dialect Support
 * 
 * This module provides utilities for working with different Kysely dialects
 * and determining the appropriate database type.
 */

import { Kysely, MssqlDialect } from 'kysely';
import {
  type Dialect,
  MysqlDialect,
  PostgresDialect,
  SqliteDialect,
} from 'kysely';
import { createDatabase, type DatabaseConfig, type LogEvent } from '@doubletie/query-builder';
import type { AdapterOptions } from '../types';
import type { KyselyDatabaseType } from './types';
import { type KyselyAdapterConfig } from './types';

/**
 * Configuration options for the Kysely adapter
 */
export interface KyselyAdapterConfig {
  /**
   * Database type
   */
  type?: KyselyDatabaseType;
}

/**
 * Determines the database type based on the dialect or connection
 * 
 * @param db - The database connection or dialect
 * @returns The detected database type or null if unknown
 */
export function getDatabaseType(
  db: unknown
): KyselyDatabaseType | null {
  if (!db || typeof db !== 'object') {
    return null;
  }
  
  if (db && typeof db === 'object' && 'dialect' in db) {
    return getDatabaseType((db as { dialect: unknown }).dialect);
  }
  
  if (db && typeof db === 'object' && 'createDriver' in db) {
    if (db instanceof SqliteDialect) {
      return 'sqlite';
    }
    if (db instanceof MysqlDialect) {
      return 'mysql';
    }
    if (db instanceof PostgresDialect) {
      return 'postgres';
    }
    if (db instanceof MssqlDialect) {
      return 'mssql';
    }
  }
  
  if (db && typeof db === 'object' && 'aggregate' in db) {
    return 'sqlite';
  }

  if (db && typeof db === 'object' && 'getConnection' in db) {
    return 'mysql';
  }
  
  if (db && typeof db === 'object' && 'connect' in db) {
    return 'postgres';
  }

  return null;
}

/**
 * Extended adapter options for Kysely
 */
interface KyselyAdapterExtendedOptions extends AdapterOptions {
  connection: unknown;
  isolated?: boolean;
  log?: (event: LogEvent) => void;
  debug?: boolean;
  table?: string;
}

/**
 * Creates a Kysely adapter based on the provided options
 * 
 * @param options - The adapter options including database connection details
 * @returns An object containing the Kysely instance and database type
 */
export const createKyselyAdapter = async (options: KyselyAdapterExtendedOptions) => {
  const db = options.connection;

  if (!db) {
    throw new Error('No database connection provided');
  }

  let kysely: Kysely<any> | null = null;
  let databaseType: KyselyDatabaseType | null = null;

  // If the provided connection is already a Kysely instance
  if (db && typeof db === 'object' && 'selectFrom' in db) {
    kysely = db as Kysely<any>;
    databaseType = getDatabaseType(kysely);
  } 
  // If a custom dialect is provided
  else if (db && typeof db === 'object' && 'createDriver' in db) {
    kysely = new Kysely({
      dialect: db as Dialect,
    });
    databaseType = getDatabaseType(db);
  }
  // For SQLite connections
  else if (db && typeof db === 'object' && 'aggregate' in db) {
    kysely = new Kysely({
      dialect: new SqliteDialect({
        database: db as any, // Using any here because it's hard to correctly type SQLite databases
      }),
    });
    databaseType = 'sqlite';
  }
  // For MySQL connections
  else if (db && typeof db === 'object' && 'getConnection' in db) {
    kysely = new Kysely({
      dialect: new MysqlDialect({
        pool: db as any, // Using any here because it's hard to correctly type MySQL pools
      }),
    });
    databaseType = 'mysql';
  }
  // For PostgreSQL connections
  else if (db && typeof db === 'object' && 'connect' in db) {
    kysely = new Kysely({
      dialect: new PostgresDialect({
        pool: db as any, // Using any here because it's hard to correctly type PostgreSQL pools
      }),
    });
    databaseType = 'postgres';
  }

  if (!kysely) {
    throw new Error('Unsupported database type');
  }

  // Create a database instance using @doubletie/query-builder
  const database = createDatabase({
    dialect: kysely.getExecutor().adapter as any, // Fix for missing dialect property
    isolated: options.isolated ?? false,
    log: options.log,
    debug: options.debug,
  } as DatabaseConfig<unknown>);

  return {
    kysely: database.kysely,
    databaseType,
  };
}; 