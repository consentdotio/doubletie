import pc from 'picocolors';
import type { LogLevel } from '../core/types';

/**
 * Log message formatter function signature.
 */
export type LogFormatter = (
	level: LogLevel,
	message: string,
	args: unknown[],
	appName?: string
) => string;

/**
 * Registry of named formatters that can be used for different contexts.
 */
const formatters: Record<string, LogFormatter> = {};

// Check if running in Edge runtime
const isEdgeRuntime =
	typeof process !== 'undefined' && process.env.NEXT_RUNTIME === 'edge';

/**
 * Default formatter - formatted output with color and timestamp.
 */
const defaultFormatter: LogFormatter = (level, message, args, appName) => {
	// Extract only time portion from timestamp (HH:MM:SS.sss)
	const formattedArgs = formatArgs(args);

	// In Edge Runtime, use plain text without colors
	if (isEdgeRuntime) {
		const levelStr = `[${level.toUpperCase()}]`;
		const appStr = appName ? ` [${appName}]` : '';
		return `${levelStr}${appStr} ${message}${formattedArgs}`;
	}

	// Format message based on log level with colorized badges
	let levelBadge: string;

	switch (level) {
		case 'error': {
			levelBadge = pc.bgRed(pc.black(` ${level.toUpperCase()} `));
			break;
		}
		case 'warn': {
			levelBadge = pc.bgYellow(pc.black(` ${level.toUpperCase()} `));
			break;
		}
		case 'info': {
			levelBadge = pc.bgBlue(pc.white(` ${level.toUpperCase()} `));
			break;
		}
		case 'debug': {
			levelBadge = pc.bgBlack(pc.white(` ${level.toUpperCase()} `));
			break;
		}
		case 'success': {
			levelBadge = pc.bgGreen(pc.black(` ${level.toUpperCase()} `));
			break;
		}
		default: {
			levelBadge = pc.bold(`[${String(level).toUpperCase()}]`);
			break;
		}
	}

	const appMarker = appName ? pc.bold(` [${appName}] `) : ' ';
	return `${levelBadge}${appMarker}${message}${formattedArgs}`;
};

/**
 * JSON formatter for structured logging - optimal for log drains and aggregation tools.
 */
const jsonFormatter: LogFormatter = (level, message, args, appName) => {
	// Create a structured log object
	const logObject = {
		timestamp: new Date().toISOString(), // ISO format for better parsing in log systems
		level: level.toUpperCase(),
		app: appName || 'doubletie',
		message: message,
		// If there are multiple args or a single non-object arg, put them in a data array
		// Otherwise, if it's a single object, merge it directly into the log object for better querying
		...(args.length === 0
			? {}
			: // biome-ignore lint/nursery/noNestedTernary: <explanation>
				args.length === 1 &&
					typeof args[0] === 'object' &&
					args[0] !== null &&
					!(args[0] instanceof Error)
				? { data: args[0] }
				: { data: args }),
	};

	// Special handling for errors
	const error = args.find((arg): arg is Error => arg instanceof Error);
	if (error) {
		Object.assign(logObject, {
			error: {
				name: error.name,
				message: error.message,
				stack: error.stack,
			},
		});
	}

	// Return the formatted JSON string
	return JSON.stringify(logObject);
};

/**
 * Format additional arguments for logging in a structured way.
 *
 * @param args - Array of arguments to format
 * @returns Formatted string representation of arguments
 */
export const formatArgs = (args: unknown[]): string => {
	if (args.length === 0) {
		return '';
	}

	return `\n${args
		.map((arg) => {
			if (arg === null) {
				return '  - null';
			}
			if (arg === undefined) {
				return '  - undefined';
			}

			try {
				// Handle Error objects specially
				if (arg instanceof Error) {
					return `  - ${arg.name}: ${arg.message}\n    ${arg.stack || ''}`;
				}

				// Format other objects
				return `  - ${JSON.stringify(arg, null, 2).replace(/\n/g, '\n    ')}`;
			} catch {
				// Fallback for objects that can't be stringified
				return `  - [Object: ${Object.prototype.toString.call(arg)}]`;
			}
		})
		.join('\n')}`;
};

/**
 * Register a custom formatter for log messages.
 *
 * @param name - Name to identify the formatter
 * @param formatter - The formatter function
 */
export const registerFormatter = (
	name: string,
	formatter: LogFormatter
): void => {
	formatters[name] = formatter;
};

/**
 * Get a formatter by name, falling back to default if not found.
 *
 * @param name - The formatter name to retrieve
 * @returns The formatter function
 */
export const getFormatter = (name = 'default'): LogFormatter => {
	return formatters[name] || defaultFormatter;
};

/**
 * Format a log message using the specified formatter.
 *
 * @param level - Log level
 * @param message - Log message
 * @param args - Additional log arguments
 * @param formatterName - Name of formatter to use
 * @param appName - Optional application name
 * @returns Formatted log message
 */
export const formatMessage = (
	level: LogLevel,
	message: string,
	args: unknown[] = [],
	formatterName = 'default',
	appName?: string
): string => {
	const formatter = getFormatter(formatterName);
	return formatter(level, message, args, appName);
};

// Register the formatters
formatters.default = defaultFormatter;
formatters.json = jsonFormatter;
