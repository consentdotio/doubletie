import type {
	InsertObject,
	OperandValueExpressionOrList,
	SelectExpression,
	SelectType,
	Selectable,
	UpdateObject,
} from 'kysely';
import type { InsertObjectOrList } from 'kysely/dist/esm/parser/insert-values-parser';
/**
 * Slug generation mixin for models
 *
 * @module slug
 */
import slugify from 'url-slug';
import type { ModelFunctions } from '../model';

/**
 * Available slug operations
 */
export const Operation = {
	/** Convert to lowercase */
	LOWERCASE: 'lowercase',
	/** Convert to uppercase */
	UPPERCASE: 'uppercase',
	/** Capitalize first letter of each word */
	CAPITALIZE: 'capitalize',
} as const;

/**
 * Type for slug operations
 */
export type Operation = (typeof Operation)[keyof typeof Operation];

/**
 * Options for slug generation
 */
export type SlugOptions = {
	/** Separator to use between words */
	separator?: string;
	/** Maximum length to truncate slugs */
	truncate?: number;
	/** Dictionary of words to replace */
	dictionary?: Record<string, string>;
};

/**
 * Configuration options for the slug mixin
 *
 * @typeParam TDatabase - Database schema type
 * @typeParam TTableName - Table name in the database
 */
export type Options<TDatabase, TTableName extends keyof TDatabase> = {
	/** Field to store the slug */
	field: keyof TDatabase[TTableName] & string;
	/** Source fields to generate slug from */
	sources: Array<keyof TDatabase[TTableName] & string>;
	/** Operation to apply to the slug */
	operation?: Operation;
	/** Additional slug options */
	slugOptions?: SlugOptions;
};

/**
 * Generates a slug value from data using the provided options
 *
 * @typeParam TDatabase - Database schema type
 * @typeParam TTableName - Table name in the database
 * @param data - Source data for generating the slug
 * @param options - Slug generation options
 * @returns Generated slug string or undefined if no source data
 */
function generateSlugValue<TDatabase, TTableName extends keyof TDatabase>(
	data: Record<string, unknown>,
	options: Options<TDatabase, TTableName>
): string | undefined {
	const { field, sources, operation, slugOptions = {} } = options;
	const { separator = '-', truncate, dictionary } = slugOptions;

	// Skip if data already has a valid slug
	if (typeof data[field] === 'string' && data[field] !== '') {
		return data[field] as string;
	}

	// Collect values from source fields
	const values: string[] = [];
	for (const source of sources) {
		const value = data[source];
		if (value != null && String(value).trim() !== '') {
			values.push(String(value));
		}
	}

	if (values.length === 0) {
		return undefined;
	}

	// Generate the initial slug
	let slug = slugify(values.join(' '), { separator });

	// Apply dictionary replacements
	if (dictionary) {
		for (const [search, replace] of Object.entries(dictionary)) {
			slug = slug.replace(new RegExp(search, 'gi'), replace);
		}
	}

	// Apply operation
	if (operation) {
		// biome-ignore lint/style/useDefaultSwitchClause: <explanation>
		switch (operation) {
			case Operation.LOWERCASE:
				slug = slug.toLowerCase();
				break;
			case Operation.UPPERCASE:
				slug = slug.toUpperCase();
				break;
			case Operation.CAPITALIZE:
				slug = slug
					.split(separator)
					.map((word) => word.charAt(0).toUpperCase() + word.slice(1))
					.join(separator);
				break;
		}
	}

	// Truncate if needed
	if (truncate && slug.length > truncate) {
		slug = slug.substring(0, truncate);
	}

	return slug;
}

/**
 * Adds slug generation functionality to a model
 *
 * @typeParam TDatabase - Database schema type
 * @typeParam TTableName - Table name in the database
 * @typeParam TIdColumnName - Name of the ID column
 * @param model - Model to enhance with slug generation
 * @param options - Slug configuration options
 * @returns Enhanced model with slug methods
 */
export default function withSlug<
	TDatabase,
	TTableName extends keyof TDatabase & string,
	TIdColumnName extends keyof TDatabase[TTableName] & string,
>(
	model: ModelFunctions<TDatabase, TTableName, TIdColumnName>,
	slugField?: keyof TDatabase[TTableName] & string,
	sourceField?: keyof TDatabase[TTableName] & string
) {
	// Direct usage with all parameters provided
	if (slugField && sourceField) {
		const options: Options<TDatabase, TTableName> = {
			field: slugField,
			sources: [sourceField],
		};
		return implementSlug(model, options);
	}

	// Curried usage - return a function that takes options
	return (options: Options<TDatabase, TTableName>) => {
		return implementSlug(model, options);
	};
}

/**
 * Internal implementation of the slug functionality
 */
function implementSlug<
	TDatabase,
	TTableName extends keyof TDatabase & string,
	TIdColumnName extends keyof TDatabase[TTableName] & string,
