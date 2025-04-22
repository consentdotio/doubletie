import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createLogger } from '../../core/logger';

describe('logger integration', () => {
	beforeEach(() => {
		// biome-ignore lint/suspicious/noEmptyBlockStatements: its okay its a test
		vi.spyOn(console, 'log').mockImplementation(() => {});
		// biome-ignore lint/suspicious/noEmptyBlockStatements: its okay its a test
		vi.spyOn(console, 'warn').mockImplementation(() => {});
		// biome-ignore lint/suspicious/noEmptyBlockStatements: its okay its a test
		vi.spyOn(console, 'error').mockImplementation(() => {});
		// biome-ignore lint/suspicious/noEmptyBlockStatements: its okay its a test
		vi.spyOn(console, 'debug').mockImplementation(() => {});
	});

	afterEach(() => {
		vi.restoreAllMocks();
	});

	describe('full logger pipeline', () => {
		it('should work with custom log level and error logging together', () => {
			// Create a logger with custom configuration
			const logger = createLogger({
				level: 'info', // Change from 'debug' to 'info' to allow info, warn, and error logs
			});

			// Test standard logging
			logger.info('Info message');
			logger.debug('Debug message');
			logger.warn('Warning message');

			expect(console.log).toHaveBeenCalledTimes(1);
			expect(console.debug).toHaveBeenCalledTimes(0); // Debug won't be logged with info level
			expect(console.warn).toHaveBeenCalledTimes(1);
		});

		it('should work with custom log handler and result logging', () => {
			// Create a mock log handler
			const customLogHandler = vi.fn();

			// Create a logger with the custom handler
			const logger = createLogger({
				level: 'info', // Change from 'debug' to 'info' to allow info, warn, and error logs
				log: customLogHandler,
				appName: '🪢 DoubleTie',
			});

			// Use direct logging
			logger.info('Direct info');
			logger.error('Direct error');

			expect(customLogHandler).toHaveBeenCalledTimes(2);

			// Check that the custom handler was called again
			expect(customLogHandler).toHaveBeenCalledTimes(3);
			const mockedCustomLogHandler = vi.mocked(customLogHandler);
			expect(mockedCustomLogHandler.mock.calls[2]?.[0]).toBe('error');
			expect(mockedCustomLogHandler.mock.calls[2]?.[1]).toBe(
				'Error: Result error'
			);
		});

		it('should use custom application name in logs', () => {
			// Create a logger with a custom application name
			const customAppName = 'c15t-api';
			const logger = createLogger({
				level: 'info',
				appName: customAppName,
			});

			// Log messages at different levels
			logger.info('Application started');
			logger.warn('Configuration incomplete');
			logger.error('Failed to connect to database');

			// Verify logs contain the custom app name
			const mockedConsoleLog = vi.mocked(console.log);
			const mockedConsoleWarn = vi.mocked(console.warn);
			const mockedConsoleError = vi.mocked(console.error);

			expect(mockedConsoleLog.mock.calls[0]?.[0]).toContain(
				`[${customAppName}]`
			);
			expect(mockedConsoleWarn.mock.calls[0]?.[0]).toContain(
				`[${customAppName}]`
			);
			expect(mockedConsoleError.mock.calls[0]?.[0]).toContain(
				`[${customAppName}]`
			);

			// Verify logs don't contain the default app name
			expect(mockedConsoleLog.mock.calls[0]?.[0]).not.toContain(
				'[🪢 doubletie]'
			);

			expect(mockedConsoleError.mock.calls[1]?.[0]).toContain(
				`[${customAppName}]`
			);
			expect(mockedConsoleError.mock.calls[1]?.[0]).toContain(
				'Integration error with custom app name'
			);
		});
	});
});
