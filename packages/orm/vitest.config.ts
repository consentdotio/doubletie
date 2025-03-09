import { resolve } from 'path';
import { defineConfig } from 'vitest/config';

export default defineConfig({
	test: {
		// Test environment and globals
		environment: 'node',
		globals: true,

		// Test organization
		include: ['tests/**/*.{test,spec}.{js,ts}', 'tests/**/*.test-d.ts'],
		exclude: ['**/node_modules/**', '**/dist/**'],

		// Type checking
		typecheck: {
			enabled: true,
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
			exclude: ['tests/fixtures/**', 'tests/types/**'],
		},

		// Configure path aliases
		alias: {
			'~': resolve(__dirname, './src'),
			tests: resolve(__dirname, './tests/*'),
		},
	},
});
