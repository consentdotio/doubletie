import type { DatabaseConfig } from './config.types';

/**
 * Global application configuration
 */
class AppConfig {
	private _dbConfig: DatabaseConfig = {};

	/**
	 * Get the current database configuration
	 */
	get db(): DatabaseConfig {
		return this._dbConfig;
	}

	/**
	 * Set the database configuration
	 * @param config The database configuration to use
	 */
	setDatabaseConfig(config: DatabaseConfig): void {
		this._dbConfig = config;
	}
}

/**
 * Singleton instance of the app configuration
 */
export const appConfig = new AppConfig();
