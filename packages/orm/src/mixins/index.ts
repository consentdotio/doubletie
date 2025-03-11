/**
 * Model mixins for enhancing base model functionality
 *
 * Includes enhancements for:
 * - Automatic timestamps (created_at, updated_at)
 * - Slug generation
 * - ID generation
 * - Cursor-based pagination
 * - Global ID handling
 *
 * New in 0.27.0: Enhanced setter methods for direct column updates
 *
 * @module mixins
 */

export { default as withUpdatedAt } from './updated-at.js';
export { default as withCreatedAt } from './created-at.js';
export { withSlug } from './slug.js';
export { withGlobalId } from './global-id.js';
export {
	default as withIdGenerator,
	type IdGeneratorOptions,
} from './id-generator.js';
export { default as withCursorable } from './cursorable.js';
export { default as withAssignProperties } from './assign.js';

export { Operation } from './slug.js';

// No need for separate export, now included with the default export
