/**
 * Drizzle ORM adapter for the database abstraction layer
 *
 * This adapter provides integration with Drizzle ORM for database operations.
 * It translates the generic adapter interface into Drizzle-specific operations.
 */

import { and, asc, count, desc, eq, inArray, like, type SQL, sql } from 'drizzle-orm';
import type { 
  Adapter, 
  AdapterOptions, 
  Where,
  WhereCondition,
  SortOptions
} from '../types';

/**
 * Type representing a Drizzle column
 */
interface DrizzleColumn {
  name: string;
  [key: string]: unknown;
}

/**
 * Type for Drizzle SQL query methods
 */
type DrizzleQueryMethod = {
  select: (columns?: Record<string, unknown>) => DrizzleQuery;
  insert: (data: Record<string, unknown>) => DrizzleQuery;
  update: (data: Record<string, unknown>) => DrizzleQuery;
  delete: () => DrizzleQuery;
  where: (condition: SQL | undefined) => DrizzleQuery;
  returning: (columns: string) => Promise<Record<string, unknown>[]>;
  orderBy: (orderBy: unknown) => DrizzleQuery;
  limit: (limit: number) => DrizzleQuery;
  offset: (offset: number) => DrizzleQuery;
};

/**
 * Type for a Drizzle query builder
 */
type DrizzleQuery = DrizzleQueryMethod & Promise<Record<string, unknown>[]>;

/**
 * Interface representing a Drizzle database connection
 */
export interface DrizzleDB {
  /** Tables in the Drizzle database */
  [key: string]: DrizzleQueryMethod | unknown;
  
  /** Schema metadata */
  _?: {
    fullSchema?: Record<string, Record<string, DrizzleColumn>>;
  };
  
  /** Transaction method */
  transaction?: <T>(callback: (tx: DrizzleDB) => Promise<T>) => Promise<T>;
}

/**
 * Configuration options for the Drizzle adapter
 */
export interface DrizzleAdapterConfig {
  /**
   * The schema object that defines the tables and fields
   */
  schema?: Record<string, Record<string, DrizzleColumn>>;
  
  /**
   * The database provider
   */
  provider: 'pg' | 'mysql' | 'sqlite';
  
  /**
   * If the table names in the schema are plural,
   * set this to true. For example, if the schema
   * has an object with a key "users" instead of "user"
   */
  usePlural?: boolean;
}

/**
 * Function that transforms database fields and operations
 * 
 * @param db - The Drizzle database instance
 * @param config - The adapter configuration options
 * @param options - Additional options
 * @returns An object containing transformation functions
 */
