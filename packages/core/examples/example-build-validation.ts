/**
 * Example file showing build-time validation of references
 */
import { z } from 'zod';
import {
	EntityFields,
	EntityStructure,
	IsValidReference,
	ValidateReferences,
	defineEntity,
	field,
} from '../src/index';

// Define entities
const userEntity = defineEntity(
	{
		name: 'user',
		fields: {
			id: field('uuid', {
				required: true,
				validator: z.string().uuid(),
			}),
			email: field('string', {
				required: true,
				validator: z.string().email(),
			}),
			name: field('string', {
				required: true,
				validator: z.string(),
			}),
		},
	},
	// Entity-level validator
	z.object({
		id: z.string().uuid(),
		email: z.string().email(),
		name: z.string(),
	})
);

const postEntity = defineEntity({
	name: 'post',
	fields: {
		id: field('uuid', {
			required: true,
			validator: z.string().uuid(),
		}),
		title: field('string', {
			required: true,
			validator: z.string(),
		}),
		content: field('string', {
			required: true,
			validator: z.string(),
		}),
		userId: field('string', {
			required: true,
			validator: z.string(),
		}),
	},
});

// Example of build-time validation

// 1. Check if a field exists on an entity using IsValidReference
type UserHasId = IsValidReference<typeof userEntity, 'id'>; // true
type UserHasNonExistentField = IsValidReference<
	typeof userEntity,
	'nonExistent'
>; // false

// These types can be used in conditional types
type OnlyIfFieldExists<
	E extends EntityStructure,
	F extends string,
> = IsValidReference<E, F> extends true ? string : never;

// Example of conditional type based on field existence
type UserIdType = OnlyIfFieldExists<typeof userEntity, 'id'>; // string
type NonExistentFieldType = OnlyIfFieldExists<typeof userEntity, 'nonExistent'>; // never

// 2. Extract and work with entity fields
type UserFields = EntityFields<typeof userEntity>; // 'id' | 'email' | 'name'

// You can use these in type-safe functions
function getFieldValue<E extends EntityStructure, F extends EntityFields<E>>(
	entity: E,
	fieldName: F,
	data: Record<string, unknown>
): unknown {
	return data[fieldName as string];
}

// 3. Build-time validation in withReferences
type PostReferences = {
	userId: { model: 'user'; field: 'id' }; // correct
};

// Validate references at build time
type ValidPostReferences = ValidateReferences<
	typeof postEntity,
	PostReferences
>;
// Every field in ValidPostReferences should exactly match PostReferences if valid

// Example of invalid references
type InvalidPostReferences = {
	userId: { model: 'user'; field: 'nonExistent' }; // invalid - field doesn't exist
};

// This will result in a type with 'never' properties for invalid references
type ValidatedInvalidRefs = ValidateReferences<
	typeof postEntity,
	InvalidPostReferences
>;

// 4. Runtime usage of build-time validated references
const commentEntity = defineEntity({
	name: 'comment',
	fields: {
		id: field('uuid', {
			required: true,
			validator: z.string().uuid(),
		}),
		content: field('string', {
			required: true,
			validator: z.string(),
		}),
		postId: field('string', {
			required: true,
			validator: z.string(),
		}),
		userId: field('string', {
			required: true,
			validator: z.string(),
		}),
	},
})
	// At build time, TypeScript will validate that these references are correct
	.withReferences((refs) => ({
		postId: refs.to(postEntity, 'userId'), // Valid - compiles
		userId: refs.to(userEntity, 'id'), // Valid - compiles

		// Uncommenting the following line would cause a build error:
		// badRef: refs.to(userEntity, 'nonExistent') // Error: Type '"nonExistent"' is not assignable to type...
	}));

// The withReferences method returns an enhanced entity with reference information
const commentWithUserName = commentEntity.withReferences((refs) => ({
	// You can add or modify references
	postId: refs.to(postEntity, 'id'),
	userId: refs.to(userEntity, 'name'), // Reference user name instead of id
}));

// The full entity type is preserved with its references
console.log(
	'Comment references postId field:',
	commentEntity.references.postId.model, // 'post'
	commentEntity.references.postId.field // 'id'
);

// Main benefit: invalid references are caught at build time
// This provides extra safety on top of the runtime validation
