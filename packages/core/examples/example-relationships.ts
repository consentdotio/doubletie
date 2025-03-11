/**
 * This file demonstrates how to use the different relationship types
 * in Doubletie Core.
 */

import { z } from 'zod';
import { defineEntity } from '../src/entity/entity';
import { createField } from '../src/schema/fields';

// Define some basic entities with field-level validators
const userEntity = defineEntity({
	name: 'user',
	fields: {
		id: createField('uuid', { required: true }),
		name: createField('string', { required: true }),
		email: createField('string', { required: true }),
	},
});

const profileEntity = defineEntity({
	name: 'profile',
	fields: {
		id: createField('uuid', { required: true }),
		userId: createField('uuid', { required: true }),
		bio: createField('string', { required: false }),
		avatarUrl: createField('string', { required: false }),
	},
});

const postEntity = defineEntity({
	name: 'post',
	fields: {
		id: createField('uuid', { required: true }),
		title: createField('string', { required: true }),
		content: createField('string', { required: true }),
		authorId: createField('uuid', { required: true }),
		createdAt: createField('date', { required: true }),
	},
});

const tagEntity = defineEntity({
	name: 'tag',
	fields: {
		id: createField('uuid', { required: true }),
		name: createField('string', { required: true }),
	},
});

// Example 1: One-to-One relationship
const profileWithUser = profileEntity.withRelationships((refs) => ({
	user: refs.oneToOne(userEntity, {
		foreignKey: 'userId',
	}),
}));

const userWithProfile = userEntity.withRelationships((refs) => ({
	profile: refs.oneToOne(profileEntity, {
		foreignKey: 'userId',
	}),
}));

// Example 2: One-to-Many relationship
const userWithPosts = userEntity.withRelationships((refs) => ({
	posts: refs.oneToMany(postEntity, {
		foreignKey: 'authorId',
	}),
}));

// Example 3: Many-to-One relationship
const postWithAuthor = postEntity.withRelationships((refs) => ({
	author: refs.manyToOne(userEntity, {
		foreignKey: 'authorId',
	}),
}));

// Example 4: Many-to-Many relationship
const postWithTags = postEntity.withRelationships((refs) => ({
	tags: refs.manyToMany(tagEntity, {
		joinTable: {
			tableName: 'post_tags',
			sourceColumn: 'postId',
			targetColumn: 'tagId',
		},
	}),
}));

const tagWithPosts = tagEntity.withRelationships((refs) => ({
	posts: refs.manyToMany(postEntity, {
		joinTable: {
			tableName: 'post_tags',
			sourceColumn: 'tagId',
			targetColumn: 'postId',
			fields: {
				addedAt: createField('date', { required: true }),
			},
		},
	}),
}));

// Example 5: Using a direct field reference
const userWithEmail = userEntity.withRelationships((refs) => ({
	emailRef: refs.ref(userEntity, 'email'),
}));

// Export the entities with their relationships
export {
	userEntity,
	profileEntity,
	postEntity,
	tagEntity,
	profileWithUser,
	userWithProfile,
	userWithPosts,
	postWithAuthor,
	postWithTags,
	tagWithPosts,
	userWithEmail,
};
