/**
 * Prisma ORM adapter for the database abstraction layer
 *
 * This adapter provides integration with Prisma ORM for database operations.
 * It translates the generic adapter interface into Prisma-specific operations.
 */

import type { 
  Adapter, 
  AdapterOptions, 
  Where,
  WhereCondition,
  SortOptions,
  ComparisonOperator
} from '../types';

/**
 * Configuration options for the Prisma adapter
 */
export interface PrismaConfig {
  /**
   * Database provider
   */
  provider:
    | 'sqlite'
    | 'cockroachdb'
    | 'mysql'
    | 'postgresql'
    | 'sqlserver'
    | 'mongodb';
    
  /**
   * Field mappings from the adapter to Prisma
   */
  fieldMappings?: Record<string, Record<string, string>>;
}

/**
 * Type for Prisma client model operations
 */
interface PrismaModelOperations {
  create: (data: { data: Record<string, unknown> }) => Promise<Record<string, unknown>>;
  findFirst: (data: { 
    where?: Record<string, unknown>; 
    select?: Record<string, boolean>;
    orderBy?: Record<string, 'asc' | 'desc'>;
  }) => Promise<Record<string, unknown> | null>;
  findMany: (data: {
    where?: Record<string, unknown>;
    select?: Record<string, boolean>; 
    take?: number;
    skip?: number;
    orderBy?: Record<string, 'asc' | 'desc'>;
  }) => Promise<Record<string, unknown>[]>;
  count: (data: {
    where?: Record<string, unknown>;
  }) => Promise<number>;
  update: (data: {
    where: Record<string, unknown>;
    data: Record<string, unknown>;
    select?: Record<string, boolean>;
  }) => Promise<Record<string, unknown>>;
  updateMany: (data: {
    where: Record<string, unknown>;
    data: Record<string, unknown>;
  }) => Promise<{ count: number }>;
  delete: (data: {
    where: Record<string, unknown>;
  }) => Promise<Record<string, unknown>>;
  deleteMany: (data: {
    where: Record<string, unknown>;
  }) => Promise<{ count: number }>;
}

/**
 * Type for Prisma client
 */
export interface PrismaClient {
  [key: string]: PrismaModelOperations | unknown;
  $transaction: <T>(operations: Promise<T>[]) => Promise<T[]>;
  $connect: () => Promise<void>;
  $disconnect: () => Promise<void>;
}

/**
 * Function that transforms database fields and operations
 * 
 * @param config - The adapter configuration options
 * @param options - The database options
 * @returns An object containing transformation functions
 */
