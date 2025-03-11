import { Kysely, ReferenceExpression, SelectExpression, sql } from 'kysely';
import type { Adapter, AdapterOptions, SortOptions, Where, WhereCondition } from '../../types';

/**
 * Configuration for the Kysely adapter
 */
export interface KyselyAdapterConfig {
  /**
   * Database provider
   */
  provider: 'postgresql' | 'mysql' | 'sqlite';
  
  /**
   * Field mappings from the adapter to Kysely
   */
  fieldMappings?: Record<string, Record<string, string>>;
  
  /**
   * If the table names in the schema are plural,
   * set this to true. For example, if the schema
   * has a table "users" instead of "user"
   */
  usePlural?: boolean;
}

/**
 * Creates transformation functions for converting between
 * application models and database schema
 */
const createTransform = (
  db: Kysely<any>,
  config: KyselyAdapterConfig,
  options: AdapterOptions
) => {
  /**
   * Transforms a model field name to a database column name
   */
  function getField(model: string, field: string): string {
    const modelName = getModelName(model);
    const mappings = config.fieldMappings?.[modelName];
    
    if (mappings && field in mappings) {
      return mappings[field];
    }
    
    return field;
  }
  
  /**
   * Gets the database table name for a model
   */
  const getModelName = (model: string): string => {
    if (config.usePlural) {
      return model;
    }
    
    // If model is already plural, use it as is
    if (model.endsWith('s')) {
      return model;
    }
    
    // Otherwise, make it plural
    return `${model}s`;
  }
  
  /**
   * Converts a where clause to Kysely's format
   */
  function convertWhereClause(where: Where<string>, model: string): ((eb: any) => any) | undefined {
    if (!where || where.length === 0) {
      return undefined;
    }
    
    return (eb) => {
      let expression = undefined;
      
      for (const condition of where) {
        const fieldExpression = convertCondition(condition, model, eb);
        
        if (!expression) {
          expression = fieldExpression;
        } else {
          expression = expression.and(fieldExpression);
        }
      }
      
      return expression;
    };
  }
  
  /**
   * Converts a single condition to Kysely's format
   */
  function convertCondition(
    condition: WhereCondition<string>,
    model: string,
    eb: any
  ): any {
    const { field, operator, value } = condition;
    const dbField = getField(model, field);
    
    switch(operator) {
      case 'eq':
        return eb(dbField, '=', value);
      case 'neq':
        return eb(dbField, '!=', value);
      case 'gt':
        return eb(dbField, '>', value);
      case 'gte':
        return eb(dbField, '>=', value);
      case 'lt':
        return eb(dbField, '<', value);
      case 'lte':
        return eb(dbField, '<=', value);
      case 'in':
        return eb.inArray(dbField, Array.isArray(value) ? value : [value]);
      case 'nin':
        return eb.not(eb.inArray(dbField, Array.isArray(value) ? value : [value]));
      case 'contains':
        if (config.provider === 'postgresql') {
          return eb.like(dbField, `%${value}%`);
        } else {
          return eb(dbField, 'like', `%${value}%`);
        }
      case 'startsWith':
        if (config.provider === 'postgresql') {
          return eb.like(dbField, `${value}%`);
        } else {
          return eb(dbField, 'like', `${value}%`);
        }
      case 'endsWith':
        if (config.provider === 'postgresql') {
          return eb.like(dbField, `%${value}`);
        } else {
          return eb(dbField, 'like', `%${value}`);
        }
      case 'between':
        if (Array.isArray(value) && value.length === 2) {
          return eb.between(dbField, value[0], value[1]);
        }
        throw new Error(`Invalid value for 'between' operator: ${value}`);
      case 'isNull':
        return eb.isNull(dbField);
      case 'isNotNull':
        return eb.isNotNull(dbField);
      case 'or':
        if (Array.isArray(value)) {
          const orExpressions = value.map(orCondition => 
            convertCondition(orCondition, model, eb)
          );
          return eb.or(orExpressions);
        }
        throw new Error(`Invalid value for 'or' operator: ${value}`);
      default:
        throw new Error(`Unsupported operator: ${operator}`);
    }
  }
  
  /**
   * Transforms input data before sending to database
   */
  function transformInput(
    data: Record<string, unknown>,
    model: string,
    action: 'create' | 'update'
  ): Record<string, unknown> {
    const result: Record<string, unknown> = {};
    const modelName = getModelName(model);
    
    for (const key in data) {
      const dbField = getField(model, key);
      result[dbField] = data[key];
    }
    
    return result;
  }
  
  /**
   * Transforms database output to application format
   */
  function transformOutput<T extends Record<string, unknown>>(
    data: Record<string, unknown>,
    model: string,
    select: Array<string> = []
  ): T {
    if (!data) return {} as T;
    
    const result: Record<string, unknown> = {};
    const modelName = getModelName(model);
    const mappings = config.fieldMappings?.[modelName];
    
    // Create a reverse mapping of database fields to model fields
    const reverseMapping: Record<string, string> = {};
    if (mappings) {
      for (const modelField in mappings) {
        const dbField = mappings[modelField];
        reverseMapping[dbField] = modelField;
      }
    }
    
    for (const key in data) {
      // If we have a reverse mapping for this field, use it
      const modelField = reverseMapping[key] || key;
      
      // If select is specified and this field is not in it, skip
      if (select.length > 0 && !select.includes(modelField)) {
        continue;
      }
      
      result[modelField] = data[key];
    }
    
    return result as T;
  }
  
  return {
    getField,
    getModelName,
    convertWhereClause,
    transformInput,
    transformOutput
  };
};

/**
 * Creates a Kysely adapter for the DB adapters system
 */
