// import type { StandardSchemaV1 } from '@standard-schema/spec';
// import type { DatabaseConfig } from './config';
// import { mergeSchemaWithConfig } from './merge';
// import type { EntitySchemaDefinition, SchemaField } from './schema';
// import type {
// 	EntityFieldReference,
// 	EntityFields,
// 	EntityFromDefinition,
// 	EntityStructure,
// 	GetValidatedRelationshipConfig,
// 	JoinTableConfig,
// 	RelationshipConfig,
// 	ValidateRelationshipConfig,
// 	ValidateRelationships,
// 	ValidatedRelationship,
// } from './types';
// import { validateEntity, validateEntityWithFieldValidators } from './validate';

// // Relationship helpers interface for strong typing
// export interface RelationshipHelpers {
// 	/**
// 	 * Create a type-safe many-to-one relationship to another entity's field
// 	 * @param targetEntity The entity being referenced
// 	 * @param fieldName A field name from the target entity
// 	 * @param options Optional configuration for the relationship
// 	 * @returns A relationship object to be used in field definitions
// 	 *
// 	 * @example
// 	 * ```typescript
// 	 * withRelationships(rel => ({
// 	 *   // Many-to-one relationship (default)
// 	 *   authorId: rel.manyToOne(authorEntity, 'id')
// 	 * }))
// 	 * ```
// 	 */
// 	manyToOne<
// 		E extends ReturnType<typeof defineEntity>,
// 		F extends EntityFields<E> & string,
// 		SourceEntity extends EntityStructure,
// 	>(
// 		targetEntity: E,
// 		fieldName: F,
// 		options?: Omit<
// 			RelationshipConfig<SourceEntity, E>,
// 			'type' | 'foreignKey' | 'joinTable'
// 		>
// 	): ValidatedRelationship<E, F>;

// 	/**
// 	 * Create a type-safe one-to-one relationship to another entity's field
// 	 * @param targetEntity The entity being referenced
// 	 * @param fieldName A field name from the target entity
// 	 * @param options Configuration for the relationship
// 	 * @returns A relationship object to be used in field definitions
// 	 *
// 	 * @example
// 	 * ```typescript
// 	 * // Direct relationship (where this entity has the foreign key)
// 	 * profile.withRelationships(rel => ({
// 	 *   userId: rel.oneToOne(userEntity, 'id')
// 	 * }))
// 	 *
// 	 * // Inverse relationship (where the target entity has the foreign key)
// 	 * user.withRelationships(rel => ({
// 	 *   profile: rel.oneToOne(profileEntity, 'id', {
// 	 *     foreignKey: 'userId'
// 	 *   })
// 	 * }))
// 	 * ```
// 	 */
// 	oneToOne<
// 		E extends ReturnType<typeof defineEntity>,
// 		F extends EntityFields<E> & string,
// 		SourceEntity extends EntityStructure,
// 	>(
// 		targetEntity: E,
// 		fieldName: F,
// 		options?: Omit<
// 			RelationshipConfig<SourceEntity, E>,
// 			'type' | 'joinTable'
// 		> & {
// 			/**
// 			 * For inverse relationships, the foreign key in the target entity
// 			 * that refers to this entity's primary key
// 			 */
// 			foreignKey?: keyof E['fields'] & string;
// 		}
// 	): ValidatedRelationship<E, F>;

// 	/**
// 	 * Create a type-safe one-to-many relationship to another entity
// 	 * @param targetEntity The entity collection being referenced
// 	 * @param fieldName The primary key field of the target entity (usually 'id')
// 	 * @param options Configuration for the relationship
// 	 * @returns A relationship object to be used in field definitions
// 	 *
// 	 * @example
// 	 * ```typescript
// 	 * // One-to-many relationship
// 	 * author.withRelationships(rel => ({
// 	 *   books: rel.oneToMany(bookEntity, 'id', {
// 	 *     foreignKey: 'authorId', // Field in bookEntity that refers to author
// 	 *     cascade: true
// 	 *   })
// 	 * }))
// 	 * ```
// 	 */
// 	oneToMany<
// 		E extends ReturnType<typeof defineEntity>,
// 		F extends EntityFields<E> & string,
// 		SourceEntity extends EntityStructure,
// 	>(
// 		targetEntity: E,
// 		fieldName: F,
// 		options: Omit<RelationshipConfig<SourceEntity, E>, 'type' | 'joinTable'> & {
// 			/**
// 			 * The foreign key in the target entity that refers to this entity's primary key
// 			 * This must be a valid field in the target entity
// 			 */
// 			foreignKey: keyof E['fields'] & string;
// 		}
// 	): ValidatedRelationship<E, F>;

