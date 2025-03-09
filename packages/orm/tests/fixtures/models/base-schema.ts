export interface TestDatabase {
	users: {
		id: number;
		name: string;
		email: string;
		slug: string;
		status: string;
		created_at: Date;
	};
	user_favorites: {
		user_id: number;
		article_id: string;
	};
}
