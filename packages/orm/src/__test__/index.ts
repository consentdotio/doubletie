/**
 * Test Suite Index
 *
 * This file imports all test files to make it easier to run them together.
 * You can run all tests using: npx vitest run test/unit
 */

// Common setup is imported by each test file
import './common-setup';

// Import all test files
import './isolation.spec';
import './crud.spec';
import './transactions.spec';
import './slug.spec';
import './global-id.spec';
import './pagination.spec';
import './error-handling.spec';
import './mixin-composition.spec';
import './query-building.spec';
import './advanced-operations.spec';
import './id-generator.spec';
