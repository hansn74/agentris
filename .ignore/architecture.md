# Agentris Fullstack Architecture Document

## Introduction

This document outlines the complete fullstack architecture for Agentris, including backend systems, frontend implementation, and their integration. It serves as the single source of truth for AI-driven development, ensuring consistency across the entire technology stack.

This unified approach combines what would traditionally be separate backend and frontend architecture documents, streamlining the development process for modern fullstack applications where these concerns are increasingly intertwined.

### Starter Template: T3 Stack with Turborepo

Based on the requirements analysis, Agentris will be built using the T3 Stack (Next.js + tRPC + Prisma + TypeScript) with Turborepo for monorepo management. This provides:

- End-to-end type safety with tRPC
- Built-in OAuth support via NextAuth.js
- Excellent developer experience with hot reload
- Clear migration path to microservices if needed

### Change Log

| Date       | Version | Description                   | Author                 |
| ---------- | ------- | ----------------------------- | ---------------------- |
| 2025-01-09 | 1.0     | Initial architecture document | Winston (AI Architect) |

## High Level Architecture

### Technical Summary

Agentris MVP will be built as a **T3 Stack modular monolith** running entirely on **local development machines**, using **tRPC** for type-safe API communication between the Next.js frontend and backend modules. The architecture leverages **Turborepo** for monorepo management, **Prisma** with local **PostgreSQL** for data persistence, and **Redis** for caching. All modules (Jira Integration, Salesforce, AI Engine) run as part of a single Node.js process locally, with **Docker Compose** orchestrating the database and cache services. This local-first approach enables rapid MVP development and testing with real Salesforce sandboxes while deferring cloud deployment complexity. The architecture is designed to be "cloud-ready" for future deployment to Vercel/Railway/Render when needed.

### Platform and Infrastructure Choice

**Platform:** Local Development Environment  
**Key Services:**

- Next.js Dev Server (Port 3000)
- tRPC API Server (integrated with Next.js)
- PostgreSQL via Docker (Port 5432)
- Redis via Docker (Port 6379)
- Local file storage (./storage directory)
  **Deployment Regions:** Local only for MVP, US-East-1 (primary) when cloud-ready

### Repository Structure

**Structure:** Monorepo with Turborepo  
**Monorepo Tool:** Turborepo (with pnpm workspaces)  
**Package Organization:**

- apps/web (Next.js frontend + API routes)
- packages/db (Prisma schema & client)
- packages/integrations/\* (Jira, Salesforce, Bitbucket, Confluence)
- packages/ai-engine (Claude integration)
- packages/shared (types, utils, constants)

### High Level Architecture Diagram

```mermaid
graph TB
    subgraph "Browser"
        UI[Next.js App - localhost:3000]
    end

    subgraph "Local Node.js Process"
        subgraph "Next.js Server"
            Pages[React Pages]
            API[API Routes/tRPC]
            Auth[NextAuth.js]
        end

        subgraph "Business Modules"
            AI[AI Engine Module]
            SF[Salesforce Module]
            Jira[Jira Module]
            BB[Bitbucket Module]
            Preview[Preview Generator]
            Audit[Audit Module]
        end
    end

    subgraph "Docker Containers"
        PG[(PostgreSQL :5432)]
        Redis[(Redis :6379)]
    end

    subgraph "Local Storage"
        FS[File System ./storage]
    end

    subgraph "External APIs"
        Claude[Anthropic Claude API]
        SFAPI[Salesforce Sandbox API]
        JiraAPI[Atlassian Cloud API]
        BBAPI[Bitbucket Cloud API]
    end

    UI --> Pages
    Pages --> API
    API --> Auth

    API --> AI
    API --> SF
    API --> Jira
    API --> BB
    API --> Preview
    API --> Audit

    AI --> Claude
    SF --> SFAPI
    Jira --> JiraAPI
    BB --> BBAPI

    AI --> PG
    SF --> PG
    Jira --> PG
    Audit --> PG

    AI --> Redis
    Preview --> Redis

    Preview --> FS
    Audit --> FS
```

### Architectural Patterns

- **T3 Stack Pattern:** Next.js + tRPC + Prisma for full type safety - _Rationale:_ Eliminates runtime API errors and provides excellent DX for rapid development
- **Monolithic Development:** Single process for all modules during MVP - _Rationale:_ Simplifies debugging and reduces infrastructure complexity for local development
- **File-Based Storage:** Local filesystem for documents and previews - _Rationale:_ Avoids cloud storage costs and complexity during MVP development
- **Docker Compose Services:** PostgreSQL and Redis in containers - _Rationale:_ Consistent development environment without local installation hassles
- **Environment-Based Config:** .env files for API keys and settings - _Rationale:_ Simple configuration management for local development
- **Synchronous Processing:** Direct API calls without queue systems - _Rationale:_ Simpler to debug and sufficient for single-user MVP
- **Hot Reload Everything:** Next.js fast refresh + Turborepo watch - _Rationale:_ Rapid iteration during development
- **Sandbox-First Testing:** Connect to Salesforce sandbox orgs only - _Rationale:_ Safe testing environment without production risk

