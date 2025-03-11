import type { EntityFields, EntityStructure } from './entity.types';
import type {
	JoinTableConfig,
	RelationshipConfig,
	RelationshipHelpers,
	ValidatedRelationship,
} from './relationship.types';

/**
 * Create relationship helpers with a given entity structure
 * @param entityStructure The entity structure to create helpers for
 * @returns Relationship helper methods
 */
export function createRelationshipHelpers<
	ThisEntityStructure extends EntityStructure,
>(entityStructure: ThisEntityStructure): RelationshipHelpers {
	return {
		manyToOne<
			TargetE extends any,
			F extends EntityFields<TargetE> & string,
			Config extends RelationshipConfig<
				ThisEntityStructure,
				TargetE
			> = RelationshipConfig<ThisEntityStructure, TargetE>,
		>(
			targetEntity: TargetE,
			fieldName: F,
			options?: Omit<Config, 'type' | 'foreignKey' | 'joinTable'>
		): ValidatedRelationship<TargetE, F> {
			return {
				model: targetEntity.name,
				field: fieldName,
				relationship: {
					...options,
					type: 'manyToOne',
				},
			} as ValidatedRelationship<TargetE, F>;
		},

		oneToOne<
			TargetE extends any,
			F extends EntityFields<TargetE> & string,
			Config extends RelationshipConfig<
				ThisEntityStructure,
				TargetE
			> = RelationshipConfig<ThisEntityStructure, TargetE>,
		>(
			targetEntity: TargetE,
			fieldName: F,
			options?: Omit<Config, 'type' | 'joinTable'> & {
				foreignKey?: keyof TargetE['fields'] & string;
			}
		): ValidatedRelationship<TargetE, F> {
			// If foreignKey is specified, validate it exists in the target entity
			if (
				options?.foreignKey &&
				!targetEntity.fields[options.foreignKey as string]
			) {
				throw new Error(
					`Relationship Error: Foreign key '${options.foreignKey}' does not exist in entity '${targetEntity.name}'.` +
						` Available fields: ${Object.keys(targetEntity.fields).join(', ')}`
				);
			}

			return {
				model: targetEntity.name,
				field: fieldName,
				relationship: {
					...options,
					type: 'oneToOne',
				},
			} as ValidatedRelationship<TargetE, F>;
		},

		oneToMany<
			TargetE extends any,
			F extends EntityFields<TargetE> & string,
			Config extends RelationshipConfig<
				ThisEntityStructure,
				TargetE
			> = RelationshipConfig<ThisEntityStructure, TargetE>,
		>(
			targetEntity: TargetE,
			fieldName: F,
			options: Omit<Config, 'type' | 'joinTable'> & {
				foreignKey: keyof TargetE['fields'] & string;
			}
		): ValidatedRelationship<TargetE, F> {
			// Validate the foreignKey exists in the target entity
			if (!targetEntity.fields[options.foreignKey as string]) {
				throw new Error(
					`Relationship Error: Foreign key '${options.foreignKey}' does not exist in entity '${targetEntity.name}'.` +
						` Available fields: ${Object.keys(targetEntity.fields).join(', ')}`
				);
			}

			return {
				model: targetEntity.name,
				field: fieldName,
				relationship: {
					...options,
					type: 'oneToMany',
				},
			} as ValidatedRelationship<TargetE, F>;
		},

		manyToMany<
			TargetE extends any,
			Config extends RelationshipConfig<
				ThisEntityStructure,
				TargetE
			> = RelationshipConfig<ThisEntityStructure, TargetE>,
		>(
			targetEntity: TargetE,
			joinTableConfig: JoinTableConfig<ThisEntityStructure, TargetE> & {
				cascade?: boolean;
				fetch?: 'lazy' | 'eager';
			}
		): {
			model: TargetE['name'];
			field: 'id';
			relationship: RelationshipConfig<ThisEntityStructure, TargetE>;
		} {
			// Validate join table config
			if (!joinTableConfig.tableName) {
				throw new Error(
					'Join table name is required for many-to-many relationships'
				);
			}

			const { cascade, fetch, ...joinTableDetails } = joinTableConfig;

			// Create a relationship configuration with many-to-many type and the join table config
			const relationshipConfig: RelationshipConfig<
				ThisEntityStructure,
				TargetE
			> = {
				type: 'manyToMany',
				joinTable: joinTableDetails,
				cascade,
				fetch,
			};

			// Return the relationship object
			return {
				model: targetEntity.name,
				field: 'id' as const, // We use 'id' by convention for collections
				relationship: relationshipConfig,
			};
		},
	};
}
