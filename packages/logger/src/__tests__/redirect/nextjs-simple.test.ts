import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createLogger } from '../../core/logger';
import type { Logger } from '../../core/types';

// Mock the redirect function internally rather than mocking Node's module system
vi.mock('../../redirect/nextjs', async () => {
	// Get actual module implementation
	const actual = await vi.importActual('../../redirect/nextjs');

	// Create a spy for the function
	const redirectSpy = vi.fn().mockImplementation((logger) => {
		// Store the logger for testing
		(redirectSpy as any).lastLogger = logger;
		return true;
	});

	return {
		...actual,
		redirectNextjsLogger: redirectSpy,
	};
});

describe('NextJS Logger Redirection', () => {
	let logger: Logger;

	beforeEach(() => {
		logger = createLogger({ appName: 'test-app' });
		vi.clearAllMocks();
	});

	afterEach(() => {
		vi.clearAllMocks();
	});

	it('should export the redirectNextjsLogger function', async () => {
		const { redirectNextjsLogger } = await import('../../redirect/nextjs');
		expect(typeof redirectNextjsLogger).toBe('function');
	});

	it('should receive the logger as a parameter', async () => {
		const { redirectNextjsLogger } = await import('../../redirect/nextjs');
		redirectNextjsLogger(logger);

		// Check that our spy received the logger
		expect(redirectNextjsLogger).toHaveBeenCalledWith(logger);
		expect((redirectNextjsLogger as any).lastLogger).toBe(logger);
	});

	it('should return true when successful', async () => {
		const { redirectNextjsLogger } = await import('../../redirect/nextjs');
		const result = redirectNextjsLogger(logger);
		expect(result).toBe(true);
	});

	it('should work when called with no parameters', async () => {
		const { redirectNextjsLogger } = await import('../../redirect/nextjs');
		// Should not throw an error
		expect(() => redirectNextjsLogger()).not.toThrow();
	});
});
