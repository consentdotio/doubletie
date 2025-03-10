import { resolve } from 'path';
import { defineConfig } from 'vitest/config';

export default defineConfig({
	test: {
		// Test environment and globals
		environment: 'node',
		globals: true,

		// Stop on first failure
		failFast: true,

		// Test organization
		include: [
			'src/__tests__/**/*.{test,spec}.{js,ts}',
			'src/__tests__/**/*.test-d.ts',
		],
		exclude: ['**/node_modules/**', '**/dist/**'],

		// Type checking - temporarily disabled
		typecheck: {
			enabled: false,
			tsconfig: './tsconfig.json',
			ignoreSourceErrors: false,
		},

		// Configure test suites
		testNamePattern:
			process.env.TEST_TYPE === 'e2e'
				? 'e2e'
				: process.env.TEST_TYPE === 'unit'
					? 'unit'
					: undefined,

		// Configure coverage
		coverage: {
			provider: 'v8',
			reporter: ['text', 'json', 'html'],
			exclude: ['src/__tests__/fixtures/**', 'src/__tests__/types/**'],
		},

		// Configure path aliases
		alias: {
			'~': resolve(__dirname, './src'),
			'~/tests': resolve(__dirname, './src/__tests__'),
		},
	},
});
