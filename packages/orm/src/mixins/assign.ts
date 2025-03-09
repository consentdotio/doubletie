import type { Selectable } from 'kysely';
/**
 * Provides data assignment functionality for models
 *
 * @module assign
 */
import type { ModelFunctions } from '../model';

/**
 * Enhances a model with data assignment functionality
 *
 * @typeParam TDatabase - Database schema type
 * @typeParam TTableName - Table name in the database
 * @typeParam TIdColumnName - Name of the ID column
 *
 * @param model - Base model to enhance
 * @returns Enhanced model with assign functionality
 */
export default function withAssign<
	TDatabase,
	TTableName extends keyof TDatabase & string,
	TIdColumnName extends keyof TDatabase[TTableName] & string,
>(model: ModelFunctions<TDatabase, TTableName, TIdColumnName>) {
	return {
		...model,

		/**
		 * Assigns data values to the model instance
		 *
		 * @param data - Data to assign
		 * @returns Model instance with assigned data
		 */
		assign(data: Selectable<TDatabase[TTableName]>) {
			// Create a new object with all the model properties
			const instance = { ...this };

			// Assign all data properties to the instance
			if (data) {
				Object.assign(instance, data);
			}

			return instance;
		},
	};
}