## Tech Stack

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
| Salesforce SDK       | JSForce + SF CLI          | 3.x / 2.x       | Salesforce API wrapper                       | Comprehensive API coverage, CLI for metadata                              |
| Jira Client          | Jira.js                   | 4.x             | Jira API wrapper                             | Modern, TypeScript-native Jira client                                     |

## Data Models

### User

**Purpose:** Represents authenticated consultants who use the system

**Key Attributes:**

- id: UUID - Unique identifier
- email: String - Email address for login
- name: String - Display name
- role: Enum(CONSULTANT, MANAGER, ADMIN) - Access level
- createdAt: DateTime - Account creation timestamp
- lastActive: DateTime - Last activity timestamp

**TypeScript Interface:**

```typescript
interface User {
  id: string;
  email: string;
  name: string;
  role: 'CONSULTANT' | 'MANAGER' | 'ADMIN';
  createdAt: Date;
  lastActive: Date;
  organizations: Organization[];
  tickets: Ticket[];
}
```

**Relationships:**

- Has many Organizations (Salesforce orgs)
- Has many assigned Tickets
- Has many AuditLogs

### Organization

**Purpose:** Represents a connected Salesforce org

**Key Attributes:**

- id: UUID - Unique identifier
- name: String - Org name/alias
- instanceUrl: String - Salesforce instance URL
- orgId: String - Salesforce org ID
- type: Enum(SANDBOX, PRODUCTION) - Org type
- refreshToken: String (encrypted) - OAuth refresh token
- lastSync: DateTime - Last metadata sync

**TypeScript Interface:**

```typescript
interface Organization {
  id: string;
  name: string;
  instanceUrl: string;
  orgId: string;
  type: 'SANDBOX' | 'PRODUCTION';
  lastSync: Date | null;
  userId: string;
  user: User;
  deployments: Deployment[];
}
```

**Relationships:**

- Belongs to User
- Has many Deployments
- Has many Tickets

### Ticket

**Purpose:** Represents a Jira ticket being processed

**Key Attributes:**

- id: UUID - Internal identifier
- jiraKey: String - Jira ticket key (e.g., PROJ-123)
- summary: String - Ticket title
- description: Text - Full ticket description
- status: Enum - Processing status
- ambiguityScore: Float - AI-detected ambiguity level
- assignedTo: UUID - Assigned user

**TypeScript Interface:**

```typescript
interface Ticket {
  id: string;
  jiraKey: string;
  jiraId: string;
  summary: string;
  description: string;
  status:
    | 'NEW'
    | 'ANALYZING'
    | 'CLARIFYING'
    | 'READY'
    | 'IMPLEMENTING'
    | 'TESTING'
    | 'COMPLETED'
    | 'FAILED';
  ambiguityScore: number;
  acceptanceCriteria: string | null;
  assignedToId: string;
  organizationId: string;
  assignedTo: User;
  organization: Organization;
  analyses: Analysis[];
  previews: Preview[];
  deployments: Deployment[];
  clarifications: Clarification[];
  createdAt: Date;
  updatedAt: Date;
}
```

**Relationships:**

- Belongs to User (assigned)
- Belongs to Organization
- Has many Analyses
- Has many Previews
- Has one Deployment
- Has many Clarifications

[Additional models: Analysis, Preview, Deployment, Clarification, AuditLog - see full schema below]

## API Specification

### tRPC Router Definitions

```typescript
// Root Router Type Definition
export const appRouter = router({
  auth: authRouter,
  ticket: ticketRouter,
  salesforce: salesforceRouter,
  ai: aiRouter,
  preview: previewRouter,
  deployment: deploymentRouter,
  audit: auditRouter,
  integration: integrationRouter,
});
```

[Full router definitions included in architecture - see sections above]

## Components

### AI Engine Module

**Responsibility:** Orchestrates all LLM interactions and intelligence features

**Key Interfaces:**

- `analyzeRequirements()` - Detect ambiguities in tickets
- `generateClarifications()` - Create clarifying questions
- `generateImplementation()` - Create Salesforce metadata

**Dependencies:** Anthropic SDK, Prisma, Redis cache

