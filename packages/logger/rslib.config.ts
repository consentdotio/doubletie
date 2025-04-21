import { defineConfig } from '@rslib/core';

export default defineConfig({
	source: {
		entry: {
			index: ['./src/index.ts'],
			'redirect-nextjs': ['./src/redirect/nextjs.ts'],
			'redirect-console': ['./src/redirect/console.ts'],
			'redirect-all': ['./src/redirect/all.ts'],
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
			dts: false,
			bundle: true,
			format: 'cjs',
		},
	],
	output: {
		target: 'web',
		externals: {
			next: 'commonjs next',
			'next/dist/build/output/log': 'commonjs next/dist/build/output/log',
			'@opentelemetry/api': 'commonjs @opentelemetry/api'
		},
		cleanDistPath: true,
	},
});

