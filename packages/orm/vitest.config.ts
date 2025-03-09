import { resolve } from 'node:path';
import { defineConfig } from 'vitest/config';

export default defineConfig({
	test: {
		environment: 'node',
		include: ['src/**/*.spec.ts'],
		root: '.',
		setupFiles: ['dotenv/config'],
	},
	resolve: {
		alias: {
			'@': resolve(__dirname, './src'),
		},
	},
});