export const kyselyAdapter = 
  (db: Kysely<any>, config: KyselyAdapterConfig) => 
  (options: AdapterOptions): Adapter => {
    const transform = createTransform(db, config, options);
    
    return {
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
        const tableName = transform.getModelName(model);
        const transformedData = transform.transformInput(data, model, 'create');
        
        // Execute insert
        const result = await db
          .insertInto(tableName)
          .values(transformedData)
          .returningAll()
          .executeTakeFirstOrThrow();
        
        // Transform the result to the expected format
        return transform.transformOutput<Result>(
          result,
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
        const tableName = transform.getModelName(model);
        
        // Start query
        let query = db.selectFrom(tableName);
        
        // Add fields to select
        if (select && select.length > 0) {
          const fields = select.map(field => 
            transform.getField(model, field as string)
          ) as Array<SelectExpression<any, any>>;
          query = query.select(fields);
        } else {
          query = query.selectAll();
        }
        
        // Add where conditions
        const whereExpression = transform.convertWhereClause(where, model);
        if (whereExpression) {
          query = query.where(whereExpression);
        }
        
        // Add sorting
        if (sortBy) {
          const field = transform.getField(model, sortBy.field);
          if (sortBy.direction === 'asc') {
            query = query.orderBy(field as ReferenceExpression<any, any>, 'asc');
          } else {
            query = query.orderBy(field as ReferenceExpression<any, any>, 'desc');
          }
        }
        
        // Execute the query
        const result = await query.executeTakeFirst();
        
        if (!result) {
          return null;
        }
        
        // Transform the result to the expected format
        return transform.transformOutput<Result>(
          result,
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
        const tableName = transform.getModelName(model);
        
        // Start query
        let query = db.selectFrom(tableName);
        
        // Add fields to select
        if (select && select.length > 0) {
          const fields = select.map(field => 
            transform.getField(model, field as string)
          ) as Array<SelectExpression<any, any>>;
          query = query.select(fields);
        } else {
          query = query.selectAll();
        }
        
        // Add where conditions
        const whereExpression = transform.convertWhereClause(where, model);
        if (whereExpression) {
          query = query.where(whereExpression);
        }
        
        // Add sorting
        if (sortBy) {
          const field = transform.getField(model, sortBy.field);
          if (sortBy.direction === 'asc') {
            query = query.orderBy(field as ReferenceExpression<any, any>, 'asc');
          } else {
            query = query.orderBy(field as ReferenceExpression<any, any>, 'desc');
          }
        }
        
        // Add pagination
        if (typeof limit === 'number') {
          query = query.limit(limit);
        }
        
        if (offset > 0) {
          query = query.offset(offset);
        }
        
        // Execute query
        const results = await query.execute();
        
        // Transform results
        return results.map(result => 
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
        const tableName = transform.getModelName(model);
        
        // Start query
        let query = db
          .selectFrom(tableName)
          .select(db.fn.count('*').as('count'));
        
        // Add where conditions
        const whereExpression = transform.convertWhereClause(where, model);
        if (whereExpression) {
          query = query.where(whereExpression);
        }
        
        // Execute query
        const result = await query.executeTakeFirst();
        
        return Number(result?.count || 0);
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
        const tableName = transform.getModelName(model);
        const transformedData = transform.transformInput(update, model, 'update');
        
        // Start query
        let query = db
          .updateTable(tableName)
          .set(transformedData);
        
        // Add where conditions
        const whereExpression = transform.convertWhereClause(where, model);
        if (whereExpression) {
          query = query.where(whereExpression);
        }
        
        // Execute update
        await query.execute();
        
        // Fetch the updated record
        return this.findOne({ model, where, select });
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
        const tableName = transform.getModelName(model);
        const transformedData = transform.transformInput(update, model, 'update');
        
        // Start query
        let query = db
          .updateTable(tableName)
          .set(transformedData);
        
        // Add where conditions
        const whereExpression = transform.convertWhereClause(where, model);
        if (whereExpression) {
          query = query.where(whereExpression);
        }
        
        // Execute update
        await query.execute();
        
        // Fetch the updated records
        return this.findMany({ model, where, select });
      },
      
      async delete<Model extends string>({ 
        model, 
        where 
      }: { 
        model: Model; 
        where: Where<Model>; 
      }): Promise<void> {
        const tableName = transform.getModelName(model);
        
        // Start query
        let query = db.deleteFrom(tableName);
        
        // Add where conditions
        const whereExpression = transform.convertWhereClause(where, model);
        if (whereExpression) {
          query = query.where(whereExpression);
        }
        
        // Execute query
        await query.execute();
      },
      
      async deleteMany<Model extends string>({ 
        model, 
        where 
      }: { 
        model: Model; 
        where: Where<Model>; 
      }): Promise<number> {
        const tableName = transform.getModelName(model);
        
        // Count records before deletion
        const countBefore = await this.count({ model, where });
        
        // Start query
        let query = db.deleteFrom(tableName);
        
        // Add where conditions
        const whereExpression = transform.convertWhereClause(where, model);
        if (whereExpression) {
          query = query.where(whereExpression);
        }
        
        // Execute query
        await query.execute();
        
        return countBefore;
      },
      
      async transaction<ResultType>({ 
        callback 
      }: { 
        callback: (transactionAdapter: Adapter) => Promise<ResultType>; 
      }): Promise<ResultType> {
        // Execute the transaction using Kysely's transaction API
        return db.transaction().execute(async (trx) => {
          // Create a new adapter instance for the transaction
          const transactionAdapter = kyselyAdapter(trx, config)(options);
          
          // Execute the callback with the transaction adapter
          return callback(transactionAdapter);
        });
      }
    };
  };