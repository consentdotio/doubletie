import type { Logger } from '../core/types';
import { redirectConsoleMethods } from './console';
import { redirectNextjsLogger } from './nextjs';

/**
 * Redirects all supported logging systems to use DoubleTie logger.
 * This is a convenience function that combines redirectConsoleMethods and redirectNextjsLogger
 * to create a unified logging system.
 *
 * @remarks
 * This creates a fully unified logging experience where:
 * - All console.log/warn/error calls use your logger
 * - All Next.js framework logs use your logger
 * - Your direct logger calls use your logger
 *
 * The result is a single consistent logging system with:
 * - Unified formatting for all logs
 * - Centralized log level filtering
 * - Single destination for all application logs
 *
 * @example
 * ```typescript
 * // lib/logger.ts
 * import { createLogger } from '@doubletie/logger';
 * import { redirectAllLoggers } from '@doubletie/logger/redirect-all';
 *
 * // Create your custom logger
 * const logger = createLogger({
 *   level: process.env.NODE_ENV === 'production' ? 'warn' : 'debug',
 *   appName: 'my-next-app'
 * });
 *
 * // Set up unified logging
 * const results = redirectAllLoggers(logger);
 *
 * if (results.next) {
 *   console.log('Successfully redirected Next.js logs');
 * } else {
 *   console.log('Next.js logger redirection failed - Next.js may not be loaded yet');
 * }
 *
 * export default logger;
 * ```
 *
 * For reliable Next.js redirection, import this in a Next.js entry point:
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
 * @returns Object indicating which redirections were successfully applied
 *   - console: Always true as console redirection always succeeds
 *   - next: Boolean indicating if Next.js redirection succeeded
 */
export const redirectAllLoggers = (
	customLogger?: Logger
): { console: true; next: boolean } => {
	// Patch console (always succeeds)
	redirectConsoleMethods(customLogger);

	// Patch Next.js (may fail if Next.js is not available)
	const nextPatched = redirectNextjsLogger(customLogger);

	return {
		console: true,
		next: nextPatched,
	};
};
