# Tech Stack

This is the definitive technology selection for Agentris. All development must use these exact versions to ensure consistency.

| Category             | Technology                | Version         | Purpose                                      | Rationale                                                                 |
| -------------------- | ------------------------- | --------------- | -------------------------------------------- | ------------------------------------------------------------------------- |
| Frontend Language    | TypeScript                | 5.3.x           | Type-safe JavaScript for frontend            | Prevents runtime errors, excellent IDE support, shared types with backend |
| Frontend Framework   | Next.js                   | 14.1.x          | React framework with full-stack capabilities | Server components, API routes, built-in optimizations, great DX           |
| UI Component Library | shadcn/ui                 | Latest          | Accessible, customizable components          | Copy-paste components, Radix UI based, fully customizable, no lock-in     |
| State Management     | Zustand + TanStack Query  | 4.5.x / 5.x     | Client state + Server state                  | Lightweight, TypeScript-first, perfect with tRPC                          |
| Backend Language     | TypeScript                | 5.3.x           | Type-safe JavaScript for backend             | Same language as frontend, shared types, async/await                      |
| Backend Framework    | tRPC                      | 10.45.x         | Type-safe API layer                          | End-to-end type safety, no API contracts needed, perfect with T3          |
| API Style            | tRPC/RPC                  | 10.45.x         | Type-safe remote procedure calls             | Eliminates API versioning issues, automatic client generation             |
| Database             | PostgreSQL                | 16.x            | Primary data store                           | ACID compliance, JSON support, battle-tested, great with Prisma           |
| ORM                  | Prisma                    | 5.8.x           | Database toolkit and ORM                     | Type-safe queries, migrations, excellent DX                               |
| Cache                | Redis                     | 7.2.x           | Caching and session storage                  | Fast in-memory storage, pub/sub for realtime                              |
| File Storage         | Local FS / S3 SDK         | 3.x             | Document and preview storage                 | Local for MVP, S3-ready for production                                    |
| Authentication       | NextAuth.js               | 4.24.x          | OAuth and session management                 | Built-in OAuth providers, works great with Prisma                         |
| Frontend Testing     | Vitest + Testing Library  | 1.2.x / 14.x    | Unit and component testing                   | Fast, Jest-compatible, great with TypeScript                              |
| Backend Testing      | Vitest                    | 1.2.x           | Unit and integration testing                 | Same as frontend, unified testing                                         |
| E2E Testing          | Playwright                | 1.41.x          | End-to-end testing                           | Reliable, fast, great debugging tools                                     |
| Build Tool           | Vite (via Next.js)        | 5.x             | Asset bundling                               | Fastest builds, great HMR, used by Next.js                                |
| Bundler              | Turbopack                 | Beta            | Next.js bundler                              | Faster than Webpack, Rust-based                                           |
| Package Manager      | pnpm                      | 8.15.x          | Dependency management                        | Fast, efficient with monorepos, disk space saving                         |
| Monorepo Tool        | Turborepo                 | 1.12.x          | Monorepo orchestration                       | Incremental builds, great with pnpm                                       |
| IaC Tool             | Docker Compose            | 2.24.x          | Local infrastructure                         | Simple container orchestration for local dev                              |
| CI/CD                | GitHub Actions            | N/A             | Automation pipelines                         | Free for public repos, great marketplace                                  |
| Monitoring           | Console logs + Pino       | 8.x             | Logging and debugging                        | Simple for MVP, structured logging ready                                  |
| Error Tracking       | Local logs (Sentry ready) | N/A             | Error tracking                               | Console for MVP, Sentry-ready for production                              |
| CSS Framework        | Tailwind CSS              | 3.4.x           | Utility-first CSS                            | Fast development, consistent design, pairs with shadcn/ui                 |
| Form Handling        | React Hook Form + Zod     | 7.49.x / 3.22.x | Form validation                              | Type-safe forms, great performance                                        |
| LLM SDK              | Anthropic SDK             | 0.20.x          | Claude API integration                       | Official SDK, TypeScript support                                          |
| Salesforce SDK       | JSForce                   | 3.x             | Comprehensive Salesforce API client         | Full API coverage (REST, SOAP, Metadata, Tooling), no CLI needed          |
| Jira Client          | Jira.js                   | 4.x             | Jira API wrapper                             | Modern, TypeScript-native Jira client                                     |
