import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import * as loggerModule from '../../core/logger';
import { redirectConsoleMethods } from '../../redirect/console';

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
			success: vi.fn(),
		};

		// Redirect console methods to our mock logger
		redirectConsoleMethods(mockLogger);

		// Use console methods
		// biome-ignore lint/suspicious/noConsoleLog: <explanation>
		// biome-ignore lint/suspicious/noConsole: <explanation>
		console.log('Test log message');
		// biome-ignore lint/suspicious/noConsole: <explanation>
		console.error('Test error message');
		// biome-ignore lint/suspicious/noConsole: <explanation>
		console.warn('Test warning message');
		// biome-ignore lint/suspicious/noConsole: <explanation>
		console.debug('Test debug message');

		// Verify logger methods were called
		expect(mockLogger.info).toHaveBeenCalledWith('Test log message');
		expect(mockLogger.error).toHaveBeenCalledWith('Test error message');
		expect(mockLogger.warn).toHaveBeenCalledWith('Test warning message');
		expect(mockLogger.debug).toHaveBeenCalledWith('Test debug message');
	});

	it('should use default logger when no custom logger provided', () => {
		// Mock the default logger
		const mockDefaultLogger = {
			info: vi.fn(),
			error: vi.fn(),
			warn: vi.fn(),
			debug: vi.fn(),
			success: vi.fn(),
		};

		// Spy on the logger module
		vi.spyOn(loggerModule, 'logger', 'get').mockReturnValue(mockDefaultLogger);

		// Redirect console methods without providing a custom logger
		redirectConsoleMethods();

		// Use console methods
		// biome-ignore lint/suspicious/noConsoleLog: <explanation>
		// biome-ignore lint/suspicious/noConsole: <explanation>
		console.log('Default logger test');
		// biome-ignore lint/suspicious/noConsole: <explanation>
		console.error('Default logger error');

		// Check that default logger was used
		expect(mockDefaultLogger.info).toHaveBeenCalledWith('Default logger test');
		expect(mockDefaultLogger.error).toHaveBeenCalledWith(
			'Default logger error'
		);
	});

	it('should pass additional arguments to logger methods', () => {
		// Create a mock logger
		const mockLogger = {
			info: vi.fn(),
			error: vi.fn(),
			warn: vi.fn(),
			debug: vi.fn(),
			success: vi.fn(),
		};

		// Redirect console methods
		redirectConsoleMethods(mockLogger);

		// Use console with additional arguments
		const obj = { key: 'value' };
		// biome-ignore lint/suspicious/noConsoleLog: <explanation>
		// biome-ignore lint/suspicious/noConsole: <explanation>
		console.log('Message with data', obj, 123);

		// Verify arguments were passed through
		expect(mockLogger.info).toHaveBeenCalledWith('Message with data', obj, 123);
	});
});
