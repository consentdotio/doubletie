import { pluginNodePolyfill } from '@rsbuild/plugin-node-polyfill';
import { defineConfig } from '@rslib/core';

export default defineConfig({
	plugins: [
		pluginNodePolyfill({
			force: true,
		}),
	],
	source: {
		entry: {
			index: ['./src/index.ts'],
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