>(
	model: ModelFunctions<TDatabase, TTableName, TIdColumnName>,
	options: Options<TDatabase, TTableName>
) {
	type Table = TDatabase[TTableName];
	type TableRecord = Selectable<Table>;

	/**
	 * Checks if data already has a valid slug field
	 *
	 * @param values - Values to check
	 * @returns Whether the values already have a slug
	 */
	const hasValidSlugField = (values: Record<string, unknown>): boolean => {
		const { field } = options;
		return (
			field in values &&
			values[field] != null &&
			typeof values[field] === 'string' &&
			(values[field] as string).trim() !== ''
		);
	};

	/**
	 * Adds a slug to the values if needed
	 *
	 * @param values - Values to add slug to
	 * @returns Values with slug added
	 */
	const addSlugToValues = <T extends Record<string, unknown>>(values: T): T => {
		if (hasValidSlugField(values)) {
			return values;
		}

		const slug = generateSlugValue(values, options);
		if (!slug) {
			return values;
		}

		return {
			...values,
			[options.field]: slug,
		};
	};

	return {
		...model,

		/**
		 * Finds a record by its slug
		 *
		 * @param value - Slug value to search for
		 * @param column - Column to search in (defaults to slug field)
		 * @returns Found record or undefined
		 */
		async findBySlug(
			value: string,
			column: keyof Table & string = options.field
		): Promise<TableRecord | undefined> {
			// Cast string to the appropriate column type
			return model.findOne(
				column,
				value as unknown as Readonly<
					SelectType<TDatabase[TTableName][keyof Table & string]>
				>
			);
		},

		/**
		 * Inserts a record with automatic slug generation
		 *
		 * @param values - Values to insert
		 * @returns Inserted record
		 * @throws {Error} If insert fails
		 */
		async insertWithSlug(
			values: Record<string, unknown>
		): Promise<TableRecord> {
			const processedValues = addSlugToValues(values);

			const result = await model
				.insertInto()
				.values(
					processedValues as unknown as InsertObject<TDatabase, TTableName>
				)
				.returning(['*'] as unknown as SelectExpression<
					TDatabase,
					TTableName
				>[])
				.executeTakeFirst();

			if (!result) {
				throw new Error(`Failed to insert record into ${model.table}`);
			}

			return result as TableRecord;
		},

		/**
		 * Tries to insert a record, falling back to find if it already exists
		 *
		 * @param values - Values to insert
		 * @param uniqueColumn - Column to check for uniqueness
		 * @returns Inserted or found record
		 */
		async insertIfNotExistsWithSlug(
			values: Record<string, unknown>,
			uniqueColumn: keyof Table & string
		): Promise<TableRecord | undefined> {
			const processedValues = addSlugToValues(values);
			const uniqueValue = processedValues[uniqueColumn];

			if (uniqueValue === undefined) {
				throw new Error(
					`Missing required unique column value for '${String(uniqueColumn)}'`
				);
			}

			try {
				const result = await this.insertWithSlug(processedValues);
				return result;
			} catch (error) {
				// Check if it's a uniqueness violation error
				const err = error as Error;
				if (
					err.message?.includes('conflict') ||
					err.message?.includes('unique constraint')
				) {
					// If insert failed due to conflict, find the existing record
					return model.findOne(
						uniqueColumn,
						uniqueValue as unknown as Readonly<
							SelectType<TDatabase[TTableName][keyof Table & string]>
						>
					);
				}
				throw error;
			}
		},

		/**
		 * Updates a record if it exists, or inserts a new one with slug
		 *
		 * @param criteria - Search criteria for finding existing record
		 * @param insertValues - Values to insert if record doesn't exist
		 * @param updateValues - Values to update if record exists
		 * @returns Updated or inserted record
		 */
		async upsertWithSlug(
			criteria: { column: keyof Table & string; value: unknown },
			insertValues: Record<string, unknown>,
			updateValues: Record<string, unknown>
		): Promise<TableRecord | undefined> {
			// First try to find the record
			const existing = await model.findOne(
				criteria.column,
				criteria.value as unknown as Readonly<
					SelectType<TDatabase[TTableName][keyof Table & string]>
				>
			);

			if (existing) {
				// Update it if it exists
				const result = await model
					.updateTable()
					.set(
						updateValues as unknown as UpdateObject<
							TDatabase,
							TTableName,
							TTableName
						>
					)
					.where(
						criteria.column,
						'=',
						criteria.value as unknown as OperandValueExpressionOrList<
							TDatabase,
							TTableName,
							keyof Table & string
						>
					)
					.returning(['*'] as unknown as SelectExpression<
						TDatabase,
						TTableName
					>[])
					.executeTakeFirst();

				return result as TableRecord;
			}
			// Insert a new record with slug
			return this.insertWithSlug({
				...insertValues,
				[criteria.column]: criteria.value,
			});
		},

		/**
		 * Processes data before insert to add slugs
		 *
		 * @param data - Data to process
		 * @returns Processed data with slugs
		 */
		processDataBeforeInsert(data: InsertObjectOrList<TDatabase, TTableName>) {
			// Handle both single object and array of objects
			if (Array.isArray(data)) {
				return data.map((item) =>
					addSlugToValues(item as unknown as Record<string, unknown>)
				) as typeof data;
			}
			return addSlugToValues(
				data as unknown as Record<string, unknown>
			) as typeof data;
		},
	};
}
