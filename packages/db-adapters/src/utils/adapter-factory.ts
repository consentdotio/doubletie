import type { Adapter, AdapterFactory } from '../adapters/types';

/**
 * Database configuration options
 */
export interface DBOptions {
	/**
	 * Database adapter to use
	 * - Can be a string identifier for built-in adapters
	 * - Can be a function that returns an adapter instance
	 */
	adapter?: string | AdapterFactory;

	/** Database connection configuration */
	connection?: Record<string, unknown>;

	/** Enable debug logging */
	debug?: boolean;

	/** Additional adapter-specific options */
	[key: string]: unknown;
}

/**
 * Error thrown when there's an issue with database adapter initialization
 */
export class DBAdapterError extends Error {
	code: string;
	status: number;

	constructor(message: string, options: { code: string; status: number }) {
		super(message);
		this.name = 'DBAdapterError';
		this.code = options.code;
		this.status = options.status;
	}
}

/**
 * Registry of available database adapters
 */
const adapterRegistry: Record<string, AdapterFactory> = {};

/**
 * Registers a database adapter with the adapter registry
 *
 * @param name - The unique name of the adapter
 * @param factory - The adapter factory function
 */
export function registerAdapter(name: string, factory: AdapterFactory): void {
	adapterRegistry[name] = factory;
}

/**
 * Gets a memory adapter for development or testing
 *
 * @param initialData - Optional initial data for the in-memory database
 * @returns An adapter factory function
 */
export function getMemoryAdapter(
	initialData?: Record<string, unknown[]>
): AdapterFactory {
	return (options) => {
		// This is a placeholder - the actual implementation would be imported from the memory adapter
		const adapter: Adapter = {
			id: 'memory',
			// Implement adapter methods here
			// For now, just returning placeholder implementations
			create: async () => ({}),
			findOne: async () => null,
			findMany: async () => [],
			count: async () => 0,
			update: async () => null,
			updateMany: async () => [],
			delete: async () => {},
			deleteMany: async () => 0,
			transaction: async ({ callback }) => callback({} as Adapter),
		} as Adapter;

		return adapter;
	};
}

/**
 * Gets a configured database adapter based on the provided options
 *
 * @param options - The database configuration options
 * @returns A configured database adapter instance
 * @throws {DBAdapterError} If adapter initialization fails
 */
export async function getAdapter(options: DBOptions): Promise<Adapter> {
	// If no adapter is specified, use in-memory adapter for development
	if (!options.adapter) {
		console.warn(
			'No database adapter specified. Using in-memory adapter for development.'
		);
		return getMemoryAdapter()(options);
	}

	// If adapter is a function, use it directly
	if (typeof options.adapter === 'function') {
		try {
			return await options.adapter(options);
		} catch (error) {
			throw new DBAdapterError('Failed to initialize custom database adapter', {
				code: 'ADAPTER_INIT_FAILED',
				status: 500,
			});
		}
	}

	// Otherwise, look up the adapter in the registry
	const adapterFactory = adapterRegistry[options.adapter];
	if (!adapterFactory) {
		throw new DBAdapterError(`Unknown database adapter: ${options.adapter}`, {
			code: 'UNKNOWN_ADAPTER',
			status: 500,
		});
	}

	try {
		return await adapterFactory(options);
	} catch (error) {
		throw new DBAdapterError(
			`Failed to initialize ${options.adapter} adapter`,
			{
				code: 'ADAPTER_INIT_FAILED',
				status: 500,
			}
		);
	}
}