const createTransform = (
  db: DrizzleDB,
  config: DrizzleAdapterConfig,
  options: AdapterOptions
) => {
  /**
   * Gets the field name, with correct mapping for special fields like "id"
   * 
   * @param model - The model name
   * @param field - The field name to get
   * @returns The mapped field name for use with Drizzle
   */
  function getField(model: string, field: string): string {
    if (field === 'id') {
      return field;
    }
    
    // Add more field name mappings as needed
    return field;
  }

  /**
   * Gets the schema for a specific model
   * 
   * @param modelName - The model name
   * @returns The schema object for the model
   * @throws {Error} If the schema or model is not found
   */
  function getSchema(modelName: string): Record<string, DrizzleColumn> {
    const schema = config.schema ?? db._?.fullSchema;
    if (!schema) {
      throw new Error(
        'Drizzle adapter failed to initialize. Schema not found. Please provide a schema object in the adapter options object.'
      );
    }
    
    const model = getModelName(modelName);
    const schemaModel = schema[model];
    
    if (!schemaModel) {
      throw new Error(
        `[Drizzle Adapter]: The model "${model}" was not found in the schema object. Please pass the schema directly to the adapter options.`
      );
    }
    
    return schemaModel;
  }

  /**
   * Gets the model name with proper pluralization if needed
   * 
   * @param model - The base model name
   * @returns The correctly pluralized model name
   */
  const getModelName = (model: string): string => {
    return config.usePlural ? `${model}s` : model;
  };

  /**
   * Converts a where clause into a Drizzle-compatible where condition
   * 
   * @param where - The where conditions to convert
   * @param model - The model name
   * @returns The converted Drizzle-compatible SQL condition
   */
  function convertWhereClause(where: Where<string>, model: string): SQL | undefined {
    if (!where || where.length === 0) {
      return undefined;
    }

    const conditions: SQL[] = [];

    for (const condition of where) {
      const { field, operator = 'eq', value, connector = 'AND' } = condition as WhereCondition<string>;
      const fieldName = getField(model, field);
      const schema = getSchema(model);
      const schemaField = schema[fieldName];

      let sqlCondition: SQL | undefined;

      switch (operator) {
        case 'eq':
          sqlCondition = eq(schemaField as unknown as Parameters<typeof eq>[0], value);
          break;
        case 'ne':
          sqlCondition = sql`${schemaField} != ${value}`;
          break;
        case 'gt':
          sqlCondition = sql`${schemaField} > ${value}`;
          break;
        case 'gte':
          sqlCondition = sql`${schemaField} >= ${value}`;
          break;
        case 'lt':
          sqlCondition = sql`${schemaField} < ${value}`;
          break;
        case 'lte':
          sqlCondition = sql`${schemaField} <= ${value}`;
          break;
        case 'in':
          if (Array.isArray(value)) {
            sqlCondition = inArray(schemaField as unknown as Parameters<typeof inArray>[0], value);
          }
          break;
        case 'contains':
          if (typeof value === 'string') {
            sqlCondition = like(schemaField as unknown as Parameters<typeof like>[0], `%${value}%`);
          }
          break;
        case 'starts_with':
          if (typeof value === 'string') {
            sqlCondition = like(schemaField as unknown as Parameters<typeof like>[0], `${value}%`);
          }
          break;
        case 'ends_with':
          if (typeof value === 'string') {
            sqlCondition = like(schemaField as unknown as Parameters<typeof like>[0], `%${value}`);
          }
          break;
        case 'ilike':
          if (typeof value === 'string') {
            // Note: ilike is only supported in PostgreSQL
            if (config.provider === 'pg') {
              sqlCondition = sql`${schemaField} ILIKE ${`%${value}%`}`;
            } else {
              // Fallback for MySQL and SQLite
              sqlCondition = sql`LOWER(${schemaField}) LIKE LOWER(${`%${value}%`})`;
            }
          }
          break;
        default:
          throw new Error(`Unsupported operator: ${operator}`);
      }

      if (sqlCondition) {
        conditions.push(sqlCondition);
      }
    }

    if (conditions.length === 0) {
      return undefined;
    }

    if (conditions.length === 1) {
      return conditions[0];
    }

    // Combine all conditions with AND by default
    return and(...conditions);
  }

  /**
   * Transforms input data for create or update operations
   * 
   * @param data - The input data
   * @param model - The model name
   * @param action - The action being performed (create or update)
   * @returns The transformed data for Drizzle
   */
  function transformInput(
    data: Record<string, unknown>,
    model: string,
    action: 'create' | 'update'
  ): Record<string, unknown> {
    const result: Record<string, unknown> = {};
    
    for (const [key, value] of Object.entries(data)) {
      const fieldName = getField(model, key);
      result[fieldName] = value;
    }
    
    // Add generated ID for new records if not provided
    if (action === 'create' && !result.id) {
      result.id = crypto.randomUUID();
    }
    
    return result;
  }

  /**
   * Transforms output data from Drizzle to the expected format
   * 
   * @param data - The output data from Drizzle
   * @param model - The model name
   * @param select - Fields to select
   * @returns The transformed output data
   */
  function transformOutput<T extends Record<string, unknown>>(
    data: Record<string, unknown>,
    model: string,
    select: Array<string> = []
  ): T {
    const result: Record<string, unknown> = {};
    
    // If select is empty, return all fields
    if (select.length === 0) {
      return data as T;
    }
    
    // Otherwise, only return selected fields
    for (const field of select) {
      const dbField = getField(model, field);
      result[field] = data[dbField];
    }
    
    return result as T;
  }

  return {
    getField,
    getSchema,
    getModelName,
    convertWhereClause,
    transformInput,
    transformOutput
  };
};

/**
 * Checks if there are any missing required fields in the data
 * 
 * @param schema - The schema object
 * @param model - The model name
 * @param values - The values to check
 * @throws {Error} If required fields are missing
 */