**Technology Stack:** TypeScript, Claude API, Langchain

### Salesforce Integration Module

**Responsibility:** Handles all Salesforce API operations and metadata management

**Key Interfaces:**

- `authenticate()` - OAuth and session management
- `deployMetadata()` - Deploy changes to org
- `retrieveMetadata()` - Fetch org configuration
- `runTests()` - Execute Apex tests

**Dependencies:** JSForce, Salesforce CLI, Database

**Technology Stack:** TypeScript, JSForce, child_process for CLI

### Jira Integration Module

**Responsibility:** Syncs with Jira for ticket management

**Key Interfaces:**

- `fetchTicket()` - Get ticket details
- `postComment()` - Add clarifications
- `updateStatus()` - Sync ticket status
- `attachFile()` - Add deployment reports

**Dependencies:** Jira.js client, Database

**Technology Stack:** TypeScript, Jira REST API v3

[Additional components detailed above]

## External APIs

### Anthropic Claude API

- **Purpose:** LLM for requirement analysis, ambiguity detection, code generation
- **Documentation:** https://docs.anthropic.com/claude/reference/
- **Base URL(s):** https://api.anthropic.com/v1
- **Authentication:** API Key in header (X-API-Key)
- **Rate Limits:** 50 requests/minute, 40,000 tokens/minute

**Key Endpoints Used:**

- `POST /messages` - Send messages for analysis and generation

**Integration Notes:** Use streaming for long responses, implement exponential backoff, cache responses for similar inputs to reduce costs

[Additional external APIs: Salesforce, Jira, Bitbucket - see sections above]

## Core Workflows

[Detailed sequence diagrams for Ticket Analysis, Preview Generation, Deployment, and Batch Processing workflows included above]

## Database Schema

```prisma
// prisma/schema.prisma

generator client {
  provider = "prisma-client-js"
}

datasource db {
  provider = "postgresql"
  url      = env("DATABASE_URL")
}

// [Full Prisma schema included - see Section 9 above]
```

## Frontend Architecture

### Component Architecture

#### Component Organization

```
apps/web/src/
├── components/
│   ├── ui/                    # shadcn/ui components
│   ├── layout/
│   ├── dashboard/
│   ├── ticket/
│   ├── preview/
│   └── deployment/
├── hooks/
├── lib/
└── stores/
```

[Full component templates and patterns included above]

### State Management Architecture

#### State Structure

- Server state managed by TanStack Query via tRPC
- Client state managed by Zustand for UI preferences
- Form state managed by React Hook Form
- Optimistic updates for better UX
- Real-time updates via WebSocket subscriptions

### Routing Architecture

#### Route Organization

```
app/
├── (auth)/
│   ├── login/
│   └── setup/
├── (dashboard)/
│   ├── layout.tsx
│   ├── page.tsx
│   ├── tickets/
│   ├── preview/
│   ├── deployments/
│   └── settings/
└── api/
    ├── trpc/
    └── auth/
```

[Protected route patterns and service layer examples included above]

## Backend Architecture

### Service Architecture

#### Module Organization

```
packages/
├── api/                          # tRPC API layer
├── integrations/
│   ├── jira/
│   ├── salesforce/
│   └── bitbucket/
├── ai-engine/
└── services/
```

[Service templates and repository patterns included above]

### Database Architecture

[Repository pattern implementation with TypeScript included above]

### Authentication and Authorization

[Auth flow diagram and middleware implementation included above]

## Unified Project Structure

```
agentris/
├── .github/                      # CI/CD workflows
├── apps/
│   └── web/                     # Next.js application
├── packages/
│   ├── api/                     # tRPC API
│   ├── db/                      # Prisma database
│   ├── auth/                    # NextAuth config
│   ├── integrations/
│   ├── ai-engine/               # LLM orchestration
│   ├── services/                # Business logic
│   └── shared/                  # Shared utilities
├── storage/                     # Local file storage (gitignored)
├── scripts/                     # Development scripts
├── docs/
├── docker/
│   └── docker-compose.yml      # PostgreSQL + Redis
├── .env.example                # Environment template
├── package.json                # Root package.json
├── pnpm-workspace.yaml         # pnpm workspace config
├── turbo.json                  # Turborepo config
└── README.md
```

## Development Workflow

### Local Development Setup

#### Prerequisites

```bash
node --version  # v20.0.0 or higher
pnpm --version  # v8.15.0 or higher
docker --version  # v24.0.0 or higher
```

#### Initial Setup