// 	/**
// 	 * Create a type-safe many-to-many relationship with another entity
// 	 * @param targetEntity The entity to create a many-to-many relationship with
// 	 * @param joinTableConfig Configuration for the join table
// 	 * @returns A relationship object to be used in field definitions
// 	 *
// 	 * @example
// 	 * ```typescript
// 	 * withRelationships(rel => ({
// 	 *   // Many-to-many relationship
// 	 *   tags: rel.manyToMany(tagEntity, {
// 	 *     tableName: 'post_tags',
// 	 *     sourceColumn: 'postId',
// 	 *     targetColumn: 'tagId',
// 	 *     additionalColumns: {
// 	 *       addedAt: field('date', { required: true })
// 	 *     }
// 	 *   })
// 	 * }))
// 	 * ```
// 	 */
// 	manyToMany<
// 		E extends ReturnType<typeof defineEntity>,
// 		SourceEntity extends EntityStructure,
// 	>(
// 		targetEntity: E,
// 		joinTableConfig: JoinTableConfig<SourceEntity, E> & {
// 			/**
// 			 * Additional options for the relationship
// 			 */
// 			cascade?: boolean;
// 			fetch?: 'lazy' | 'eager';
// 		}
// 	): {
// 		model: E['name'];
// 		field: 'id'; // Defaulting to id since it's conceptually a collection
// 		relationship: RelationshipConfig<SourceEntity, E>;
// 	};
// }

// // Generate a table using schema information
// function generateTable(entityDef: any) {
// 	// ... This would contain your actual table generation logic
// 	return {} as any; // Placeholder
// }

// export function defineEntity<
// 	TName extends string,
// 	TFields extends Record<string, SchemaField<any, any>>,
// 	TValidator extends StandardSchemaV1,
// >(
// 	schema: { name: TName; fields: TFields },
// 	validator?: TValidator
// ): EntityFromDefinition<TName, TFields, TValidator> {
// 	// Create the base entity with schema fields
// 	const baseEntity = {
// 		name: schema.name,
// 		prefix: '',
// 		fields: { ...schema.fields },
// 		config: {},
// 		order: 0,
// 		validator,
// 	};

// 	function resolveWithConfig(runtimeConfig: DatabaseConfig) {
// 		return mergeSchemaWithConfig(baseEntity, runtimeConfig);
// 	}

// 	// Pre-resolve if config provided
// 	const resolved = config ? resolveWithConfig(config) : undefined;

// 	// Create the entity object with all its methods
// 	const entity = {
// 		...baseEntity,
// 		resolved,
// 		resolveWithConfig,

// 		// Validate using Standard Schema
// 		validate: async (data: StandardSchemaV1.InferInput<V>) => {
// 			if (validator) {
// 				return await validateEntity(validator, data);
// 			} else if (baseEntity.validator) {
// 				return await validateEntity(baseEntity.validator, data);
// 			} else {
// 				// Fall back to field-by-field validation
// 				return await validateEntityWithFieldValidators(
// 					baseEntity,
// 					data as Record<string, unknown>
// 				);
// 			}
// 		},

// 		// Type helpers
// 		type: {} as StandardSchemaV1.InferInput<V>,
// 		outputType: {} as StandardSchemaV1.InferOutput<V>,

// 		// Table generation
// 		getTable: (runtimeConfig?: DatabaseConfig) => {
// 			const entityDef =
// 				resolved ||
// 				(runtimeConfig ? resolveWithConfig(runtimeConfig) : baseEntity);
// 			return generateTable(entityDef as any);
// 		},

// 		// Builder pattern for type-safe relationships
// 		withRelationships<R extends Record<string, EntityFieldReference<any, any>>>(
// 			relationshipFn: (helpers: RelationshipHelpers) => R
// 		) {
// 			// Calculate entity structure type for validation
// 			type ThisEntityStructure = EntityStructure<T['name'], T['fields']>;

// 			// Static type validation of relationships
// 			type ValidatedRels = ValidateRelationships<ThisEntityStructure, R>;

// 			// Ensure ValidatedRels doesn't contain any 'never' types
// 			// This will cause a compile error if invalid relationships are detected
// 			type _EnsureValidRelationships = [ValidatedRels] extends [R]
// 				? true
// 				: false;

// 			// Create relationship helpers with type inference capabilities
// 			const helpers: RelationshipHelpers = {
// 				manyToOne<
// 					TargetE extends ReturnType<typeof defineEntity>,
// 					F extends EntityFields<TargetE> & string,
// 					Config extends RelationshipConfig<
// 						ThisEntityStructure,
// 						TargetE
// 					> = RelationshipConfig<ThisEntityStructure, TargetE>,
// 				>(
// 					targetEntity: TargetE,
// 					fieldName: F,
// 					options?: Omit<Config, 'type' | 'foreignKey' | 'joinTable'>
// 				): ValidatedRelationship<TargetE, F> {
// 					return {
// 						model: targetEntity.name,
// 						field: fieldName,
// 						relationship: {
// 							...options,
// 							type: 'manyToOne',
// 						},
// 					} as ValidatedRelationship<TargetE, F>;
// 				},

