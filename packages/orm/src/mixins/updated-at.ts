import type { OnConflictDatabase, OnConflictTables, SelectType } from 'kysely';
import type { UpdateObjectExpression } from 'kysely/dist/esm/parser/update-set-parser';
import type { ModelFunctions } from '../model';

/**
 * Enhances a model with automatic updated_at timestamp functionality
 *
 * @typeParam TDatabase - Database schema type
 * @typeParam TTableName - Table name in the database
 * @typeParam TIdColumnName - Name of the ID column
 *
 * @param model - Base model to enhance
 * @param field - Name of the updated_at field
 * @returns Enhanced model with updated_at functionality
 */
export default function withUpdatedAt<
	TDatabase,
	TTableName extends keyof TDatabase & string,
	TIdColumnName extends keyof TDatabase[TTableName] & string,
>(
	model: ModelFunctions<TDatabase, TTableName, TIdColumnName>,
	field: keyof TDatabase[TTableName] & string
): ModelFunctions<TDatabase, TTableName, TIdColumnName> {
	// Save the original processDataBeforeUpdate function
	const originalProcessDataBeforeUpdate =
		model.processDataBeforeUpdate ||
		((data: UpdateObjectExpression<TDatabase, TTableName, TTableName>) => data);

	// Add a method to easily update a record with automatic timestamp
	const updateById = async <
		TColumnName extends keyof TDatabase[TTableName] & string,
	>(
		id: Readonly<SelectType<TDatabase[TTableName][TIdColumnName]>>,
		column: TColumnName,
		value: TDatabase[TTableName][TColumnName]
	) => {
		return (
			model
				.updateTable()
				// @ts-expect-error - Will fix when Kysely 0.27.0 upgrade is complete
				.where(`${model.table}.${model.id}`, '=', id)
				// @ts-expect-error - Will fix when Kysely 0.27.0 upgrade is complete
				.set({
					[column]: value,
					[field]: new Date(),
				})
				// @ts-expect-error - Will fix when Kysely 0.27.0 upgrade is complete
				.returning(['*'])
				.executeTakeFirstOrThrow()
		);
	};

	// Create enhanced model
	return {
		...model,
		// Override processDataBeforeUpdate to add the timestamp
		processDataBeforeUpdate(
			data:
				| UpdateObjectExpression<TDatabase, TTableName, TTableName>
				| UpdateObjectExpression<
						OnConflictDatabase<TDatabase, TTableName>,
						OnConflictTables<TTableName>,
						OnConflictTables<TTableName>
				  >
		) {
			// Process with original function first
			const processedData = originalProcessDataBeforeUpdate(data);

			// Add the updated_at timestamp
			return {
				...processedData,
				[field]: new Date(),
			};
		},

		// Add the new direct update method
		// @ts-expect-error - Will fix when Kysely 0.27.0 upgrade is complete
		updateById,
	};
}
