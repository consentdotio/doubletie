/**
 * Entity module exports
 * @module entity
 */

// Entity definition exports
export { defineEntity } from './entity';
export { createRelationshipHelpers } from './relationship';

// Entity types
export type {
	EntityFields,
	EntityStructure,
	EntityFromDefinition,
	EntityWithRelationships,
	EntityInput,
	EntityOutput,
	WithRelationships,
} from './entity.types';

// Relationship types
export type {
	RelationshipType,
	JoinTableConfig,
	RelationshipConfig,
	EntityFieldReference,
	ValidatedRelationship,
	ValidateRelationships,
	IsValidRelationship,
	RelationshipHelpers,
} from './relationship.types';