```bash
# Clone repository
git clone https://github.com/yourorg/agentris.git
cd agentris

# Install dependencies
pnpm install

# Copy environment variables
cp .env.example .env
cp apps/web/.env.example apps/web/.env.local

# Start Docker services
docker-compose up -d

# Run database migrations
pnpm db:push

# Generate Prisma client
pnpm db:generate
```

#### Development Commands

```bash
# Start all services
pnpm dev

# Start frontend only
pnpm dev:web

# Start backend only
pnpm dev:api

# Run tests
pnpm test

# Type checking
pnpm typecheck

# Build all packages
pnpm build
```

### Environment Configuration

#### Required Environment Variables

```bash
# Frontend (.env.local)
NEXTAUTH_URL=http://localhost:3000
NEXTAUTH_SECRET=your-secret-here

# Backend (.env)
DATABASE_URL=postgresql://postgres:password@localhost:5432/agentris
REDIS_URL=redis://localhost:6379
ANTHROPIC_API_KEY=your-anthropic-api-key

# OAuth Configuration
JIRA_CLIENT_ID=your-jira-client-id
JIRA_CLIENT_SECRET=your-jira-client-secret
SF_CLIENT_ID=your-salesforce-client-id
SF_CLIENT_SECRET=your-salesforce-client-secret
```

## Deployment Architecture

### Deployment Strategy

**Local Development (MVP):**

- Platform: Local machine
- Build Command: `pnpm build`
- Deployment Method: Direct Node.js execution

**Future Cloud Deployment:**

- Frontend: Vercel
- Backend: Railway/Render
- Database: Supabase/Neon
- Cache: Upstash Redis

### CI/CD Pipeline

[GitHub Actions workflow included above]

### Environments

| Environment | Frontend URL          | Backend URL               | Purpose                |
| ----------- | --------------------- | ------------------------- | ---------------------- |
| Development | http://localhost:3000 | http://localhost:3000/api | Local development      |
| Staging     | TBD                   | TBD                       | Pre-production testing |
| Production  | TBD                   | TBD                       | Live environment       |

## Security and Performance

### Security Requirements

**Frontend Security:**

- CSP Headers configured
- XSS Prevention via React escaping
- HTTPOnly cookies for sessions

**Backend Security:**

- Input Validation with Zod
- Rate Limiting: 50 req/min per user
- CORS Policy: Strict origin checking

**Authentication Security:**

- Encrypted tokens in database
- 24-hour session timeout
- OAuth 2.0 for all integrations

### Performance Optimization

**Frontend Performance:**

- Bundle Size Target: <200KB initial JS
- Code splitting by route
- 5-minute cache for ticket data

**Backend Performance:**

- Response Time Target: <500ms reads, <2s AI ops
- Database indexes on all foreign keys
- Redis caching for metadata

## Testing Strategy

### Testing Pyramid

```
        E2E Tests (5%)
       /              \
    Integration Tests (25%)
    /                    \
Frontend Unit (35%)  Backend Unit (35%)
```

[Test organization and examples included above]

## Coding Standards

### Critical Fullstack Rules

- **Type Sharing:** Always define types in packages/shared
- **API Calls:** Never make direct HTTP calls - use tRPC
- **Environment Variables:** Access through config objects only
- **Error Handling:** All procedures must use standard error handler
- **State Updates:** Never mutate state directly
- **Database Access:** Only through repository pattern
- **Authentication:** Use protectedProcedure for auth routes
- **Validation:** All inputs validated with Zod
- **Async Operations:** Handle loading and error states
- **Git Commits:** Use conventional commits

### Naming Conventions

| Element          | Frontend             | Backend         | Example           |
| ---------------- | -------------------- | --------------- | ----------------- |
| Components       | PascalCase           | -               | `UserProfile.tsx` |
| Hooks            | camelCase with 'use' | -               | `useAuth.ts`      |
| tRPC Routers     | camelCase            | camelCase       | `ticketRouter`    |
| Database Tables  | -                    | PascalCase      | `Ticket`          |
| Environment Vars | SCREAMING_SNAKE      | SCREAMING_SNAKE | `DATABASE_URL`    |

## Error Handling Strategy

[Error flow diagram and implementation patterns included above]

## Monitoring and Observability

### Monitoring Stack

- Frontend: Console logs + performance API
- Backend: Pino structured logging
- Error Tracking: Local logs (Sentry-ready)
- Performance: Custom metrics

### Key Metrics

- Frontend: Core Web Vitals, API response times
- Backend: Request rate, error rate, LLM token usage
- Database: Query performance, connection pool stats

## Checklist Results Report

Architecture document complete. Ready for development team to begin implementation following T3 Stack patterns with local-first MVP approach.
