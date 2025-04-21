import { defineConfig } from '@rslib/core';

export default defineConfig({
	source: {
		entry: {
			index: ['./src/index.ts'],
			'rewrite-nextjs': ['./src/redirect/nextjs.ts'],
			'rewrite-console': ['./src/redirect/console.ts'],
			'rewrite-all': ['./src/redirect/all.ts'],
		},
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
