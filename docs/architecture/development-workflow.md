# Development Workflow

## Local Development Setup

### Prerequisites

```bash
node --version  # v20.0.0 or higher
pnpm --version  # v8.15.0 or higher
docker --version  # v24.0.0 or higher
```

### Initial Setup

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

### Development Commands

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

## Environment Configuration

### Required Environment Variables

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
