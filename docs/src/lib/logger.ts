import {
	createLogger,
	getFormatter,
	registerFormatter,
} from '@doubletie/logger';
import type { LogLevel, LoggerOptions } from '@doubletie/logger';

// Detect if we're running in a browser environment
const isBrowser = typeof window !== 'undefined';

// Create a plain formatter for browser environment
if (isBrowser) {
	registerFormatter(
		'browser',
		(
			level: LogLevel,
			message: string,
			args: unknown[],
			appName = '🪢 docs'
		) => {
			const now = new Date();
			const timestamp = `${now.toTimeString().split(' ')[0]}.${now.getMilliseconds().toString().padStart(3, '0')}`;
			return `${timestamp} ${level.toUpperCase()} [${appName}] ${message}`;
		}
	);
}

/**
 * Create and configure the application logger with environment-specific formatter
 */
const loggerOptions: LoggerOptions = {
	level: process.env.NODE_ENV === 'production' ? 'warn' : 'debug',
	appName: '🪢 docs',
};

// Add custom log function for browser environment
if (isBrowser) {
	loggerOptions.log = (
		level: LogLevel,
		message: string,
		...args: unknown[]
	) => {
		const formatter = getFormatter('browser');
		const formattedMessage = formatter(level, message, args, '🪢 docs');

		if (level === 'error') {
			console.error(formattedMessage);
		} else if (level === 'warn') {
			console.warn(formattedMessage);
		} else {
			console.log(formattedMessage);
		}
	};
}

const logger = createLogger(loggerOptions);

// Expose the configured logger
export default logger;

// Convenience export for use throughout the app
export const log = logger;
