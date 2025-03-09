export {
	NoResultError,
	sql,
	type Selectable,
	type Insertable,
	type Updateable,
	type SelectQueryBuilder,
	type NotNull,
	// Export enhanced JSON functions from 0.27.0
	type JSONOperatorWith$,
	// reexport dialects
	PostgresDialect,
	MysqlDialect,
	SqliteDialect,
	// New in Kysely 0.27.1
} from 'kysely';

// Export the main classes, types and utilities
export {
	Database,
	type DatabaseConfig,
	type MigratorOptions,
	type ModelRegistry,
} from './database';

// Export RelationType from constants
export { RelationType } from './constants';

export * from './model';
export * from './mixins';
export * from './utils';
export { generateId } from './id-generator';

// Export SQL Fragments utilities (new in 0.27.2)
export {
	insertAndReturnUserIds,
	updateUserAndGetAuditClause,
	deleteInactiveUsersAndCount,
} from './utils/sql-fragments';

// Export Type-Safe Model Building API
export {
	field,
	defineSchema,
	primaryKey,
	defineModels,
	relation,
	type RelationDefinition,
	type FieldDefinition,
	type ModelType,
} from './utils/model-builder';

// Helper function to provide type inference utilities
const createTypeInferenceHelpers = () => {
	return {
		// Empty placeholder implementation
		// This exists only to make the exports below not type-only
		__typeInferenceHelpers: true,
	};
};

// Export Type Inference Utilities as part of a named export
export const TypeInference = {
	...createTypeInferenceHelpers(),
	// The actual types are exported via type keyword
};

// Type-only exports
export type {
	InferDatabaseSchema,
	ExtractModelType,
	ModelInsertType,
	ModelUpdateType,
	ModelSelectType,
	ExtractKeysOfType,
	RequireKeys,
	NonNullableFields,
	RequiredFields,
	WithOptional,
	WithRequired,
	ValidationErrors,
	FieldMapping,
} from './utils/type-inference';
