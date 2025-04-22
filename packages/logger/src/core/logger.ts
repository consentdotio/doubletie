import { getFormatter } from '../formatting/formatter';
import { withLogSpan } from '../utils/telemetry';
import { levels, shouldPublishLog } from './levels';
import type {
	ExtendedLogger,
	LogEntry,
	LogLevel,
	Logger,
	LoggerExtensions,
	LoggerOptions,
} from './types';

/**
 * Creates a configured logger instance with methods for each log level.
 *
 * @param options - Configuration options for the logger or an existing logger instance
 * @returns An object with methods for each log level
 *
 * @example
 * ```ts
 * // Create a logger that only shows warnings and errors
 * const logger = createLogger({ level: 'warn', appName: 'c15t' });
 *
 * // These will be output
 * logger.error('This is an error');
 * logger.warn('This is a warning');
 *
 * // These will be suppressed
 * logger.info('This info won\'t be shown');
 * logger.debug('This debug message won\'t be shown');
 * ```
 *
 * @public
 */
export const createLogger = (options?: LoggerOptions | Logger): Logger => {
	// If options is already a Logger instance, return it
	if (
		options &&
		typeof options === 'object' &&
		levels.every((level) => typeof (options as Logger)[level] === 'function')
	) {
		return options as Logger;
	}

	// Otherwise, treat options as LoggerOptions
	const loggerOptions = options as LoggerOptions;
	const enabled = loggerOptions?.disabled !== true;
	const logLevel = loggerOptions?.level ?? 'error';
	const appName = loggerOptions?.appName ?? 'c15t';

	/**
	 * Internal function that handles the actual logging logic.
	 *
	 * @param level - The severity level of the log
	 * @param message - The message to log
	 * @param args - Additional data to include in the log
	 *
	 * @internal
	 */
	const logFunc = async (
		level: LogLevel,
		message: string,
		args: unknown[] = []
	): Promise<void> => {
		if (!enabled || !shouldPublishLog(logLevel, level)) {
			return;
		}

		await withLogSpan(level, message, args, async () => {
			const formatter = getFormatter('default');
			const formattedMessage = formatter(level, message, args, appName);

			if (!loggerOptions || typeof loggerOptions.log !== 'function') {
				if (level === 'error') {
					// biome-ignore lint/suspicious/noConsole: Logger implementation
					console.error(formattedMessage, ...args);
				} else if (level === 'warn') {
					// biome-ignore lint/suspicious/noConsole: Logger implementation
					console.warn(formattedMessage, ...args);
				} else if (level === 'info') {
					// biome-ignore lint/suspicious/noConsole: Logger implementation
					// biome-ignore lint/suspicious/noConsoleLog: Logger implementation
					console.log(formattedMessage, ...args);
				} else if (level === 'debug') {
					// biome-ignore lint/suspicious/noConsole: Logger implementation
					console.debug(formattedMessage, ...args);
				} else if (level === 'success') {
					// biome-ignore lint/suspicious/noConsole: Logger implementation
					// biome-ignore lint/suspicious/noConsoleLog: Logger implementation
					console.log(formattedMessage, ...args);
				}
				return;
			}

			loggerOptions.log(level === 'success' ? 'info' : level, message, ...args);
		});
	};

	return Object.fromEntries(
		levels.map((level) => [
			level,
			(...[message, ...args]: LogEntry) => {
				// Return the promise but don't await it
				return logFunc(level, message, args).catch((error) => {
					// biome-ignore lint/suspicious/noConsole: <explanation>
					console.error('Logger error:', error);
				});
			},
		])
	) as unknown as Logger;
};

/**
 * Default logger instance with standard configuration.
 *
 * @remarks
 * Ready-to-use logger with default settings (logs errors only).
 *
 * @example
 * ```ts
 * import { logger } from '@doubletie/logger';
 *
 * logger.error('Something went wrong');
 * logger.info('This won\'t be shown with default settings');
 * ```
 *
 * @public
 */
export const logger = createLogger();

/**
 * Extends a logger with additional methods.
 *
 * @param baseLogger - The logger to extend
 * @param extensions - Object containing extension methods
 * @returns Extended logger with added functionality
 *
 * @example
 * ```typescript
 * // Create a logger with custom methods
 * const logger = createLogger({ level: 'info' });
 * const extendedLogger = extendLogger(logger, {
 *   http: (message, ...args) => logger.info(`HTTP: ${message}`, ...args),
 *   database: (message, ...args) => logger.info(`DB: ${message}`, ...args)
 * });
 *
 * // Now you can use the extended methods
 * extendedLogger.http('GET /users');
 * extendedLogger.database('Query executed in 10ms');
 * ```
 *
 * @public
 */
export function extendLogger<T extends LoggerExtensions>(
	baseLogger: Logger,
	extensions: T
): ExtendedLogger<T> {
	return Object.assign({}, baseLogger, extensions);
}
