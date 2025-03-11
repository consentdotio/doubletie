/**
 * Database hints for field definitions
 * These provide guidance to database adapters without tightly coupling fields to specific databases
 */

/**
 * Generic storage characteristics to inform database adapters
 */
export interface DatabaseStorageHints {
	/**
	 * Preferred storage type category
	 */
	storageType?:
		| 'text'
		| 'numeric'
		| 'binary'
		| 'temporal'
		| 'boolean'
		| 'json'
		| 'uuid';

	/**
	 * Whether the field contains timezone information
	 */
	hasTimezone?: boolean;

	/**
	 * Precision level for numeric or temporal data
	 */
	precision?: 'second' | 'millisecond' | 'microsecond' | number;

	/**
	 * Scale for decimal numbers
	 */
	scale?: number;

	/**
	 * Typical size of the data in this field
	 */
	typicalSize?: 'tiny' | 'small' | 'medium' | 'large' | 'huge';

	/**
	 * Maximum size in appropriate units (chars, bytes)
	 */
	maxSize?: number;

	/**
	 * Whether this field should be indexed
	 */
	indexed?: boolean;

	/**
	 * Whether this field is part of a unique constraint
	 */
	unique?: boolean;

	/**
	 * Typical access pattern for this field
	 */
	accessPattern?: 'read-heavy' | 'write-heavy' | 'balanced';

	/**
	 * How this field should be sorted/collated
	 */
	collation?: 'binary' | 'case-insensitive' | 'locale-aware';
}

/**
 * Database hints for fields with options specific to various database systems
 */
export interface DatabaseHints extends DatabaseStorageHints {
	/**
	 * Custom database-specific options
	 */
	custom?: Record<string, any>;

	/**
	 * SQLite-specific hints
	 */
	sqlite?: SQLiteHints;

	/**
	 * MySQL-specific hints
	 */
	mysql?: MySQLHints;

	/**
	 * PostgreSQL-specific hints
	 */
	postgres?: PostgresHints;
}

/**
 * SQLite-specific field hints
 */
export interface SQLiteHints extends DatabaseStorageHints {
	/**
	 * Direct type override for SQLite
	 */
	type?: 'INTEGER' | 'REAL' | 'TEXT' | 'BLOB' | 'NUMERIC';

	/**
	 * Whether this field uses the AUTOINCREMENT feature
	 */
	autoIncrement?: boolean;
}

/**
 * MySQL-specific field hints
 */
export interface MySQLHints extends DatabaseStorageHints {
	/**
	 * Direct type override for MySQL
	 */
	type?: string;

	/**
	 * Character set for text fields
	 */
	charset?: string;

	/**
	 * Collation for text fields
	 */
	collation?: string;

	/**
	 * Whether to use UNSIGNED for numeric types
	 */
	unsigned?: boolean;

	/**
	 * Whether this field uses AUTO_INCREMENT
	 */
	autoIncrement?: boolean;
}

/**
 * PostgreSQL-specific field hints
 */
export interface PostgresHints extends DatabaseStorageHints {
	/**
	 * Direct type override for PostgreSQL
	 */
	type?: string;

	/**
	 * Whether to use SERIAL types for auto-incrementing
	 */
	useSerial?: boolean;

	/**
	 * Use a specific operator class for indexes on this field
	 */
	opClass?: string;
}