// 				oneToOne<
// 					TargetE extends ReturnType<typeof defineEntity>,
// 					F extends EntityFields<TargetE> & string,
// 					Config extends RelationshipConfig<
// 						ThisEntityStructure,
// 						TargetE
// 					> = RelationshipConfig<ThisEntityStructure, TargetE>,
// 				>(
// 					targetEntity: TargetE,
// 					fieldName: F,
// 					options?: Omit<Config, 'type' | 'joinTable'> & {
// 						foreignKey?: keyof TargetE['fields'] & string;
// 					}
// 				): ValidatedRelationship<TargetE, F> {
// 					// If foreignKey is specified, validate it exists in the target entity
// 					if (
// 						options?.foreignKey &&
// 						!targetEntity.fields[options.foreignKey as string]
// 					) {
// 						throw new Error(
// 							`Relationship Error: Foreign key '${options.foreignKey}' does not exist in entity '${targetEntity.name}'.` +
// 								` Available fields: ${Object.keys(targetEntity.fields).join(', ')}`
// 						);
// 					}

// 					return {
// 						model: targetEntity.name,
// 						field: fieldName,
// 						relationship: {
// 							...options,
// 							type: 'oneToOne',
// 						},
// 					} as ValidatedRelationship<TargetE, F>;
// 				},

// 				oneToMany<
// 					TargetE extends ReturnType<typeof defineEntity>,
// 					F extends EntityFields<TargetE> & string,
// 					Config extends RelationshipConfig<
// 						ThisEntityStructure,
// 						TargetE
// 					> = RelationshipConfig<ThisEntityStructure, TargetE>,
// 				>(
// 					targetEntity: TargetE,
// 					fieldName: F,
// 					options: Omit<Config, 'type' | 'joinTable'> & {
// 						foreignKey: keyof TargetE['fields'] & string;
// 					}
// 				): ValidatedRelationship<TargetE, F> {
// 					// Validate the foreignKey exists in the target entity
// 					if (!targetEntity.fields[options.foreignKey as string]) {
// 						throw new Error(
// 							`Relationship Error: Foreign key '${options.foreignKey}' does not exist in entity '${targetEntity.name}'.` +
// 								` Available fields: ${Object.keys(targetEntity.fields).join(', ')}`
// 						);
// 					}

// 					return {
// 						model: targetEntity.name,
// 						field: fieldName,
// 						relationship: {
// 							...options,
// 							type: 'oneToMany',
// 						},
// 					} as ValidatedRelationship<TargetE, F>;
// 				},

// 				manyToMany<
// 					TargetE extends ReturnType<typeof defineEntity>,
// 					Config extends RelationshipConfig<
// 						ThisEntityStructure,
// 						TargetE
// 					> = RelationshipConfig<ThisEntityStructure, TargetE>,
// 				>(
// 					targetEntity: TargetE,
// 					joinTableConfig: JoinTableConfig<ThisEntityStructure, TargetE> & {
// 						cascade?: boolean;
// 						fetch?: 'lazy' | 'eager';
// 					}
// 				): {
// 					model: TargetE['name'];
// 					field: 'id';
// 					relationship: RelationshipConfig<ThisEntityStructure, TargetE>;
// 				} {
// 					// Validate join table config
// 					if (!joinTableConfig.tableName) {
// 						throw new Error(
// 							'Join table name is required for many-to-many relationships'
// 						);
// 					}

// 					const { cascade, fetch, ...joinTableDetails } = joinTableConfig;

// 					// Create a relationship configuration with many-to-many type and the join table config
// 					const relationshipConfig: RelationshipConfig<
// 						ThisEntityStructure,
// 						TargetE
// 					> = {
// 						type: 'manyToMany',
// 						joinTable: joinTableDetails,
// 						cascade,
// 						fetch,
// 					};

// 					// Return the relationship object
// 					return {
// 						model: targetEntity.name,
// 						field: 'id' as const, // We use 'id' by convention for collections
// 						relationship: relationshipConfig,
// 					};
// 				},
// 			};

// 			// Apply relationships with type checking
// 			const relationships = relationshipFn(helpers);

// 			// Update fields with relationships
// 			for (const [fieldName, relationship] of Object.entries(relationships)) {
// 				if (entity.fields[fieldName]) {
// 					entity.fields[fieldName].relationship = relationship;
// 				} else {
// 					throw new Error(
// 						`Relationship Error: Cannot add relationship to non-existent field '${fieldName}' in entity '${entity.name}'.` +
// 							` Available fields: ${Object.keys(entity.fields).join(', ')}`
// 					);
// 				}
// 			}

// 			// Return new entity with relationships
// 			return {
// 				...entity,
// 				relationships,
// 			};
// 		},
// 	};

// 	return entity as EntityFromDefinition<T, V>;
// }
