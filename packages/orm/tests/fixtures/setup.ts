// tests/fixtures/setup.ts
import { vi } from 'vitest';

// Set up global test environment
vi.mock('pg', async () => {
	// Mock pg pool for unit tests
	const actual = await vi.importActual('pg');
	return {
		...actual,
		Pool: vi.fn(() => ({
			connect: vi.fn(),
			query: vi.fn(),
			end: vi.fn(),
		})),
	};
});

// Set up any global variables needed for tests
globalThis.__TEST_ENV__ = process.env.TEST_TYPE || 'unit';

// Clean up any global resources after tests
afterAll(() => {
	vi.clearAllMocks();
});