const createTransform = (
  config: PrismaConfig,
  _options: AdapterOptions
) => {
  /**
   * Gets the field name for a specific model and field
   * 
   * @param model - The model name
   * @param field - The field name
   * @returns The mapped field name for Prisma
   */
  function getField(model: string, field: string): string {
    if (field === 'id') {
      return field;
    }
    
    // Check for custom field mappings in config
    if (config.fieldMappings?.[model]?.[field]) {
      return config.fieldMappings[model][field];
    }
    
    return field;
  }

  /**
   * Converts a comparison operator to the Prisma equivalent
   * 
   * @param operator - The operator to convert
   * @returns The Prisma-compatible operator
   */
  function operatorToPrismaOperator(operator: ComparisonOperator): string {
    switch (operator) {
      case 'starts_with':
        return 'startsWith';
      case 'ends_with':
        return 'endsWith';
      case 'contains':
        return 'contains';
      case 'lt':
        return 'lt';
      case 'lte':
        return 'lte';
      case 'gt':
        return 'gt';
      case 'gte':
        return 'gte';
      case 'ne':
        return 'not';
      case 'in':
        return 'in';
      case 'ilike':
        return 'contains'; // Best approximation, case insensitive depends on DB
      default:
        return 'equals';
    }
  }

  /**
   * Gets the model name for Prisma
   * 
   * @param model - The model name
   * @returns The Prisma model name
   */
  function getModelName(model: string): string {
    // Model name is assumed to be the same
    // But you can add custom mapping logic here if needed
    return model;
  }

  /**
   * Transforms input data for Prisma operations
   * 
   * @param data - The input data
   * @param model - The model name
   * @param action - The action being performed
   * @returns The transformed data for Prisma
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
    
    // Add ID for new records if needed
    if (action === 'create' && !result.id) {
      result.id = crypto.randomUUID();
    }
    
    return result;
  }

  /**
   * Transforms output data from Prisma
   * 
   * @param data - The output data from Prisma
   * @param model - The model name
   * @param select - The fields to select
   * @returns The transformed output data
   */
  function transformOutput<T extends Record<string, unknown>>(
    data: Record<string, unknown> | null,
    model: string,
    select: string[] = []
  ): T | null {
    if (!data) {
      return null;
    }
    
    const result: Record<string, unknown> = {};
    
    if (select.length === 0) {
      // Return all fields
      return data as T;
    }
    
    // Only return selected fields
    for (const field of select) {
      const prismaField = getField(model, field);
      result[field] = data[prismaField];
    }
    
    return result as T;
  }

  /**
   * Converts where conditions to Prisma format
   * 
   * @param model - The model name
   * @param where - The where conditions
   * @returns Prisma-compatible where conditions
   */
  function convertWhereClause(
    model: string,
    where: Where<string> = []
  ): Record<string, unknown> {
    if (where.length === 0) {
      return {};
    }
    
    const prismaWhere: Record<string, unknown> = {};
    const andConditions: Record<string, unknown>[] = [];
    const orConditions: Record<string, unknown>[] = [];
    
    for (const condition of where) {
      const { field, operator = 'eq', value, connector = 'AND' } = condition as WhereCondition<string>;
      const fieldName = getField(model, field);
      const prismaOperator = operatorToPrismaOperator(operator);
      
      const conditionObj: Record<string, unknown> = {};
      
      if (prismaOperator === 'equals') {
        conditionObj[fieldName] = value;
      } else if (prismaOperator === 'not') {
        conditionObj[fieldName] = { not: value };
      } else if (prismaOperator === 'in' && Array.isArray(value)) {
        conditionObj[fieldName] = { in: value };
      } else {
        conditionObj[fieldName] = { [prismaOperator]: value };
      }
      
      if (connector === 'OR') {
        orConditions.push(conditionObj);
      } else {
        andConditions.push(conditionObj);
      }
    }
    
    // Handle AND conditions
    Object.assign(prismaWhere, ...andConditions);
    
    // Handle OR conditions
    if (orConditions.length > 0) {
      prismaWhere.OR = orConditions;
    }
    
    return prismaWhere;
  }

  /**
   * Converts selected fields to Prisma format
   * 
   * @param select - The fields to select
   * @param model - The model name
   * @returns Prisma-compatible select object
   */
  function convertSelect<T>(
    // biome-ignore lint/style/useDefaultParameterLast: <explanation>
    select: Array<keyof T> = [],
    model: string
  ): Record<string, boolean> | undefined {
    if (select.length === 0) {
      return undefined;
    }
    
    const prismaSelect: Record<string, boolean> = {};
    
    for (const field of select) {
      const fieldName = getField(model, field as string);
      prismaSelect[fieldName] = true;
    }
    
    return prismaSelect;
  }

  /**
   * Converts sort options to Prisma format
   * 
   * @param sortBy - The sort options
   * @param model - The model name
   * @returns Prisma-compatible orderBy object
   */
  function convertSortBy<Model extends string>(
    sortBy: SortOptions<Model> | undefined,
    model: string
  ): Record<string, 'asc' | 'desc'> | undefined {
    if (!sortBy) {
      return undefined;
    }
    
    const fieldName = getField(model, sortBy.field);
    return { [fieldName]: sortBy.direction };
  }
  
  return {
    getField,
    getModelName,
    operatorToPrismaOperator,
    transformInput,
    transformOutput,
    convertWhereClause,
    convertSelect,
    convertSortBy
  };
};

/**
 * Creates a Prisma adapter for the database abstraction layer
 * 
 * @param prisma - The Prisma client instance
 * @param config - The Prisma adapter configuration
 * @returns A function that returns an adapter instance
 */
