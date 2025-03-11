import { v4 as uuidv4 } from 'uuid';
import type { Adapter, SortOptions, Where, WhereCondition } from '../types';

/**
 * Type representing the in-memory database
 */
type MemoryDB = Record<string, Record<string, unknown>[]>;

/**
 * Evaluates a where condition against a record
 *
 * @param record - The record to evaluate against
 * @param condition - The where condition to evaluate
 * @returns Whether the record matches the condition
 */
function evaluateCondition<Model extends string>(
	record: Record<string, unknown>,
	condition: WhereCondition<Model>
): boolean {
	const { field, operator = 'eq', value } = condition;
	const recordValue = record[field];

	switch (operator) {
		case 'eq':
			return recordValue === value;
		case 'ne':
			return recordValue !== value;
		case 'lt':
			return (
				typeof recordValue === 'number' &&
				typeof value === 'number' &&
				recordValue < value
			);
		case 'lte':
			return (
				typeof recordValue === 'number' &&
				typeof value === 'number' &&
				recordValue <= value
			);
		case 'gt':
			return (
				typeof recordValue === 'number' &&
				typeof value === 'number' &&
				recordValue > value
			);
		case 'gte':
			return (
				typeof recordValue === 'number' &&
				typeof value === 'number' &&
				recordValue >= value
			);
		case 'in': {
			if (Array.isArray(value)) {
				if (
					typeof recordValue === 'string' &&
					value.every((item) => typeof item === 'string')
				) {
					return (value as string[]).includes(recordValue as string);
				}
				if (
					typeof recordValue === 'number' &&
					value.every((item) => typeof item === 'number')
				) {
					return (value as number[]).includes(recordValue as number);
				}
			}
			return false;
		}
		case 'contains':
			return (
				typeof recordValue === 'string' &&
				typeof value === 'string' &&
				recordValue.includes(value)
			);
		case 'starts_with':
			return (
				typeof recordValue === 'string' &&
				typeof value === 'string' &&
				recordValue.startsWith(value)
			);
		case 'ends_with':
			return (
				typeof recordValue === 'string' &&
				typeof value === 'string' &&
				recordValue.endsWith(value)
			);
		case 'ilike':
			return (
				typeof recordValue === 'string' &&
				typeof value === 'string' &&
				recordValue.toLowerCase().includes(value.toLowerCase())
			);
		default:
			return false;
	}
}

/**
 * Evaluates a set of where conditions against a record
 *
 * @param record - The record to evaluate against
 * @param where - The where conditions to evaluate
 * @returns Whether the record matches all conditions
 */
function evaluateWhere<Model extends string>(
	record: Record<string, unknown>,
	where: Where<Model>
): boolean {
	if (where.length === 0) {
		return true;
	}

	let result = true;

	for (const condition of where) {
		const { connector = 'AND' } = condition;
		const conditionResult = evaluateCondition(record, condition);

		if (connector === 'AND') {
			result = result && conditionResult;
			if (!result) {
				break;
			}
		} else {
			result = result || conditionResult;
			if (result) {
				break;
			}
		}
	}

	return result;
}

/**
 * Sorts records based on sort options
 *
 * @param records - The records to sort
 * @param sortOptions - The sort options to apply
 * @returns The sorted records
 */
function sortRecords<
	Model extends string,
	Result extends Record<string, unknown>,
>(records: Result[], sortOptions?: SortOptions<Model>): Result[] {
	if (!sortOptions) {
		return records;
	}

	const { field, direction } = sortOptions;

	return [...records].sort((a, b) => {
		const valueA = a[field as string];
		const valueB = b[field as string];

		if (valueA === valueB) {
			return 0;
		}

		if (valueA === null || valueA === undefined) {
			return direction === 'asc' ? -1 : 1;
		}

		if (valueB === null || valueB === undefined) {
			return direction === 'asc' ? 1 : -1;
		}

		if (typeof valueA === 'string' && typeof valueB === 'string') {
			return direction === 'asc'
				? valueA.localeCompare(valueB)
				: valueB.localeCompare(valueA);
		}

		if (typeof valueA === 'number' && typeof valueB === 'number') {
			return direction === 'asc' ? valueA - valueB : valueB - valueA;
		}

		if (valueA instanceof Date && valueB instanceof Date) {
			return direction === 'asc'
				? valueA.getTime() - valueB.getTime()
				: valueB.getTime() - valueA.getTime();
		}

		return 0;
	});
}

