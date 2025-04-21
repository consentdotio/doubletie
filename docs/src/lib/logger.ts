import { createLogger } from '@doubletie/logger';
import { getFormatter, registerFormatter } from '@doubletie/logger';
import type { LogLevel } from '@doubletie/logger';

/**
 * Create and configure the application logger with the default formatter
 */
const logger = createLogger({
  level: process.env.NODE_ENV === 'production' ? 'warn' : 'debug',
  appName: '🪢 docs',
  // Use the built-in formatter system instead of direct console calls
  log: (level: LogLevel, message: string, ...args: unknown[]) => {
    const formatter = getFormatter('default');
    const formattedMessage = formatter(level, message, args, '🪢 docs');
    
    // Output to console with the appropriate log level
    if (level === 'error') {
      console.error(formattedMessage);
    } else if (level === 'warn') {
      console.warn(formattedMessage);
    } else {
      console.log(formattedMessage);
    }
  }
});

// Expose the configured logger
export default logger;

// Convenience export for use throughout the app
export const log = logger; 