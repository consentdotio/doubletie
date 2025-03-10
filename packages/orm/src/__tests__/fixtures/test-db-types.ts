/**
 * Standard test database types for use across all test files
 */

/**
 * Base test database with users table
 */
export interface BasicTestDB {
	users: {
		id: number;
		name: string;
		email: string;
	};
}

/**
 * Test database with posts and comments
 */
export interface BlogTestDB extends BasicTestDB {
	posts: {
		id: number;
		title: string;
		content: string;
		user_id: number;
		published: boolean;
		created_at: Date;
	};
	comments: {
		id: number;
		user_id: number;
		post_id: number;
		content: string;
		created_at: Date;
	};
}

/**
 * Test database for slug functionality
 */
export interface SlugTestDB {
	users: {
		id: number;
		name: string;
		email: string;
		slug: string;
		title: string;
	};
	posts: {
		id: number;
		title: string;
		slug: string;
		content: string;
	};
}

/**
 * Test database for ID generator functionality
 */
export interface IdGeneratorTestDB {
	users: {
		id: string | number;
		name: string;
		email: string;
	};
	posts: {
		id: string;
		title: string;
		content: string;
	};
}

/**
 * Test database for error handling and concurrency tests
 */
export interface ConcurrencyTestDB {
	users: {
		id: number;
		name: string;
		email: string;
		status: string;
		version: number;
	};
	transactions: {
		id: number;
		user_id: number;
		amount: number;
		status: string;
	};
}

/**
 * Test database for advanced operations tests
 */
export interface AdvancedOperationsTestDB {
	users: {
		id: number;
		name: string;
		email: string;
		status?: string;
	};
	products: {
		id: string;
		name: string;
	};
	json_test: {
		id: string;
		data: string;
	};
}

/**
 * Test database for pagination tests
 */
export interface PaginationTestDB {
	users: {
		id: number;
		name: string;
		email: string;
		created_at: Date;
	};
}

/**
 * Test database for complex query building tests
 */
export interface QueryBuildingTestDB {
	users: {
		id: number;
		name: string;
		email: string;
		status: string;
		created_at: Date;
	};
	posts: {
		id: number;
		user_id: number;
		title: string;
		content: string;
		published: boolean;
		created_at: Date;
	};
	categories: {
		id: number;
		name: string;
	};
	post_categories: {
		post_id: number;
		category_id: number;
	};
}

/**
 * Test database for comprehensive CRUD tests
 */
export interface CrudTestDB {
	users: {
		id: number;
		name: string;
		username: string;
		email: string;
		password: string;
		followersCount: number;
		createdAt: string;
		updatedAt: string;
	};
	comments: {
		id: number;
		user_id: number;
		message: string;
	};
}
