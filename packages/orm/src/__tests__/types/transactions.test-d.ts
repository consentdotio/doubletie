import type { Kysely, Transaction } from 'kysely';
import { assertType, expectTypeOf } from 'vitest';
import createModel from '~/model';

// Define test types
interface TestDB {
	users: {
		id: number;
		name: string;
	};
}

// Test transaction types
test('model transaction method has correct parameter and return types', () => {
	// Mock DB
	const db = {} as Kysely<TestDB>;

	// Create a model
	const model = createModel<TestDB, 'users', 'id'>(db, 'users', 'id');

	// Test transaction method type
	expectTypeOf(model.transaction).toBeFunction();

	// Check transaction callback parameter type
	expectTypeOf(model.transaction)
		.parameter(0)
		.toMatchTypeOf<<T>(tx: Transaction<TestDB>) => Promise<T>>();

	// Check return type is properly generic
	expectTypeOf(model.transaction<string>).returns.toEqualTypeOf<
		Promise<string>
	>();

	expectTypeOf(model.transaction<number>).returns.toEqualTypeOf<
		Promise<number>
	>();

	// Test that transaction parameter is correctly typed
	assertType<(tx: Transaction<TestDB>) => Promise<void>>(async (tx) => {
		expectTypeOf(tx.selectFrom).toBeFunction();
		expectTypeOf(tx.updateTable).toBeFunction();
		expectTypeOf(tx.insertInto).toBeFunction();
		expectTypeOf(tx.deleteFrom).toBeFunction();
	});
});
