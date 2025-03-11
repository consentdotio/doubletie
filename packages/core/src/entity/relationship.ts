import type { EntityStructure } from './entity.types';
import type {
	BasicRelationshipOptions,
	EntityFieldReference,
	ManyToManyOptions,
	RelationshipConfig,
	RelationshipHelpers,
} from './relationship.types';

/**
 * Create relationship helpers with a given entity structure
 * @param entityStructure The entity structure to create helpers for
 * @returns Relationship helper methods
 */
export function createRelationshipHelpers<
	TSourceEntity extends EntityStructure,
>(entityStructure: TSourceEntity): RelationshipHelpers<TSourceEntity> {
	return {
		/**
		 * Create a reference to a field in another entity
		 */
		ref<
			TTargetEntity extends EntityStructure,
			TTargetField extends keyof TTargetEntity['fields'] & string,
		>(
			entity: TTargetEntity,
			field: TTargetField
		): EntityFieldReference<TSourceEntity, TTargetEntity, TTargetField> {
			return {
				entity: entity.name,
				field,
			};
		},

		/**
		 * Create a many-to-one relationship to another entity
		 */
		manyToOne<TTargetEntity extends EntityStructure>(
			entity: TTargetEntity,
			options?: BasicRelationshipOptions
		): EntityFieldReference<TSourceEntity, TTargetEntity> {
			const foreignKey = options?.foreignKey || `${entity.name}Id`;

			return {
				entity: entity.name,
				field: 'id' as keyof TTargetEntity['fields'] & string, // Assuming 'id' exists in target entity
				relationship: {
					type: 'manyToOne',
					foreignKey,
				},
			};
		},

		/**
		 * Create a one-to-one relationship to another entity
		 */
		oneToOne<TTargetEntity extends EntityStructure>(
			entity: TTargetEntity,
			options?: BasicRelationshipOptions
		): EntityFieldReference<TSourceEntity, TTargetEntity> {
			const foreignKey = options?.foreignKey || `${entity.name}Id`;

			// Validate that the foreign key exists in the target entity if it's referencing a field
			// This is a runtime check - TypeScript can't validate this at compile time
			if (
				options?.foreignKey &&
				entity.fields[options.foreignKey] &&
				entity.fields[options.foreignKey]?.type !== 'uuid' &&
				entity.fields[options.foreignKey]?.type !== 'integer'
			) {
				console.warn(
					`Warning: Foreign key ${options.foreignKey} in entity ${entity.name} is not an ID field type`
				);
			}

			return {
				entity: entity.name,
				field: 'id' as keyof TTargetEntity['fields'] & string, // Assuming 'id' exists in target entity
				relationship: {
					type: 'oneToOne',
					foreignKey,
				},
			};
		},

		/**
		 * Create a one-to-many relationship to another entity
		 */
		oneToMany<TTargetEntity extends EntityStructure>(
			entity: TTargetEntity,
			options: BasicRelationshipOptions = {}
		): EntityFieldReference<TSourceEntity, TTargetEntity> {
			const foreignKey = options.foreignKey || 'id';

			// Validate that the foreign key exists in the target entity if it's a field reference
			// This is a runtime check - TypeScript can't validate this at compile time
			if (
				entity.fields[foreignKey] &&
				entity.fields[foreignKey].type !== 'uuid' &&
				entity.fields[foreignKey].type !== 'integer'
			) {
				console.warn(
					`Warning: Foreign key ${foreignKey} in entity ${entity.name} is not an ID field type`
				);
			}

			return {
				entity: entity.name,
				field: 'id' as keyof TTargetEntity['fields'] & string, // Assuming 'id' exists in target entity
				relationship: {
					type: 'oneToMany',
					foreignKey,
				},
			};
		},

		/**
		 * Create a many-to-many relationship with another entity via a join table
		 */
		manyToMany<TTargetEntity extends EntityStructure>(
			entity: TTargetEntity,
			options: ManyToManyOptions
		): EntityFieldReference<TSourceEntity, TTargetEntity> {
			// Validate that a table name is provided
			if (!options.joinTable.tableName) {
				throw new Error('A table name must be provided for the join table');
			}

			return {
				entity: entity.name,
				field: 'id' as keyof TTargetEntity['fields'] & string, // Assuming 'id' exists in target entity
				relationship: {
					type: 'manyToMany',
					foreignKey: 'id', // This is not used directly in many-to-many but required by the type
					joinTable: options.joinTable,
				},
			};
		},
	};
}
