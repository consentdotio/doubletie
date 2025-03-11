/**
 * This file demonstrates how to use the different relationship types
 * in Doubletie Core.
 */

import { z } from 'zod';
import {
	createValidator,
	defineEntity,
	createField as field,
} from '../src/index';

// Define some basic entities with field-level validators
const userEntity = defineEntity({
	name: 'user',
	fields: {
		id: field('uuid', {
			required: true,
			validator: z.string().uuid(),
		}),
		name: field('string', {
			required: true,
			validator: z.string().min(2).max(100),
		}),
		email: field('string', {
			required: true,
			validator: z.string().email(),
		}),
	},
});

const profileEntity = defineEntity({
	name: 'profile',
	fields: {
		id: field('uuid', { required: true }),
		userId: field('uuid', { required: true }),
		bio: field('string', { required: false }),
		avatarUrl: field('string', { required: false }),
	},
});

const postEntity = defineEntity({
	name: 'post',
	fields: {
		id: field('uuid', { required: true }),
		title: field('string', { required: true }),
		content: field('string', { required: true }),
		authorId: field('uuid', { required: true }),
		createdAt: field('date', { required: true }),
	},
});

const tagEntity = defineEntity({
	name: 'tag',
	fields: {
		id: field('uuid', { required: true }),
		name: field('string', { required: true }),
	},
});

// Example 1: One-to-One relationship
const profileWithUser = profileEntity.withRelationships((refs) => ({
	userId: refs.oneToOne(userEntity, 'id'),
}));

const userWithProfile = userEntity.withRelationships((refs) => ({
	profile: refs.oneToOne(profileEntity, 'id', {
		foreignKey: 'userId',
	}),
}));

// Example 2: One-to-Many relationship
const userWithPosts = userEntity.withRelationships((refs) => ({
	posts: refs.oneToMany(postEntity, 'id', {
		foreignKey: 'authorId',
	}),
}));

// Example 3: Many-to-One relationship
const postWithAuthor = postEntity.withRelationships((refs) => ({
	authorId: refs.manyToOne(userEntity, 'id'),
}));

// Example 4: Many-to-Many relationship
const postWithTags = postEntity.withRelationships((refs) => ({
	tags: refs.manyToMany(tagEntity, {
		tableName: 'post_tags',
		sourceColumn: 'postId',
		targetColumn: 'tagId',
	}),
}));

const tagWithPosts = tagEntity.withRelationships((refs) => ({
	posts: refs.manyToMany(postEntity, {
		tableName: 'post_tags',
		sourceColumn: 'tagId',
		targetColumn: 'postId',
		// Additional metadata in the join table
		additionalColumns: {
			addedAt: field('date', { required: true }),
		},
	}),
}));

// Example 5: Using additional configuration options
const userWithPostsCascade = userEntity.withRelationships((refs) => ({
	posts: refs.oneToMany(postEntity, 'id', {
		foreignKey: 'authorId',
		cascade: true, // Delete posts when user is deleted
		fetch: 'eager', // Always fetch posts with user
	}),
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
	userWithPostsCascade,
};