function checkMissingFields(
  schema: Record<string, unknown>,
  model: string,
  values: Record<string, unknown>
): void {
  // This is a simplified version; implement according to your needs
  if (!values.id && model !== 'session') {
    throw new Error(`Missing required field: id for model ${model}`);
  }
}

/**
 * Creates a Drizzle adapter for the database abstraction layer
 * 
 * @param db - The Drizzle database instance
 * @param config - The adapter configuration
 * @returns A function that returns an adapter instance
 */
export const drizzleAdapter = 
  (db: DrizzleDB, config: DrizzleAdapterConfig) => 
  (options: AdapterOptions): Adapter => {
    // Create the transform functions
    const transform = createTransform(db, config, options);
    
    const adapter: Adapter = {
      id: 'drizzle',
      
      async create<
        Model extends string,
        Data extends Record<string, unknown>,
        Result extends Record<string, unknown>
      >({ 
        model, 
        data, 
        select 
      }: { 
        model: Model; 
        data: Data; 
        select?: Array<keyof Result>;
      }): Promise<Result> {
        const modelName = transform.getModelName(model);
        const schema = transform.getSchema(model);
        
        const transformedData = transform.transformInput(data, model, 'create');
        
        // Check for missing fields based on schema
        checkMissingFields(schema, model, transformedData);
        
        // Perform the insert
        const drizzleTable = db[modelName] as DrizzleQueryMethod;
        const insertResult = await drizzleTable
          .insert(transformedData)
          .returning('*');
        
        const result = Array.isArray(insertResult) ? insertResult[0] : insertResult;
        
        // Transform the result to the expected format
        return transform.transformOutput<Result>(
          result as Record<string, unknown>,
          model,
          select as string[]
        );
      },
      
      async findOne<Model extends string, Result extends Record<string, unknown>>({ 
        model, 
        where, 
        select, 
        sortBy 
      }: { 
        model: Model; 
        where: Where<Model>; 
        select?: Array<keyof Result>; 
        sortBy?: SortOptions<Model>;
      }): Promise<Result | null> {
        const modelName = transform.getModelName(model);
        const whereClause = transform.convertWhereClause(where, model);
        
        const drizzleTable = db[modelName] as DrizzleQueryMethod;
        let query = drizzleTable.select();
        
        if (whereClause) {
          query = query.where(whereClause);
        }
        
        if (sortBy) {
          const field = transform.getField(model, sortBy.field);
          query = query.orderBy(
            sortBy.direction === 'asc' 
              ? asc(field as unknown as Parameters<typeof asc>[0]) 
              : desc(field as unknown as Parameters<typeof desc>[0])
          );
        }
        
        // Execute the query
        const result = await query.limit(1);
        
        if (!result || result.length === 0) {
          return null;
        }
        
        // Transform the result to the expected format
        return transform.transformOutput<Result>(
          result[0],
          model,
          select as string[]
        );
      },
      
      async findMany<Model extends string, Result extends Record<string, unknown>>({ 
        model, 
        where = [], 
        limit, 
        sortBy, 
        offset = 0, 
        select 
      }: { 
        model: Model; 
        where?: Where<Model>; 
        limit?: number; 
        sortBy?: SortOptions<Model>; 
        offset?: number; 
        select?: Array<keyof Result>; 
      }): Promise<Result[]> {
        const modelName = transform.getModelName(model);
        const whereClause = transform.convertWhereClause(where, model);
        
        const drizzleTable = db[modelName] as DrizzleQueryMethod;
        let query = drizzleTable.select();
        
        if (whereClause) {
          query = query.where(whereClause);
        }
        
        if (sortBy) {
          const field = transform.getField(model, sortBy.field);
          query = query.orderBy(
            sortBy.direction === 'asc' 
              ? asc(field as unknown as Parameters<typeof asc>[0]) 
              : desc(field as unknown as Parameters<typeof desc>[0])
          );
        }
        
        if (offset > 0) {
          query = query.offset(offset);
        }
        
        if (limit) {
          query = query.limit(limit);
        }
        
        // Execute the query
        const results = await query;
        
        // Transform the results to the expected format
        return results.map((result) => 
          transform.transformOutput<Result>(
            result,
            model,
            select as string[]
          )
        );
      },
      
      async count<Model extends string>({ 
        model, 
        where = [] 
      }: { 
        model: Model; 
        where?: Where<Model>; 
      }): Promise<number> {
        const modelName = transform.getModelName(model);
        const whereClause = transform.convertWhereClause(where, model);
        
        const drizzleTable = db[modelName] as DrizzleQueryMethod;
        let query = drizzleTable.select({ count: count() });
        
        if (whereClause) {
          query = query.where(whereClause);
        }
        
        // Execute the query
        const result = await query;
        
        return (result[0]?.count as number) || 0;
      },
      
      async update<
        Model extends string,
        Data extends Record<string, unknown>,
        Result extends Record<string, unknown>
      >({ 
        model, 
        where, 
        update, 
        select 
      }: { 
        model: Model; 
        where: Where<Model>; 
        update: Data; 
        select?: Array<keyof Result>; 
      }): Promise<Result | null> {
        const modelName = transform.getModelName(model);
        const whereClause = transform.convertWhereClause(where, model);
        
        if (!whereClause) {
          return null;
        }
        
        const transformedData = transform.transformInput(update, model, 'update');
        
        // Execute the update query
        const drizzleTable = db[modelName] as DrizzleQueryMethod;
        const result = await drizzleTable
          .update(transformedData)
          .where(whereClause)
          .returning('*');
        
        if (!result || result.length === 0) {
          return null;
        }
        
        // Transform the result to the expected format
        return transform.transformOutput<Result>(
          result[0],
          model,
          select as string[]
        );
      },
      
      async updateMany<
        Model extends string,
        Data extends Record<string, unknown>,
        Result extends Record<string, unknown>
      >({ 
        model, 
        where, 
        update, 
        select 
      }: { 
        model: Model; 
        where: Where<Model>; 
        update: Data; 
        select?: Array<keyof Result>; 
      }): Promise<Result[]> {
        const modelName = transform.getModelName(model);
        const whereClause = transform.convertWhereClause(where, model);
        
        if (!whereClause) {
          return [];
        }
        
        const transformedData = transform.transformInput(update, model, 'update');
        
        // Execute the update query
        const drizzleTable = db[modelName] as DrizzleQueryMethod;
        const results = await drizzleTable
          .update(transformedData)
          .where(whereClause)
          .returning('*');
        
        // Transform the results to the expected format
        return results.map((result) => 
          transform.transformOutput<Result>(
            result,
            model,
            select as string[]
          )
        );
      },
      
      async delete<Model extends string>({ 
        model, 
        where 
      }: { 
        model: Model; 
        where: Where<Model>; 
      }): Promise<void> {
        const modelName = transform.getModelName(model);
        const whereClause = transform.convertWhereClause(where, model);
        
        if (!whereClause) {
          return;
        }
        
        // Execute the delete query
        const drizzleTable = db[modelName] as DrizzleQueryMethod;
        await drizzleTable.delete().where(whereClause);
      },
      
      async deleteMany<Model extends string>({ 
        model, 
        where 
      }: { 
        model: Model; 
        where: Where<Model>; 
      }): Promise<number> {
        const modelName = transform.getModelName(model);
        const whereClause = transform.convertWhereClause(where, model);
        
        if (!whereClause) {
          return 0;
        }
        
        const drizzleTable = db[modelName] as DrizzleQueryMethod;
        
        // Count records that will be deleted
        const countQuery = await drizzleTable
          .select({ count: count() })
          .where(whereClause);
        
        const deleteCount = (countQuery[0]?.count as number) || 0;
        
        // Execute the delete query
        await drizzleTable.delete().where(whereClause);
        
        return deleteCount;
      },
      
      async transaction<ResultType>({ 
        callback 
      }: { 
        callback: (transactionAdapter: Adapter) => Promise<ResultType>; 
      }): Promise<ResultType> {
        // Handle transaction based on the database provider
        if (typeof db.transaction === 'function') {
          return db.transaction(async (tx: DrizzleDB) => {
            // Create a new adapter with the transaction
            const txAdapter = drizzleAdapter(tx, config)(options);
            return callback(txAdapter);
          });
        }
        
        // Fallback if transaction is not supported
        return callback(adapter);
      }
    };
    
    return adapter;
  };