<div align="center">
    <img src="https://doubletie.com/emoji-icon.png" alt="emoji Logo" width="64" height="64" />
    <h1>Double Tie</h1>
    <p>
        A TypeScript toolkit for building self-hostable backend SDKs. Double Tie provides a complete set of tools to help developers create type-safe, self-hostable backend services that can be distributed as npm packages.
    </p>
</div>

## Vision

Double Tie enables developers to build and distribute backend functionality as type-safe npm packages, allowing end users to self-host their backend services while maintaining full type safety from client to database.

## Available Packages

### 📦 @doubletie/query-builder

A type-safe, functional query builder and model layer built on top of Kysely. Our first package provides the foundation for type-safe database operations.

[Read more about @doubletie/query-builder](./packages/query-builder/README.md)

## Coming Soon

We're actively working on additional packages to complete the toolkit:

- 🏗️ `@doubletie/sdk-builder` - Create type-safe SDK packages with client and server components
- 📡 `@doubletie/client` - Type-safe client library generator
- 🛠️ `@doubletie/cli` - Migration and deployment tools
- 📊 `@doubletie/model-mapper` - Database schema to type-safe models
- ⚡ `@doubletie/functions` - Self-hostable function runtime

## Features (Planned)

- 🔒 **End-to-end Type Safety**: Full type inference from database to client
- 🏠 **Self-hostable**: Package your backend as a distributable npm module
- 🚀 **Multiple Deploy Targets**: Support for Docker, AWS, Vercel, and more
- 📦 **Zero Config Deployment**: Automated deployment with sensible defaults
- 🔄 **Database Migrations**: Version-controlled database schema management
- 🛡️ **Built-in Security**: Best practices for auth and data protection
- 📡 **Type-safe Clients**: Auto-generated client libraries with full type support

## Development

Prerequisites:

- Node.js >= 18
- pnpm >= 8

```bash
# Clone repository
git clone https://github.com/consentdotio/doubletie.git
cd doubletie

# Install dependencies
pnpm install

# Build packages
pnpm build

# Run tests
pnpm test
```

## Why Double Tie?

Traditional backend frameworks focus on building monolithic applications. Double Tie takes a different approach by helping developers create distributable, self-hostable backend SDKs. This enables:

- 🏢 Companies to maintain control of their data while using third-party services
- 👩‍💻 Developers to distribute backend functionality as npm packages
- 🔐 Better data privacy through self-hosting
- 📦 Easier integration of backend services into existing applications

## Authors

**Christopher Burns** ([@burnedchris](https://x.com/burnedchris))

## Contributing

We welcome contributions! See our [Contributing Guide](CONTRIBUTING.md) for details.

## License

MIT License - see LICENSE file for details
