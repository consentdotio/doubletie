/**
 * Kysely ORM adapter for the database abstraction layer
 *
 * This adapter provides integration with Kysely query builder for database operations
 * using @doubletie/query-builder.
 */

import type { Kysely } from 'kysely';
import { createDatabase } from '@doubletie/query-builder';
import type { AdapterOptions, Adapter } from '../types';
import type { KyselyAdapterConfig } from './types';

/**
 * Creates a Kysely adapter for the database abstraction layer
 * 
 * @param db - The Kysely database instance
 * @param config - The Kysely adapter configuration
 * @returns A function that returns an adapter instance
 */
export const kyselyAdapter = 
  (db: Kysely<any>, config?: KyselyAdapterConfig) => 
  (options: AdapterOptions): Adapter => {
    // Create a database instance using @doubletie/query-builder
    const database = createDatabase({
      dialect: db.getExecutor().adapter.dialect,
      isolated: options.isolated ?? false,
      log: options.log,
      debug: options.debug,
    });

    // Create a model for the table
    const model = database.model(options.table, 'id');

    const adapter: Adapter = {
      id: 'kysely',
      
      async create({ model: modelName, data, select }) {
        const result = await model.insertRequired(data);
        return result;
      },
      
      async findOne({ model: modelName, where, select, sortBy }) {
        const result = await model.findOne(where[0].field, where[0].value);
        return result || null;
      },
      
      async findMany({ model: modelName, where = [], limit, sortBy, offset = 0, select }) {
        let query = model.selectFrom().selectAll();
        
        if (where.length > 0) {
          query = query.where((eb) => {
            return eb.and(
              where.map((condition) => 
                eb(condition.field, condition.operator || '=', condition.value)
              )
            );
          });
        }
        
        if (sortBy) {
          query = query.orderBy(sortBy.field, sortBy.direction);
        }
        
        if (offset > 0) {
          query = query.offset(offset);
        }
        
        if (limit !== undefined) {
          query = query.limit(limit);
        }
        
        return query.execute();
      },
      
      async count({ model: modelName, where = [] }) {
        let query = model.selectFrom();
        
        if (where.length > 0) {
          query = query.where((eb) => {
            return eb.and(
              where.map((condition) => 
                eb(condition.field, condition.operator || '=', condition.value)
              )
            );
          });
        }
        
        const result = await query
          .select((eb) => eb.fn.count('id').as('count'))
          .executeTakeFirst();
          
        return Number(result?.count || 0);
      },
      
      async update({ model: modelName, where, update, select }) {
        const result = await model.updatePartial(where[0].value, update);
        return result;
      },
      
      async updateMany({ model: modelName, where, update, select }) {
        let query = model.updateTable().set(update);
        
        if (where.length > 0) {
          query = query.where((eb) => {
            return eb.and(
              where.map((condition) => 
                eb(condition.field, condition.operator || '=', condition.value)
              )
            );
          });
        }
        
        const results = await query.returningAll().execute();
        return results;
      },
      
      async delete({ model: modelName, where }) {
        await model.deleteFrom()
          .where((eb) => {
            return eb.and(
              where.map((condition) => 
                eb(condition.field, condition.operator || '=', condition.value)
              )
            );
          })
          .execute();
      },
      
      async deleteMany({ model: modelName, where }) {
        const count = await this.count({ model: modelName, where });
        
        await model.deleteFrom()
          .where((eb) => {
            return eb.and(
              where.map((condition) => 
                eb(condition.field, condition.operator || '=', condition.value)
              )
            );
          })
          .execute();
          
        return count;
      },
      
      async transaction({ callback }) {
        return database.transaction(async (trx) => {
          const txAdapter = kyselyAdapter(trx.transaction, config)(options);
          return callback(txAdapter);
        });
      }
    };
    
    return adapter;
  }; 