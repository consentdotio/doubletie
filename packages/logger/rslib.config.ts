import { defineConfig } from '@rslib/core';

export default defineConfig({
	source: {
		entry: {
			index: ['./src/index.ts'],
			core: ['./src/core/index.ts'],
			formatting: ['./src/formatting/index.ts'],
			utils: ['./src/utils/index.ts'],
			'rewrite-nextjs': ['./src/redirect/nextjs.ts'],
			'rewrite-console': ['./src/redirect/console.ts'],
			'rewrite-all': ['./src/redirect/all.ts'],
		},
		exclude: ['./__tests__/**'],
	},
	lib: [
		{
			dts: true,
			bundle: true,
			format: 'esm',
		},
		{
			dts: true,
			bundle: true,
			format: 'cjs',
		},
	],
	output: {
		target: 'node',
		cleanDistPath: true,
	},
});
