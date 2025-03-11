import type { SchemaField } from '../schema/schema.types';
import type { EntityFields, EntityStructure } from './entity.types';

/**
 * Supported relationship types
 */
export type RelationshipType =
	| 'oneToOne'
	| 'oneToMany'
	| 'manyToOne'
	| 'manyToMany';

/**
 * Join table configuration for many-to-many relationships
 */
export interface JoinTableConfig<
	SourceEntity extends EntityStructure = any,
	TargetEntity extends EntityStructure = any,
> {
	/**
	 * Name of the join table
	 */
	tableName: string;

	/**
	 * Column in the join table that references the source entity
	 * If not provided, defaults to `${sourceName}Id`
	 */
	sourceColumn?: (keyof SourceEntity['fields'] & string) | string;

	/**
	 * Column in the join table that references the target entity
	 * If not provided, defaults to `${targetName}Id`
	 */
	targetColumn?: (keyof TargetEntity['fields'] & string) | string;

	/**
	 * Additional columns to include in the join table
	 */
	additionalColumns?: Record<string, SchemaField>;
}

/**
 * Configuration for an entity relationship
 */
export type RelationshipConfig<
	E1 extends EntityStructure,
	E2 extends EntityStructure,
> = {
	type: 'oneToOne' | 'oneToMany' | 'manyToOne' | 'manyToMany';
	/**
	 * Name of the column that stores the foreign key in source entity
	 * Only used for oneToOne and manyToOne relationships
	 */
	foreignKey?: keyof E1['fields'] & string;
	/**
	 * Configuration for a join table - only used for manyToMany relationships
	 */
	joinTable?: JoinTableConfig<E1, E2>;
	cascade?: boolean;
	fetch?: 'lazy' | 'eager';
};

/**
 * A relationship to a field in an entity, used to build foreign keys
 */
export type EntityFieldReference<
	E extends EntityStructure,
	F extends EntityFields<E> & string,
> = {
	model: E['name'];
	field: F;
	relationship?: RelationshipConfig<any, E>;
};

/**
 * Helper type to validate a relationship at build time
 * This will cause a compile error if the field doesn't exist on the target entity
 */
export type ValidatedRelationship<
	TargetEntity extends EntityStructure,
	FieldName extends EntityFields<TargetEntity> & string,
> = EntityFieldReference<TargetEntity, FieldName>;

/**
 * Validate that a foreign key is a valid field name in the target entity
 */
export type ValidateForeignKey<
	Source extends EntityStructure,
	Target extends EntityStructure,
	Key extends string,
> = Key extends EntityFields<Target> ? Key : never;

/**
 * Validate that the relationship configuration is valid
 */
export type ValidateRelationshipConfig<
	Source extends EntityStructure,
	Target extends EntityStructure,
	Config extends RelationshipConfig<Source, Target>,
> = {
	type?: Config['type'];

	// For one-to-many, the foreignKey must be a valid field name in the target entity
	foreignKey?: Config['type'] extends 'oneToMany'
		? ValidateForeignKey<Source, Target, NonNullable<Config['foreignKey']>>
		: Config['foreignKey'];

	// Join table validation occurs at runtime since we don't have the structure
	// of the join table at build time
	joinTable?: Config['joinTable'];

	cascade?: Config['cascade'];
	fetch?: Config['fetch'];
};

/**
 * Get a fully validated relationship configuration
 */
export type GetValidatedRelationshipConfig<
	Source extends EntityStructure,
	Target extends EntityStructure,
	Config extends RelationshipConfig<Source, Target>,
> = Config extends any
	? ValidateRelationshipConfig<Source, Target, Config>
	: never;

/**
 * Validate relationship integrity at build time
 * This will cause a compile error if an invalid relationship is detected
 */
export type ValidateRelationships<
	E extends EntityStructure,
	R extends Record<
		string,
		{ model: string; field: any; relationship?: RelationshipConfig<any, any> }
	>,
> = {
	[K in keyof R]: K extends keyof E['fields']
		? R[K]['field'] extends EntityFields<{
				name: R[K]['model'];
				fields: Record<string, any>;
			}>
			? R[K]
			: never // Invalid relationship field
		: never; // Invalid source field
};

/**
 * Check if a relationship is valid at build time
 * Usage: type check = IsValidRelationship<typeof targetEntity, 'id'> // true or false
 */
export type IsValidRelationship<
	E extends EntityStructure,
	F extends string,
> = F extends EntityFields<E> ? true : false;

/**
 * Define the interface for relationship helper methods
 */
export interface RelationshipHelpers {
	/**
	 * Create a type-safe many-to-one relationship to another entity's field
	 */
	manyToOne<
		E extends any,
		F extends EntityFields<E> & string,
		SourceEntity extends EntityStructure,
	>(
		targetEntity: E,
		fieldName: F,
		options?: Omit<
			RelationshipConfig<SourceEntity, E>,
			'type' | 'foreignKey' | 'joinTable'
		>
	): ValidatedRelationship<E, F>;

	/**
	 * Create a type-safe one-to-one relationship to another entity's field
	 */
	oneToOne<
		E extends any,
		F extends EntityFields<E> & string,
		SourceEntity extends EntityStructure,
	>(
		targetEntity: E,
		fieldName: F,
		options?: Omit<
			RelationshipConfig<SourceEntity, E>,
			'type' | 'joinTable'
		> & {
			foreignKey?: keyof E['fields'] & string;
		}
	): ValidatedRelationship<E, F>;

	/**
	 * Create a type-safe one-to-many relationship to another entity
	 */
	oneToMany<
		E extends any,
		F extends EntityFields<E> & string,
		SourceEntity extends EntityStructure,
	>(
		targetEntity: E,
		fieldName: F,
		options: Omit<RelationshipConfig<SourceEntity, E>, 'type' | 'joinTable'> & {
			foreignKey: keyof E['fields'] & string;
		}
	): ValidatedRelationship<E, F>;

	/**
	 * Create a type-safe many-to-many relationship with another entity
	 */
	manyToMany<E extends any, SourceEntity extends EntityStructure>(
		targetEntity: E,
		joinTableConfig: JoinTableConfig<SourceEntity, E> & {
			cascade?: boolean;
			fetch?: 'lazy' | 'eager';
		}
	): {
		model: E['name'];
		field: 'id';
		relationship: RelationshipConfig<SourceEntity, E>;
	};
}
