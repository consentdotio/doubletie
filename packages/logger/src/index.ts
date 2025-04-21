/**
 * @packageDocumentation
 * DoubleTie Logger Package
 *
 * A lightweight, customizable logging utility for Node.js and TypeScript applications.
 * It provides structured logging capabilities, error logging utilities for the Result pattern,
 * flexible configuration options, and logger extension support.
 *
 * @remarks
 * This package is designed to work standalone or as part of the DoubleTie SDK.
 * It includes:
 * - Configurable log levels and filters
 * - Color-coded console output
 * - Error logging for Result/ResultAsync types from neverthrow
 * - Custom log handlers
 * - Patching functionality for console and Next.js loggers
 *
 * @example
 * ```ts
 * import { createLogger, logResult } from '@doubletie/logger';
 *
 * // Create a custom logger
 * const logger = createLogger({ level: 'debug', appName: 'c15t' });
 *
 * // Log messages at different levels
 * logger.info('Application started');
 * logger.debug('Initializing components', { component: 'database' });
 * logger.warn('Configuration missing, using defaults');
 * logger.error('Failed to connect', { retry: true });
 * ```
 */

// Export everything from core
export * from './core';

// Export formatting utilities
export {
	formatArgs,
	formatMessage,
	registerFormatter,
	getFormatter,
} from './formatting';

// Export result logging utilities
export {
	logResult,
	logResultAsync,
	logResult as logError,
	logResultAsync as logErrorAsync,
} from './utils';

