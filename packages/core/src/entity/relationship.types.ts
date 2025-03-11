import type { EntityFields, EntityStructure } from './entity.types';

/**
 * Relationship type identifiers
 */
export type RelationshipType =
	| 'oneToOne'
	| 'oneToMany'
	| 'manyToOne'
	| 'manyToMany';

/**
 * Configuration for a relationship between entities
 * @template TSourceEntity Source entity in the relationship
 * @template TTargetEntity Target entity in the relationship
 */
export interface RelationshipConfig<
	TSourceEntity extends EntityStructure = EntityStructure,
	TTargetEntity extends EntityStructure = EntityStructure,
	TSourceField extends string = string,
	TTargetField extends keyof TTargetEntity['fields'] &
		string = keyof TTargetEntity['fields'] & string,
> {
	/**
	 * Foreign key field to use for the relationship. This can be a field name from either
	 * the source or target entity, or a custom string if the field hasn't been created yet.
	 */
	foreignKey: string;

	/**
	 * Type of relationship
	 */
	type: RelationshipType;

	/**
	 * Configuration for a join table in many-to-many relationships
	 */
	joinTable?: {
		/**
		 * Name of the join table
		 */
		tableName: string;

		/**
		 * Source column name (defaults to `${source.name}Id`)
		 */
		sourceColumn?: string;

		/**
		 * Target column name (defaults to `${target.name}Id`)
		 */
		targetColumn?: string;

		/**
		 * Additional fields to add to the join table
		 */
		fields?: Record<string, any>;
	};
}

/**
 * Reference to a field in another entity
 * @template TSourceEntity Source entity in the relationship
 * @template TTargetEntity Target entity in the relationship
 * @template TTargetField Field in the target entity being referenced
 */
export interface EntityFieldReference<
	TSourceEntity extends EntityStructure = EntityStructure,
	TTargetEntity extends EntityStructure = EntityStructure,
	TTargetField extends keyof TTargetEntity['fields'] &
		string = keyof TTargetEntity['fields'] & string,
> {
	/**
	 * The name of the target entity
	 */
	entity: TTargetEntity['name'];

	/**
	 * The field in the target entity
	 */
	field: TTargetField;

	/**
	 * Configuration for the relationship
	 */
	relationship?: RelationshipConfig<TSourceEntity, TTargetEntity>;
}

/**
 * Helper to create an entity field reference
 */
export interface EntityFieldReferenceCreator {
	<
		TTargetEntity extends EntityStructure,
		TTargetField extends keyof TTargetEntity['fields'] &
			string = keyof TTargetEntity['fields'] & string,
	>(
		entity: TTargetEntity,
		field: TTargetField
	): EntityFieldReference<EntityStructure, TTargetEntity, TTargetField>;
}

/**
 * Options for one-to-one and many-to-one relationships
 */
export interface BasicRelationshipOptions {
	/**
	 * Foreign key field to use for the relationship
	 */
	foreignKey?: string;
}

/**
 * Helper to create a many-to-one relationship
 */
export interface ManyToOneHelper {
	<TTargetEntity extends EntityStructure>(
		entity: TTargetEntity,
		options?: BasicRelationshipOptions
	): EntityFieldReference<EntityStructure, TTargetEntity>;
}

/**
 * Helper to create a one-to-one relationship
 */
export interface OneToOneHelper {
	<TTargetEntity extends EntityStructure>(
		entity: TTargetEntity,
		options?: BasicRelationshipOptions
	): EntityFieldReference<EntityStructure, TTargetEntity>;
}

/**
 * Helper to create a one-to-many relationship
 */
export interface OneToManyHelper {
	<TTargetEntity extends EntityStructure>(
		entity: TTargetEntity,
		options?: BasicRelationshipOptions
	): EntityFieldReference<EntityStructure, TTargetEntity>;
}

/**
 * Options for many-to-many relationships
 */
export interface ManyToManyOptions {
	/**
	 * Join table configuration
	 */
	joinTable: {
		/**
		 * Name of the join table
		 */
		tableName: string;

		/**
		 * Source column name (defaults to `${source.name}Id`)
		 */
		sourceColumn?: string;

		/**
		 * Target column name (defaults to `${target.name}Id`)
		 */
		targetColumn?: string;

		/**
		 * Additional fields to add to the join table
		 */
		fields?: Record<string, any>;
	};
}

/**
 * Helper to create a many-to-many relationship
 */
export interface ManyToManyHelper {
	<TTargetEntity extends EntityStructure>(
		entity: TTargetEntity,
		options: ManyToManyOptions
	): EntityFieldReference<EntityStructure, TTargetEntity>;
}

/**
 * Helpers for creating entity relationships
 * @template TSourceEntity The source entity these helpers will be used with
 */
export interface RelationshipHelpers<
	TSourceEntity extends EntityStructure = EntityStructure,
> {
	/**
	 * Create a reference to a field in another entity
	 */
	ref: EntityFieldReferenceCreator;

	/**
	 * Create a many-to-one relationship
	 */
	manyToOne: ManyToOneHelper;

	/**
	 * Create a one-to-one relationship
	 */
	oneToOne: OneToOneHelper;

	/**
	 * Create a one-to-many relationship
	 */
	oneToMany: OneToManyHelper;

	/**
	 * Create a many-to-many relationship
	 */
	manyToMany: ManyToManyHelper;
}
