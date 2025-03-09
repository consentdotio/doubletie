// packages/orm/tests/types/error-handling.test-d.ts

import { Kysely, Selectable } from 'kysely';
import { expectTypeOf, test } from 'vitest/node';
import createModel from '~/model';

test('model error handling types', () => {
	const db = {} as Kysely<any>;
	const UserModel = createModel(db, 'users', 'id');

	// Test that findById can throw errors
	const findById = async (id: number) => {
		try {
			const result = await UserModel.findById(id);
			return result;
		} catch (error) {
			// Error should be typed as any/unknown since we don't know the exact type
			expectTypeOf(error).toBeAny();
			throw error;
		}
	};

	expectTypeOf(findById).parameter(0).toBeNumber();
	expectTypeOf(findById).returns.toBePromise();
});

test('custom error class type definition', () => {
	// Define a custom error class with proper typing
	class CustomNotFoundError extends Error {
		public entity: string;
		public id: string | number;

		constructor(entity: string, id: string | number, message?: string) {
			super(message || `${entity} with id ${id} not found`);
			this.name = 'CustomNotFoundError';
			this.entity = entity;
			this.id = id;
		}
	}

	// Test the custom error constructor types
	expectTypeOf(CustomNotFoundError).toBeConstructor();
	expectTypeOf(
		new CustomNotFoundError('user', 1)
	).toMatchTypeOf<CustomNotFoundError>();
	expectTypeOf(new CustomNotFoundError('user', 1).entity).toBeString();
	expectTypeOf(new CustomNotFoundError('user', 1).id).toMatchTypeOf<
		string | number
	>();
	expectTypeOf(new CustomNotFoundError('user', 1).message).toBeString();

	// Test error instance checking
	const error = new CustomNotFoundError('user', 1);
	expectTypeOf(error).instance.toBeAssignableTo<Error>();

	// Test function that throws the custom error
	const findWithCustomError = async <T>(
		entity: string,
		id: string | number
	): Promise<T> => {
		throw new CustomNotFoundError(entity, id);
	};

	expectTypeOf(findWithCustomError).parameter(0).toBeString();
	expectTypeOf(findWithCustomError)
		.parameter(1)
		.toMatchTypeOf<string | number>();
	expectTypeOf(findWithCustomError).returns.toBePromise();
});

test('result wrapper type for error handling', () => {
	// Define a result type for operations that might fail
	type SuccessResult<T> = {
		success: true;
		data: T;
	};

	type ErrorResult = {
		success: false;
		error: string;
		code?: number;
	};

	type Result<T> = SuccessResult<T> | ErrorResult;

	// Test the Result type with a function
	const findUser = async (
		id: number
	): Promise<Result<{ id: number; name: string }>> => {
		if (id <= 0) {
			return {
				success: false,
				error: 'Invalid user ID',
				code: 400,
			};
		}

		// For type testing, we'll just return a mock successful result
		return {
			success: true,
			data: { id, name: 'Test User' },
		};
	};

	expectTypeOf(findUser).parameter(0).toBeNumber();
	expectTypeOf(findUser).returns.toBePromise();

	// Test type narrowing with the Result type
	const handleResult = async (id: number) => {
		const result = await findUser(id);

		if (result.success) {
			// In the success branch, result should be narrowed to SuccessResult
			expectTypeOf(result).toMatchTypeOf<
				SuccessResult<{ id: number; name: string }>
			>();
			expectTypeOf(result.data).toMatchTypeOf<{ id: number; name: string }>();
			return result.data.name;
		} else {
			// In the error branch, result should be narrowed to ErrorResult
			expectTypeOf(result).toMatchTypeOf<ErrorResult>();
			expectTypeOf(result.error).toBeString();
			return result.error;
		}
	};

	expectTypeOf(handleResult).parameter(0).toBeNumber();
	expectTypeOf(handleResult).returns.resolves.toBeString();
});

test('retry utility with proper typing', () => {
	// Define a retry utility with proper typing
	type RetryOptions = {
		maxRetries?: number;
		delay?: number;
		backoff?: boolean;
		onRetry?: (error: Error, attempt: number) => void;
	};

	const withRetry = async <T>(
		operation: () => Promise<T>,
		options?: RetryOptions
	): Promise<T> => {
		// Implementation not needed for type test
		return operation();
	};

	// Test with a typed operation
	const fetchData = async (): Promise<{ id: number; data: string }> => {
		return { id: 1, data: 'test' };
	};

	const fetchWithRetry = withRetry(fetchData, {
		maxRetries: 3,
		onRetry: (error, attempt) => {
			expectTypeOf(error).toBeObject();
			expectTypeOf(attempt).toBeNumber();
		},
	});

	expectTypeOf(fetchWithRetry).resolves.toMatchTypeOf<{
		id: number;
		data: string;
	}>();

	// Test with a generic operation
	const fetchById = async <T>(id: number): Promise<T> => {
		return {} as T;
	};

	// This should preserve the generic type
	const fetchByIdWithRetry = <T>(id: number) =>
		withRetry(() => fetchById<T>(id), { maxRetries: 3 });

	type User = { id: number; name: string };
	expectTypeOf(fetchByIdWithRetry<User>(1)).resolves.toMatchTypeOf<User>();
});

test('error recovery pattern with transactions', () => {
	// Define database and model types for testing
	interface TestDB {
		users: {
			id: number;
			name: string;
		};
	}

	const db = {} as Kysely<TestDB>;
	const UserModel = createModel<TestDB, 'users', 'id'>(db, 'users', 'id');

	// Test transaction with error handling
	const createUserWithTransaction = async (
		userData: Omit<TestDB['users'], 'id'>
	) => {
		try {
			return await UserModel.transaction(async (trx) => {
				const user = await trx
					.insertInto('users')
					.values(userData as any)
					.returning(['id', 'name'])
					.executeTakeFirst();

				return user;
			});
		} catch (error) {
			// Handle transaction error
			throw new Error(`Transaction failed: ${error.message}`);
		}
	};

	expectTypeOf(createUserWithTransaction)
		.parameter(0)
		.toMatchTypeOf<Omit<TestDB['users'], 'id'>>();

	expectTypeOf(createUserWithTransaction).returns.resolves.toMatchTypeOf<
		Selectable<TestDB['users']>
	>();
});
