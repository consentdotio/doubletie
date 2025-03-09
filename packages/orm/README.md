# Kysley ORM

A type-safe ORM layer for Kysely with enhanced model definitions and type inference.

## Features

- Type-safe database schema definitions
- Type-safe model definitions with validation
- Automatic type inference for model CRUD operations
- Support for model relationships
- Extensible model architecture with mixins
- Simplified API for common database operations

## Installation

```bash
npm install kysley-orm kysely
```

## Basic Usage

```typescript
import { Database, PostgresDialect } from 'kysley-orm';

// Define your database schema
interface DatabaseSchema {
  users: {
    id: number;
    name: string;
    email: string;
    created_at: Date;
  };
  posts: {
    id: number;
    title: string;
    content: string;
    user_id: number;
    created_at: Date;
  };
}

// Create a database instance
const db = new Database<DatabaseSchema>({
  dialect: new PostgresDialect({
    host: 'localhost',
    database: 'mydb',
    user: 'postgres',
    password: 'password',
  }),
});

// Create models
const userModel = db.model('users', 'id');
const postModel = db.model('posts', 'id');

// Use the models
async function main() {
  // Find a user by ID
  const user = await userModel.findById(1);
  
  // Get user's posts
  const posts = await postModel.find('user_id', user.id);
  
  // Create a new post
  const newPost = await postModel.insertOne({
    title: 'New Post',
    content: 'Post content',
    user_id: user.id,
    created_at: new Date(),
  });
}
```

## Enhanced Type-Safe Model Definitions

With the enhanced type system, you can define your models with more type safety:

```typescript
import { 
  Database, 
  PostgresDialect, 
  defineSchema, 
  defineModels, 
  field, 
  primaryKey, 
  relation, 
  RelationType 
} from 'kysley-orm';

// Define your database schema
interface DatabaseSchema {
  users: {
    id: number;
    name: string;
    email: string;
    created_at: Date;
  };
  posts: {
    id: number;
    title: string;
    content: string;
    user_id: number;
    created_at: Date;
  };
}

// Define model schemas with type information
const userSchema = defineSchema<DatabaseSchema['users']>({
  fields: {
    id: field('number', { nullable: false }),
    name: field('string', { nullable: false }),
    email: field('string', { 
      nullable: false,
      validate: {
        pattern: /^[^\s@]+@[^\s@]+\.[^\s@]+$/
      }
    }),
    created_at: field('date', { defaultValue: () => new Date() })
  },
  relations: {
    posts: relation<DatabaseSchema['users'], DatabaseSchema['posts']>(
      RelationType.HasManyRelation, 
      {
        model: 'posts',
        from: 'id',
        to: 'user_id'
      }
    )
  },
  indexes: [
    { name: 'email_idx', columns: ['email'], unique: true }
  ]
});

const postSchema = defineSchema<DatabaseSchema['posts']>({
  fields: {
    id: field('number', { nullable: false }),
    title: field('string', { 
      nullable: false,
      validate: {
        min: 3,
        max: 255
      }
    }),
    content: field('string', { nullable: false }),
    user_id: field('number', { nullable: false }),
    created_at: field('date', { defaultValue: () => new Date() })
  },
  relations: {
    user: relation<DatabaseSchema['posts'], DatabaseSchema['users']>(
      RelationType.BelongsToOneRelation,
      {
        model: 'users',
        from: 'user_id',
        to: 'id'
      }
    )
  }
});

// Define model registry
const models = defineModels<DatabaseSchema>({
  users: {
    schema: userSchema,
    primaryKey: primaryKey<DatabaseSchema['users']>('id', { autoIncrement: true })
  },
  posts: {
    schema: postSchema,
    primaryKey: primaryKey<DatabaseSchema['posts']>('id', { autoIncrement: true })
  }
});

// Create database instance with registered models
const db = new Database<DatabaseSchema>({
  dialect: new PostgresDialect({
    host: 'localhost',
    database: 'mydb',
    user: 'postgres',
    password: 'password',
  }),
}).registerModels(models);

// Use models with enhanced type safety
async function main() {
  // Get registered models with full type inference
  const userModel = db.getModel('users');
  const postModel = db.getModel('posts');
  
  // Type-safe operations
  const user = await userModel.findById(1);
  
  // TypeScript will ensure all required fields are provided
  const newPost = await postModel.insertOne({
    title: 'New Post',
    content: 'Post content',
    user_id: user.id
    // created_at is optional due to default value
  });
  
  // Type safety for update operations
  await userModel.updateById(
    user.id,
    'email',
    'new.email@example.com' // Type checked to be a string
  );
}
```

## Type Inference Utilities

The library provides several type inference utilities to help with complex type scenarios:

```typescript
import { 
  ModelInsertType, 
  ModelUpdateType, 
  ModelSelectType, 
  RequiredFields, 
  WithOptional 
} from 'kysley-orm';

// Get the type for inserting a new user
type NewUser = ModelInsertType<DatabaseSchema, 'users'>;

// Get the type for updating a user
type UserUpdate = ModelUpdateType<DatabaseSchema, 'users'>;

// Get the type for selected user (returned from queries)
type User = ModelSelectType<DatabaseSchema, 'users'>;

// Get only required fields
type RequiredUserFields = RequiredFields<DatabaseSchema['users']>;

// Make some fields optional
type UserWithOptionalEmail = WithOptional<DatabaseSchema['users'], 'email'>;
```

## Model Mixins

Kysley ORM supports composable mixins for adding functionality to models:

```typescript
import { createdAtMixin, updatedAtMixin, slugMixin } from 'kysley-orm/mixins';

// Create model with mixins
const postModel = db.model('posts', 'id', postSchema)
  .use(createdAtMixin({ field: 'created_at' }))
  .use(updatedAtMixin({ field: 'updated_at' }))
  .use(slugMixin({
    source: 'title',
    target: 'slug',
    unique: true
  }));

// Now post model has additional functionality
await postModel.insertOne({
  title: 'New Post',
  content: 'Post content',
  user_id: 1
  // created_at, updated_at are handled by mixins
  // slug will be generated from title
});
```

## Transactions

```typescript
await db.transaction(async (trx) => {
  const user = await userModel.findById(1, trx);
  
  await postModel.insertOne({
    title: 'New Post',
    content: 'Post content',
    user_id: user.id
  }, trx);
  
  // Both operations will be committed together
});
```

## Configuration

See the [Configuration Guide](./docs/configuration.md) for complete configuration options.

## License

MIT
