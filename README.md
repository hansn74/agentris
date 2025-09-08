# Agentris

[![CI](https://github.com/YOUR_ORG/agentris/actions/workflows/ci.yml/badge.svg)](https://github.com/YOUR_ORG/agentris/actions/workflows/ci.yml)
[![Test Coverage](https://img.shields.io/badge/coverage-report-brightgreen)](https://github.com/YOUR_ORG/agentris/actions)
[![Docker Image](https://ghcr.io/YOUR_ORG/agentris/badge.svg)](https://github.com/YOUR_ORG/agentris/pkgs/container/agentris)

AI-powered Salesforce development platform that streamlines ticket processing, validation, and deployment workflows.

## Architecture Overview

Agentris is built as a modular monorepo using modern web technologies:

- **Frontend**: Next.js 14 with React Server Components
- **Backend**: tRPC for type-safe APIs
- **Database**: PostgreSQL with Prisma ORM
- **Cache**: Redis for session and data caching
- **AI Engine**: LLM orchestration for intelligent automation
- **Integrations**: Salesforce, Jira, and GitHub connectors

## Prerequisites

- Node.js v20.0.0 or higher
- pnpm v10.15.0 or higher
- Docker v24.0.0 or higher
- Git

## Project Structure

```
agentris/
├── apps/
│   └── web/                     # Next.js application
├── packages/
│   ├── api/                     # tRPC API implementation
│   ├── db/                      # Prisma database layer
│   ├── auth/                    # NextAuth configuration
│   ├── integrations/            # External service integrations
│   ├── ai-engine/               # LLM orchestration
│   ├── services/                # Business logic
│   └── shared/                  # Shared utilities and types
├── docker/
│   └── docker-compose.yml       # PostgreSQL + Redis
├── docs/                        # Documentation
├── storage/                     # Local file storage (gitignored)
└── scripts/                     # Development scripts
```

## Setup Instructions

### 1. Clone the Repository

```bash
git clone <repository-url>
cd agentris
```

### 2. Install Dependencies

```bash
pnpm install
```

### 3. Environment Configuration

Copy the example environment file and configure your settings:

```bash
cp .env.example .env
```

Edit `.env` with your configuration:

- Database credentials (default provided for local development)
- Redis connection (default provided for local development)
- API keys for integrations (add when needed)

### 4. Start Infrastructure Services

Start PostgreSQL and Redis using Docker Compose:

```bash
pnpm docker:up
```

Verify services are running:

```bash
pnpm docker:logs
```

### 5. Initialize Database

Run database migrations (will be configured in future stories):

```bash
pnpm db:push
```

### 6. Start Development Server

```bash
pnpm dev
```

The application will be available at:

- Web UI: http://localhost:3000
- API: Integrated with Next.js

## Development Commands

| Command            | Description                            |
| ------------------ | -------------------------------------- |
| `pnpm dev`         | Start all services in development mode |
| `pnpm dev:web`     | Start frontend only                    |
| `pnpm dev:api`     | Start backend only                     |
| `pnpm build`       | Build all packages                     |
| `pnpm test`        | Run tests across all packages          |
| `pnpm lint`        | Lint all packages                      |
| `pnpm typecheck`   | Type-check all packages                |
| `pnpm db:push`     | Push database schema changes           |
| `pnpm db:generate` | Generate Prisma client                 |
| `pnpm docker:up`   | Start Docker services                  |
| `pnpm docker:down` | Stop Docker services                   |
| `pnpm docker:logs` | View Docker service logs               |

## Module Responsibilities

### Apps

- **web**: Main Next.js application with UI components and pages

### Packages

- **api**: tRPC routers and procedures for API endpoints
- **db**: Prisma schema, migrations, and database client
- **auth**: NextAuth.js configuration and authentication logic
- **integrations**: External service connectors (Salesforce, Jira, GitHub)
- **ai-engine**: LLM orchestration and prompt management
- **services**: Core business logic and domain services
- **shared**: Shared types, utilities, and constants

## Development Workflow

1. **Feature Development**
   - Create feature branch from main
   - Implement changes following coding standards
   - Write tests for new functionality
   - Ensure type safety across packages

2. **Code Quality**
   - Pre-commit hooks automatically run linting and formatting
   - TypeScript strict mode enforces type safety
   - ESLint and Prettier maintain code consistency

3. **Testing**
   - Unit tests with Vitest
   - Integration tests for API endpoints
   - E2E tests with Playwright (future)

4. **Deployment**
   - Build production assets: `pnpm build`
   - Run production checks: `pnpm typecheck && pnpm test`
   - Deploy using preferred platform

## Troubleshooting

### Common Issues

**Port conflicts**

- PostgreSQL (5432) or Redis (6379) ports in use
- Solution: Stop conflicting services or modify ports in docker-compose.yml

**pnpm installation fails**

- Ensure Node.js v20+ is installed
- Clear cache: `pnpm store prune`

**TypeScript errors**

- Run `pnpm typecheck` to identify issues
- Ensure all packages are properly installed

**Docker services not starting**

- Check Docker daemon is running
- Verify port availability
- Check logs: `pnpm docker:logs`

**Database connection issues**

- Ensure Docker services are running
- Verify DATABASE_URL in .env matches Docker configuration
- Check PostgreSQL container health: `docker ps`

## Contributing

1. Follow conventional commit format for commit messages
2. Ensure all tests pass before submitting PR
3. Update documentation for significant changes
4. Follow TypeScript strict mode guidelines

## Technology Stack

- **Frontend**: Next.js 14.1.x, React, TypeScript
- **UI Components**: shadcn/ui with Tailwind CSS
- **Backend**: tRPC 10.45.x, TypeScript
- **Database**: PostgreSQL 16.x with Prisma 5.8.x
- **Cache**: Redis 7.2.x
- **Authentication**: NextAuth.js 4.24.x
- **Testing**: Vitest 1.2.x
- **Build Tools**: Turborepo 2.5.x, pnpm 10.15.x
- **Code Quality**: ESLint, Prettier, Husky

## License

[License information to be added]
