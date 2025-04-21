import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { redirectConsoleMethods } from '../../redirect/console';
import { createLogger } from '../../core/logger';

describe('console redirection', () => {
  // Setup and teardown
  beforeEach(() => {
    // Store original console methods
    vi.spyOn(console, 'log');
    vi.spyOn(console, 'error');
    vi.spyOn(console, 'warn');
    vi.spyOn(console, 'debug');
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('should redirect console methods to logger', () => {
    // Create a mock logger
    const mockLogger = {
      info: vi.fn(),
      error: vi.fn(),
      warn: vi.fn(),
      debug: vi.fn(),
      success: vi.fn()
    };

    // Redirect console methods to our mock logger
    redirectConsoleMethods(mockLogger);

    // Use console methods
    console.log('Test log message');
    console.error('Test error message');
    console.warn('Test warning message');
    console.debug('Test debug message');

    // Verify logger methods were called
    expect(mockLogger.info).toHaveBeenCalledWith('Test log message');
    expect(mockLogger.error).toHaveBeenCalledWith('Test error message');
    expect(mockLogger.warn).toHaveBeenCalledWith('Test warning message');
    expect(mockLogger.debug).toHaveBeenCalledWith('Test debug message');
  });

  it('should use default logger when no custom logger provided', () => {
    // Create a spy on the default logger's methods
    const defaultLogger = createLogger();
    vi.spyOn(defaultLogger, 'info');
    vi.spyOn(defaultLogger, 'error');
    
    // Mock module to return our spy logger
    vi.mock('../../core/logger', () => ({
      logger: defaultLogger,
      createLogger: vi.fn()
    }));

    // Redirect console methods
    redirectConsoleMethods();

    // Use console method
    console.log('Default logger test');
    console.error('Default logger error');

    // Check that default logger was used
    expect(defaultLogger.info).toHaveBeenCalledWith('Default logger test');
    expect(defaultLogger.error).toHaveBeenCalledWith('Default logger error');
  });

  it('should pass additional arguments to logger methods', () => {
    // Create a mock logger
    const mockLogger = {
      info: vi.fn(),
      error: vi.fn(),
      warn: vi.fn(),
      debug: vi.fn(),
      success: vi.fn()
    };

    // Redirect console methods
    redirectConsoleMethods(mockLogger);

    // Use console with additional arguments
    const obj = { key: 'value' };
    console.log('Message with data', obj, 123);

    // Verify arguments were passed through
    expect(mockLogger.info).toHaveBeenCalledWith('Message with data', obj, 123);
  });
}); 