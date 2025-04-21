import { logger } from '../logger-factory';
import type { Logger } from '../types';

/**
 * Gets the appropriate logging method for a console method.
 * 
 * @param consoleMethod - The console method to map to a logger method
 * @returns The appropriate logger method bound to a child logger
 */
const getLogMethod = (childLogger: Logger, consoleMethod: string) => {
  switch (consoleMethod) {
    case 'error':
      return childLogger.error.bind(childLogger);
    case 'warn':
      return childLogger.warn.bind(childLogger);
    case 'debug':
      return childLogger.debug.bind(childLogger);
    default:
      return childLogger.info.bind(childLogger);
  }
};

/**
 * Redirects global console methods to use the DoubleTie logger instead.
 * After calling this function, any call to console.log(), console.error(), etc. 
 * will be handled by the DoubleTie logger with the appropriate log level.
 * 
 * @remarks
 * This is useful to capture all console logging in your application and:
 * - Apply your log level filtering to console logs
 * - Format console logs consistently with your other logs
 * - Send console logs to your custom log destinations
 * 
 * @example
 * ```typescript
 * import { createLogger } from '@doubletie/logger';
 * import { redirectConsoleMethods } from '@doubletie/rewrite-console';
 * 
 * // Create a custom logger
 * const myLogger = createLogger({ level: 'debug', appName: 'my-app' });
 * 
 * // Redirect all console methods to use this logger
 * redirectConsoleMethods(myLogger);
 * 
 * // Now these will use your logger with proper levels
 * console.log('This goes to info level');
 * console.error('This goes to error level');
 * console.warn('This goes to warn level');
 * ```
 * 
 * @param customLogger - Optional custom logger to use instead of the default one
 */
export const redirectConsoleMethods = (customLogger?: Logger): void => {
  const loggerInstance = customLogger || logger;
  const childLogger = loggerInstance;
  
  const consoleMethods = ['log', 'debug', 'info', 'warn', 'error'];
  for (const method of consoleMethods) {
    // Override the console method with our logger
    (console as Record<string, any>)[method] = getLogMethod(childLogger, method);
  }
}; 