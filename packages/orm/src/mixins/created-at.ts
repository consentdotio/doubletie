import type { InsertObject } from 'kysely';
import type { ModelFunctions } from '../model';
/**
 * Provides automatic created_at timestamp functionality for models
 *
 * @module createdAt
 */

// Type alias for insert objects or arrays of insert objects
type InsertObjectOrList<TDatabase, TTableName extends keyof TDatabase> =
	| InsertObject<TDatabase, TTableName>
	| Array<InsertObject<TDatabase, TTableName>>;

/**
 * Enhances a model with automatic created_at timestamp functionality
 *
 * @typeParam TDatabase - Database schema type
 * @typeParam TTableName - Table name in the database
 * @typeParam TIdColumnName - Name of the ID column
 *
 * @param model - Base model to enhance
 * @param field - Name of the created_at field
 * @returns Enhanced model with created_at functionality
 */
export default function withCreatedAt<
	TDatabase,
	TTableName extends keyof TDatabase & string,
	TIdColumnName extends keyof TDatabase[TTableName] & string,
>(
	model: ModelFunctions<TDatabase, TTableName, TIdColumnName>,
	field: keyof TDatabase[TTableName] & string
) {
	// Get the original processDataBeforeInsert function to extend
	const originalProcessDataBeforeInsert =
		model.processDataBeforeInsert || ((data) => data);

	// Return a new object with the added functionality
	return {
		...model,

		/**
		 * Adds a timestamp to the data before insertion
		 *
		 * This adds a created_at timestamp to all inserted records if
		 * they don't already have one.
		 *
		 * @param data - Data to process before insert
		 * @returns The processed data with added timestamp
		 */
		processDataBeforeInsert(data: InsertObjectOrList<TDatabase, TTableName>) {
			// Process with original method first
			let processedData = originalProcessDataBeforeInsert(data);

			// Add timestamp to single object or each object in array
			const timestamp = new Date();

			if (Array.isArray(processedData)) {
				processedData = processedData.map((item) => ({
					...item,
					[field]:
						(item as Partial<Record<keyof TDatabase[TTableName], unknown>>)[
							field
						] ?? timestamp,
				}));
			} else {
				processedData = {
					...processedData,
					[field]:
						(
							processedData as Partial<
								Record<keyof TDatabase[TTableName], unknown>
							>
						)[field] ?? timestamp,
				};
			}

			return processedData;
		},
	};
}
