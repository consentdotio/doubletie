import { logger } from '../core/logger';
import type { Logger } from '../core/types';

/**
 * Gets the appropriate logging method for a Next.js logger method.
 *
 * @param nextMethod - The Next.js method to map to a logger method
 * @returns The appropriate logger method bound to a logger
 */
const getLogMethod = (childLogger: Logger, nextMethod: string) => {
	switch (nextMethod) {
		case 'error':
			return childLogger.error.bind(childLogger);
		case 'warn':
			return childLogger.warn.bind(childLogger);
		case 'trace':
			return childLogger.debug.bind(childLogger);
		default:
			return childLogger.info.bind(childLogger);
	}
};

/**
 * Redirects Next.js built-in logger to use the DoubleTie logger instead.
 * After calling this function, Next.js internal logs will be handled by your
 * DoubleTie logger with appropriate log levels.
 *
 * @remarks
 * This function modifies the Next.js logger at runtime by replacing the methods in
 * the require cache. It should be called after Next.js has been loaded.
 *
 * Common use cases:
 * - Capture framework-level logs from Next.js
 * - Apply consistent formatting to all logs including Next.js messages
 * - Filter Next.js logs based on your log level configuration
 * - Send Next.js logs to your custom destinations
 *
 * @example
 * ```typescript
 * // lib/logger.ts
 * import { createLogger, redirectNextjsLogger } from '@doubletie/logger';
 * import { redirectNextjsLogger } from '@doubletie/rewrite-nextjs';
 *
 * // Create your custom logger
 * const logger = createLogger({ level: 'info', appName: 'next-app' });
 *
 * // Try to redirect Next.js logger
 * const isNextjsRedirected = redirectNextjsLogger(logger);
 *
 * if (isNextjsRedirected) {
 *   console.log('Next.js logs will now go through DoubleTie logger');
 * } else {
 *   console.log('Could not redirect Next.js logger (Next.js may not be loaded yet)');
 * }
 *
 * export default logger;
 * ```
 *
 * For reliable redirection in Next.js, import this in _app.js/tsx or similar:
 * ```typescript
 * // pages/_app.js
 * import '../lib/logger'; // Execute the redirection
 *
 * function MyApp({ Component, pageProps }) {
 *   return <Component {...pageProps} />;
 * }
 *
 * export default MyApp;
 * ```
 *
 * @param customLogger - Optional custom logger to use instead of the default one
 * @returns Whether the redirection was successful (false if Next.js wasn't loaded)
 */
export const redirectNextjsLogger = (customLogger?: Logger): boolean => {
	try {
		const loggerInstance = customLogger || logger;

		// Resolve the path to Next.js logger
		const cachePath = require.resolve('next/dist/build/output/log');
		const nextLogger = require('next/dist/build/output/log');
		const cacheObject = require.cache[cachePath];

		if (!cacheObject) {
			return false;
		}

		// Create a copy of the exports to modify
		cacheObject.exports = { ...cacheObject.exports };

		// Patch each method in the Next.js logger
		for (const method of Object.keys(nextLogger.prefixes)) {
			Object.defineProperty(cacheObject.exports, method, {
				value: getLogMethod(loggerInstance, method),
			});
		}

		return true;
	} catch {
		// If Next.js is not available or any other error occurs
		return false;
	}
};
