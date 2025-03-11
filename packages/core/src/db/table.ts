import type { ResolvedEntitySchema } from './merge';

/**
 * Generate SQL schema for the entity definition
 * @param entityDef Entity definition
 * @param dialect SQL dialect to use
 * @returns SQL schema
 */
function generateSqlSchema(
	entityDef: ResolvedEntitySchema<any>,
	dialect: 'postgresql' | 'mysql' | 'sqlite'
): string {
	// This is a placeholder for actual SQL generation code
	let sql = `CREATE TABLE ${entityDef.entityPrefix}${entityDef.entityName} (\n`;

	// Convert fields to SQL column definitions
	const columns: string[] = [];
	for (const [fieldName, fieldDef] of Object.entries(entityDef.fields)) {
		const columnName = fieldDef.fieldName;
		let columnType = '';

		// Map field types to SQL types
		switch (fieldDef.type) {
			case 'string':
				columnType = dialect === 'postgresql' ? 'TEXT' : 'VARCHAR(255)';
				break;
			case 'number':
				columnType = 'INTEGER';
				break;
			case 'boolean':
				columnType = dialect === 'postgresql' ? 'BOOLEAN' : 'INTEGER';
				break;
			case 'date':
				columnType = dialect === 'postgresql' ? 'TIMESTAMP' : 'DATETIME';
				break;
			case 'uuid':
				columnType = dialect === 'postgresql' ? 'UUID' : 'VARCHAR(36)';
				break;
			case 'json':
				columnType = dialect === 'postgresql' ? 'JSONB' : 'TEXT';
				break;
			case 'array':
				columnType = dialect === 'postgresql' ? 'JSONB' : 'TEXT';
				break;
			default:
				columnType = 'TEXT';
		}

		// Add nullable constraint
		const nullable = fieldDef.required ? ' NOT NULL' : '';

		// Add column definition
		columns.push(`  ${columnName} ${columnType}${nullable}`);
	}

	sql += columns.join(',\n');
	sql += '\n);';

	return sql;
}

/**
 * Generate a table configuration from entity definition
 * @param entityDef Resolved entity schema
 * @returns Table configuration
 */
export function generateTable(entityDef: ResolvedEntitySchema<any>) {
	return {
		name: entityDef.entityName,
		prefix: entityDef.entityPrefix,

		// SQL schema generation
		getSqlSchema: (
			dialect: 'postgresql' | 'mysql' | 'sqlite' = 'postgresql'
		) => {
			return generateSqlSchema(entityDef, dialect);
		},

		// Field mapping for database operations
		mapToDb: (data: Record<string, unknown>) => {
			const result: Record<string, unknown> = {};

			for (const [logicalName, fieldDef] of Object.entries(entityDef.fields)) {
				// Map logical field name to physical field name
				const dbFieldName = fieldDef.fieldName;

				if (data[logicalName] !== undefined) {
					// Apply any input transformations
					let value = data[logicalName];
					if (fieldDef.transform?.input) {
						value = fieldDef.transform.input(value, data);
					}

					result[dbFieldName] = value;
				} else if (fieldDef.defaultValue !== undefined) {
					// Apply default value if available
					result[dbFieldName] = fieldDef.defaultValue;
				}
			}

			return result;
		},

		// Map from database to logical names
		mapFromDb: (data: Record<string, unknown>) => {
			const result: Record<string, unknown> = {};
			const fieldsByDbName: Record<string, string> = {};

			// Create a reverse lookup from DB field name to logical name
			for (const [logicalName, fieldDef] of Object.entries(entityDef.fields)) {
				fieldsByDbName[fieldDef.fieldName] = logicalName;
			}

			// Map DB field names back to logical names
			for (const [dbFieldName, value] of Object.entries(data)) {
				const logicalName = fieldsByDbName[dbFieldName];
				if (logicalName) {
					const fieldDef = entityDef.fields[logicalName];

					// Apply output transformations if any
					let transformedValue = value;
					if (fieldDef?.transform?.output) {
						transformedValue = fieldDef.transform.output(value, data);
					}

					result[logicalName] = transformedValue;
				} else {
					// If no mapping found, keep the original field name
					result[dbFieldName] = value;
				}
			}

			return result;
		},
	};
}
