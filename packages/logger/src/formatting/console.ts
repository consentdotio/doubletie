import type { LogLevel } from '../core/types';

/**
 * Format a message for console output with optional colors.
 * 
 * @param level - The log level
 * @param message - The message to format
 * @param appName - The application name to include in the log
 * @returns Formatted message for display
 */
export const formatMessage = (
	level: LogLevel,
	message: string,
	appName = '🪢 doubletie'
): string => {
	const timestamp = new Date().toISOString();
	return `${timestamp} ${level.toUpperCase()} [${appName}]: ${message}`;
}; 