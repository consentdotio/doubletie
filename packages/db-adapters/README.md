# @doubletie/db-adapters

A database abstraction layer with multiple adapters for Node.js applications.

## Features

- **Adapter-based architecture**: Easily switch between different database technologies
- **Type-safe interface**: Full TypeScript support for a type-safe database interaction experience
- **Multiple adapters**: Support for Kysely, Drizzle, Prisma, and in-memory data storage
- **Transaction support**: Perform multiple database operations atomically
- **Flexible query API**: Rich query capabilities with a consistent interface

## Installation

```bash
npm install @doubletie/db-adapters
```

## Optional peer dependencies

Depending on which adapter you want to use, you may need to install additional dependencies:

```bash
# For Kysely adapter
npm install kysely

# For Drizzle adapter
npm install drizzle-orm

# For Prisma adapter
npm install prisma @prisma/client
```

## Basic Usage

```typescript
import { getAdapter, DBConfig } from '@doubletie/db-adapters';

// Configure the database
const config: DBConfig = {
  adapter: 'kysely', // or 'drizzle', 'prisma', 'memory'
  connection: {
    type: 'sqlite',
    database: ':memory:',
  },
  debug: true,
};

// Get a configured adapter
const db = await getAdapter(config);

// Create a new record
const user = await db.create({
  model: 'user',
  data: {
    name: 'John Doe',
    email: 'john@example.com',
  },
});

// Find a user by email
const foundUser = await db.findOne({
  model: 'user',
  where: [{ field: 'email', value: 'john@example.com' }],
});

// Update a user
await db.update({
  model: 'user',
  where: [{ field: 'id', value: user.id }],
  update: { name: 'Jane Doe' },
});

// Delete a user
await db.delete({
  model: 'user',
  where: [{ field: 'id', value: user.id }],
});
```

## Using Transactions

```typescript
await db.transaction({
  callback: async (tx) => {
    const user = await tx.create({
      model: 'user',
      data: { name: 'Alice' },
    });
    
    await tx.create({
      model: 'profile',
      data: { userId: user.id, bio: 'Software developer' },
    });
    
    return user;
  },
});
```

## Custom Adapters

You can create your own custom adapter by implementing the `Adapter` interface:

```typescript
import { Adapter, registerAdapter } from '@doubletie/db-adapters';

function myCustomAdapter(options: Record<string, unknown>): Adapter {
  // Implement the adapter interface
  return {
    id: 'custom',
    // ... implement required methods
  };
}

// Register your custom adapter
registerAdapter('custom', myCustomAdapter);

// Then use it
const db = await getAdapter({ adapter: 'custom' });
```

## Available Adapters

- **Memory Adapter**: In-memory data storage for development and testing
- **Kysely Adapter**: SQL query builder with full type safety (recommended for SQL databases)
- **Drizzle Adapter**: Modern, lightweight SQL ORM
- **Prisma Adapter**: Feature-rich ORM with schema definition and migrations

## License

MIT 