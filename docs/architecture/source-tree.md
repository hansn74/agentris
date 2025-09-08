# Source Tree

## Application Source Code Structure

```
agentris/
├── apps/
│   └── web/                          # Next.js web application
│       ├── app/                      # App Router (Next.js 15)
│       │   ├── layout.tsx            # Root layout
│       │   └── page.tsx              # Home page
│       ├── components/               # React components
│       ├── lib/                      # Web-specific utilities
│       ├── styles/                   # CSS/styling
│       └── public/                   # Static assets
│
└── packages/
    ├── @agentris/ai-engine/          # AI/LLM orchestration
    │   ├── src/
    │   │   ├── agents/               # AI agent implementations
    │   │   ├── prompts/              # Prompt templates
    │   │   ├── providers/            # LLM provider integrations
    │   │   └── index.ts              # Package exports
    │   └── tests/
    │
    ├── @agentris/api/                # tRPC API layer
    │   ├── src/
    │   │   ├── routers/              # API route definitions
    │   │   ├── procedures/           # tRPC procedures
    │   │   ├── middleware/           # API middleware
    │   │   └── index.ts              # API exports
    │   └── tests/
    │
    ├── @agentris/auth/               # Authentication
    │   ├── src/
    │   │   ├── providers/            # Auth providers
    │   │   ├── callbacks/            # Auth callbacks
    │   │   ├── config/               # NextAuth configuration
    │   │   └── index.ts              # Auth exports
    │   └── tests/
    │
    ├── @agentris/db/                 # Database layer
    │   ├── prisma/
    │   │   ├── schema.prisma         # Database schema
    │   │   └── migrations/           # Database migrations
    │   ├── src/
    │   │   ├── client.ts             # Prisma client
    │   │   ├── queries/              # Database queries
    │   │   └── index.ts              # DB exports
    │   └── tests/
    │
    ├── @agentris/integrations/       # External integrations
    │   ├── src/
    │   │   ├── salesforce/           # Salesforce integration
    │   │   │   ├── client.ts
    │   │   │   ├── types.ts
    │   │   │   └── operations.ts
    │   │   ├── github/               # GitHub integration
    │   │   │   ├── client.ts
    │   │   │   ├── types.ts
    │   │   │   └── operations.ts
    │   │   └── index.ts              # Integration exports
    │   └── tests/
    │
    ├── @agentris/services/           # Business logic
    │   ├── src/
    │   │   ├── agent/                # Agent management service
    │   │   ├── workflow/             # Workflow orchestration
    │   │   ├── testing/              # Test automation service
    │   │   ├── reporting/            # Reporting service
    │   │   └── index.ts              # Service exports
    │   └── tests/
    │
    └── @agentris/shared/             # Shared utilities
        ├── src/
        │   ├── types/                # TypeScript type definitions
        │   ├── utils/                # Utility functions
        │   ├── constants/            # Shared constants
        │   ├── errors/               # Error definitions
        │   └── index.ts              # Shared exports
        └── tests/
```

## Package Dependencies

```mermaid
graph TD
    A[apps/web] --> B[@agentris/api]
    A --> C[@agentris/auth]
    A --> H[@agentris/shared]

    B --> D[@agentris/db]
    B --> E[@agentris/services]
    B --> C
    B --> H

    E --> D
    E --> F[@agentris/integrations]
    E --> G[@agentris/ai-engine]
    E --> H

    F --> H
    G --> H
    C --> D
    C --> H
    D --> H
```

## Key Source Directories

### `/apps/web`

Next.js application using App Router pattern:

- Modern React Server Components
- Type-safe API calls via tRPC
- Tailwind CSS for styling
- NextAuth for authentication

### `/packages/api`

tRPC-based API layer:

- Type-safe client-server communication
- Automatic TypeScript inference
- Built-in validation with Zod
- WebSocket support for real-time features

### `/packages/db`

Database abstraction with Prisma:

- Type-safe database queries
- Automatic migration management
- Support for PostgreSQL
- Seeding and fixture utilities

### `/packages/ai-engine`

AI/LLM orchestration:

- Multiple LLM provider support
- Prompt management and versioning
- Agent coordination
- Response streaming

### `/packages/integrations`

External service connectors:

- Salesforce API integration
- GitHub API integration
- Webhook handlers
- OAuth flow management

### `/packages/services`

Core business logic:

- Agent workflow orchestration
- Test automation logic
- Report generation
- Event processing

### `/packages/shared`

Common utilities and types:

- Shared TypeScript types
- Validation schemas
- Error handling utilities
- Common constants