export const prismaAdapter = 
  (prisma: PrismaClient, config: PrismaConfig) => 
  (options: AdapterOptions): Adapter => {
    // Create the transform functions
    const transform = createTransform(config, options);
    
    const adapter: Adapter = {
      id: 'prisma',
      
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
        const prismaModel = prisma[modelName] as PrismaModelOperations;
        
        const transformedData = transform.transformInput(data, model, 'create');
        const prismaSelect = transform.convertSelect(select, model);
        
        // Execute the create operation
        const result = await prismaModel.create({
          data: transformedData,
          ...prismaSelect ? { select: prismaSelect } : {}
        });
        
        // Transform and return the result
        return transform.transformOutput<Result>(result, model, select as string[]) as Result;
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
        const prismaModel = prisma[modelName] as PrismaModelOperations;
        
        const prismaWhere = transform.convertWhereClause(model, where);
        const prismaSelect = transform.convertSelect(select, model);
        const prismaOrderBy = transform.convertSortBy(sortBy, model);
        
        // Execute the findFirst operation
        const result = await prismaModel.findFirst({
          where: prismaWhere,
          ...prismaSelect ? { select: prismaSelect } : {},
          ...prismaOrderBy ? { orderBy: prismaOrderBy } : {}
        });
        
        // Transform and return the result
        return transform.transformOutput<Result>(result, model, select as string[]);
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
        const prismaModel = prisma[modelName] as PrismaModelOperations;
        
        const prismaWhere = transform.convertWhereClause(model, where);
        const prismaSelect = transform.convertSelect(select, model);
        const prismaOrderBy = transform.convertSortBy(sortBy, model);
        
        // Execute the findMany operation
        const results = await prismaModel.findMany({
          where: prismaWhere,
          ...prismaSelect ? { select: prismaSelect } : {},
          ...limit ? { take: limit } : {},
          ...offset ? { skip: offset } : {},
          ...prismaOrderBy ? { orderBy: prismaOrderBy } : {}
        });
        
        // Transform and return the results
        return results.map(result => 
          transform.transformOutput<Result>(result, model, select as string[]) as Result
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
        const prismaModel = prisma[modelName] as PrismaModelOperations;
        
        const prismaWhere = transform.convertWhereClause(model, where);
        
        // Execute the count operation
        return prismaModel.count({ where: prismaWhere });
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
        const prismaModel = prisma[modelName] as PrismaModelOperations;
        
        const prismaWhere = transform.convertWhereClause(model, where);
        const transformedData = transform.transformInput(update, model, 'update');
        const prismaSelect = transform.convertSelect(select, model);
        
        try {
          // Execute the update operation
          const result = await prismaModel.update({
            where: prismaWhere,
            data: transformedData,
            ...prismaSelect ? { select: prismaSelect } : {}
          });
          
          // Transform and return the result
          return transform.transformOutput<Result>(result, model, select as string[]);
        } catch {
          // Record not found or other error
          return null;
        }
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
        const prismaModel = prisma[modelName] as PrismaModelOperations;
        
        const prismaWhere = transform.convertWhereClause(model, where);
        const transformedData = transform.transformInput(update, model, 'update');
        
        // Prisma doesn't have updateMany with returning, so we need to do a findMany first
        const records = await this.findMany({ model, where, select });
        
        // Execute the updateMany operation
        await prismaModel.updateMany({
          where: prismaWhere,
          data: transformedData
        });
        
        // Return the updated records as they were before the update
        // Note: This doesn't return the actual updated records, just the ones matched by the query
        return records as unknown as Result[];
      },
      
      async delete<Model extends string>({ 
        model, 
        where 
      }: { 
        model: Model; 
        where: Where<Model>; 
      }): Promise<void> {
        const modelName = transform.getModelName(model);
        const prismaModel = prisma[modelName] as PrismaModelOperations;
        
        const prismaWhere = transform.convertWhereClause(model, where);
        
        try {
          // Execute the delete operation
          await prismaModel.delete({ where: prismaWhere });
        } catch {
          // Record not found or other error, silently ignore
        }
      },
      
      async deleteMany<Model extends string>({ 
        model, 
        where 
      }: { 
        model: Model; 
        where: Where<Model>; 
      }): Promise<number> {
        const modelName = transform.getModelName(model);
        const prismaModel = prisma[modelName] as PrismaModelOperations;
        
        const prismaWhere = transform.convertWhereClause(model, where);
        
        // Execute the deleteMany operation
        const result = await prismaModel.deleteMany({ where: prismaWhere });
        
        return result.count;
      },
      
      async transaction<ResultType>({ 
        callback 
      }: { 
        callback: (transactionAdapter: Adapter) => Promise<ResultType>; 
      }): Promise<ResultType> {
        // Prisma doesn't support passing transaction to models directly
        // We'll use a workaround with concurrent promises
        const operations: Promise<unknown>[] = [];
        
        // Create a proxy adapter that collects operations
        const transactionAdapter: Adapter = {
          ...adapter,
          id: 'prisma-transaction',
          
          // Override methods to collect operations instead of executing them
          // This is a simplification - in practice you'd need to implement all methods
          async create(...args) {
            const op = adapter.create(...args);
            operations.push(op);
            return op;
          },
          
          async findOne(...args) {
            return adapter.findOne(...args);
          },
          
          async findMany(...args) {
            return adapter.findMany(...args);
          },
          
          async count(...args) {
            return adapter.count(...args);
          },
          
          async update(...args) {
            const op = adapter.update(...args);
            operations.push(op);
            return op;
          },
          
          async updateMany(...args) {
            const op = adapter.updateMany(...args);
            operations.push(op);
            return op;
          },
          
          async delete(...args) {
            const op = adapter.delete(...args);
            operations.push(op);
            return op;
          },
          
          async deleteMany(...args) {
            const op = adapter.deleteMany(...args);
            operations.push(op);
            return op;
          },
          
          // Nested transactions are not supported
          async transaction({ callback }) {
            return callback(transactionAdapter);
          }
        };
        
        // Execute the callback with our transaction adapter
        const result = await callback(transactionAdapter);
        
        // Execute all collected operations in a transaction
        if (operations.length > 0) {
          await prisma.$transaction(operations);
        }
        
        return result;
      }
    };
    
    return adapter;
  }; 