/**
 * Extracts selected fields from a record
 *
 * @param record - The record to extract fields from
 * @param select - The fields to select
 * @returns The record with only selected fields
 */
function selectFields<Result extends Record<string, unknown>>(
	record: Record<string, unknown>,
	select?: Array<keyof Result>
): Result {
	if (!select || select.length === 0) {
		return record as Result;
	}

	const result: Record<string, unknown> = {};

	for (const field of select) {
		result[field as string] = record[field as string];
	}

	return result as Result;
}

/**
 * Creates an in-memory database adapter
 *
 * @param initialData - Optional initial data for the in-memory database
 * @returns A memory adapter factory function
 */
export function memoryAdapter(
	initialData: Record<string, unknown[]> = {}
): (options: Record<string, unknown>) => Adapter {
	return () => {
		// Initialize the in-memory database
		const db: MemoryDB = {};

		// Initialize with provided data
		for (const [model, records] of Object.entries(initialData)) {
			db[model] = records.map((record) => {
				const typedRecord = record as Record<string, unknown>;
				if (!typedRecord.id) {
					return { ...typedRecord, id: uuidv4() };
				}
				return typedRecord;
			});
		}

		const adapter: Adapter = {
			id: 'memory',

			create: async <
				Model extends string,
				Data extends Record<string, unknown>,
				Result extends Record<string, unknown>,
			>({
				model,
				data,
				select,
			}: {
				model: Model;
				data: Data;
				select?: Array<keyof Result>;
			}): Promise<Result> => {
				// Initialize the model if it doesn't exist
				if (!db[model]) {
					db[model] = [];
				}

				// Create the record with an ID if it doesn't have one
				const record = { ...data, id: data.id || uuidv4() };

				// Add the record to the database
				db[model].push(record);

				// Return the record with selected fields
				return selectFields<Result>(record, select);
			},

			findOne: async <
				Model extends string,
				Result extends Record<string, unknown>,
			>({
				model,
				where,
				select,
				sortBy,
			}: {
				model: Model;
				where: Where<Model>;
				select?: Array<keyof Result>;
				sortBy?: SortOptions<Model>;
			}): Promise<Result | null> => {
				// Return null if the model doesn't exist
				if (!db[model]) {
					return null;
				}

				// Find the first record that matches the where conditions
				const records = db[model].filter((record) =>
					evaluateWhere(record, where)
				);

				// Sort the records if sort options are provided
				const sortedRecords = sortRecords<Model, Record<string, unknown>>(
					records,
					sortBy
				);

				// Return null if no matching records are found
				if (sortedRecords.length === 0) {
					return null;
				}

				// Return the first matching record with selected fields
				return selectFields<Result>(sortedRecords[0], select);
			},

			findMany: async <
				Model extends string,
				Result extends Record<string, unknown>,
			>({
				model,
				where = [],
				limit,
				sortBy,
				offset = 0,
				select,
			}: {
				model: Model;
				where?: Where<Model>;
				limit?: number;
				sortBy?: SortOptions<Model>;
				offset?: number;
				select?: Array<keyof Result>;
			}): Promise<Result[]> => {
				// Return an empty array if the model doesn't exist
				if (!db[model]) {
					return [];
				}

				// Find all records that match the where conditions
				const records = db[model].filter((record) =>
					evaluateWhere(record, where)
				);

				// Sort the records if sort options are provided
				const sortedRecords = sortRecords<Model, Record<string, unknown>>(
					records,
					sortBy
				);

				// Apply offset and limit
				const slicedRecords = sortedRecords.slice(
					offset,
					limit ? offset + limit : undefined
				);

				// Return the matching records with selected fields
				return slicedRecords.map((record) =>
					selectFields<Result>(record, select)
				);
			},

			count: async <Model extends string>({
				model,
				where = [],
			}: {
				model: Model;
				where?: Where<Model>;
			}): Promise<number> => {
				// Return 0 if the model doesn't exist
				if (!db[model]) {
					return 0;
				}

				// Count the records that match the where conditions
				return db[model].filter((record) => evaluateWhere(record, where))
					.length;
			},

			update: async <
				Model extends string,
				Data extends Record<string, unknown>,
				Result extends Record<string, unknown>,
			>({
				model,
				where,
				update,
				select,
			}: {
				model: Model;
				where: Where<Model>;
				update: Data;
				select?: Array<keyof Result>;
			}): Promise<Result | null> => {
				// Return null if the model doesn't exist
				if (!db[model]) {
					return null;
				}

				// Find the index of the first record that matches the where conditions
				const index = db[model].findIndex((record) =>
					evaluateWhere(record, where)
				);

				// Return null if no matching record is found
				if (index === -1) {
					return null;
				}

				// Update the record
				const record = { ...db[model][index], ...update };
				db[model][index] = record;

				// Return the updated record with selected fields
				return selectFields<Result>(record, select);
			},

			updateMany: async <
				Model extends string,
				Data extends Record<string, unknown>,
				Result extends Record<string, unknown>,
			>({
				model,
				where,
				update,
				select,
			}: {
				model: Model;
				where: Where<Model>;
				update: Data;
				select?: Array<keyof Result>;
			}): Promise<Result[]> => {
				// Return an empty array if the model doesn't exist
				if (!db[model]) {
					return [];
				}

				// Find all records that match the where conditions
				const indices = db[model]
					.map((record, index) => ({ record, index }))
					.filter(({ record }) => evaluateWhere(record, where))
					.map(({ index }) => index);

				// Update the matching records
				const updatedRecords: Record<string, unknown>[] = [];
				for (const index of indices) {
					const record = { ...db[model][index], ...update };
					db[model][index] = record;
					updatedRecords.push(record);
				}

				// Return the updated records with selected fields
				return updatedRecords.map((record) =>
					selectFields<Result>(record, select)
				);
			},

			delete: async <Model extends string>({
				model,
				where,
			}: {
				model: Model;
				where: Where<Model>;
			}): Promise<void> => {
				// Do nothing if the model doesn't exist
				if (!db[model]) {
					return;
				}

				// Find the index of the first record that matches the where conditions
				const index = db[model].findIndex((record) =>
					evaluateWhere(record, where)
				);

				// Remove the record if found
				if (index !== -1) {
					db[model].splice(index, 1);
				}
			},

			deleteMany: async <Model extends string>({
				model,
				where,
			}: {
				model: Model;
				where: Where<Model>;
			}): Promise<number> => {
				// Return 0 if the model doesn't exist
				if (!db[model]) {
					return 0;
				}

				// Count the records that match the where conditions
				const initialCount = db[model].length;

				// Remove all records that match the where conditions
				db[model] = db[model].filter((record) => !evaluateWhere(record, where));

				// Return the number of deleted records
				return initialCount - db[model].length;
			},

			transaction: async <ResultType>({
				callback,
			}: {
				callback: (transactionAdapter: Adapter) => Promise<ResultType>;
			}): Promise<ResultType> => {
				// Create a snapshot of the database
				const snapshot: MemoryDB = {};
				for (const [model, records] of Object.entries(db)) {
					snapshot[model] = records.map((record) => ({ ...record }));
				}

				try {
					// Execute the callback
					const result = await callback(adapter);

					// Return the result on success
					return result;
				} catch (error) {
					// Restore the database from the snapshot on error
					for (const [model, records] of Object.entries(snapshot)) {
						db[model] = records;
					}

					// Re-throw the error
					throw error;
				}
			},
		};

		return adapter;
	};
}
