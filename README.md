# Agentris

[![CI](https://github.com/YOUR_ORG/agentris/actions/workflows/ci.yml/badge.svg)](https://github.com/YOUR_ORG/agentris/actions/workflows/ci.yml)
[![Test Coverage](https://img.shields.io/badge/coverage-report-brightgreen)](https://github.com/YOUR_ORG/agentris/actions)
[![Docker Image](https://ghcr.io/YOUR_ORG/agentris/badge.svg)](https://github.com/YOUR_ORG/agentris/pkgs/container/agentris)

AI-powered Salesforce development platform that streamlines ticket processing, validation, and deployment workflows.

## 🚀 Quick Start

Get Agentris up and running in under 5 minutes:

```bash
# Clone the repository
git clone <repository-url>
cd agentris

# Install dependencies
pnpm install

# Set up environment
cp .env.example .env

# Start infrastructure (Docker required)
pnpm docker:up

# Initialize database
pnpm db:push

# Start development server
pnpm dev
```

Visit **http://localhost:3000** to access the application.

## Architecture Overview

Agentris is built as a modular monorepo using modern web technologies:

- **Frontend**: Next.js 14 with React Server Components
- **Backend**: tRPC for type-safe APIs
- **Database**: PostgreSQL with Prisma ORM
- **Cache**: Redis for session and data caching
- **AI Engine**: LLM orchestration for intelligent automation
- **Integrations**: Salesforce, Jira, and GitHub connectors

## Prerequisites

### Required Software

- **Node.js** v20.0.0 or higher ([Download](https://nodejs.org/))
- **pnpm** v10.15.0 or higher ([Installation](https://pnpm.io/installation))
- **Docker Desktop** v24.0.0 or higher ([Download](https://www.docker.com/products/docker-desktop))
- **Git** ([Download](https://git-scm.com/))

### System Requirements

- **Operating System**: macOS, Linux, or Windows (with WSL2)
- **Memory**: Minimum 8GB RAM (16GB recommended)
- **Storage**: At least 2GB free space
- **Ports**: Ensure the following ports are available:
  - 3000 (Next.js application)
  - 5432 (PostgreSQL database)
  - 6379 (Redis cache)

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

## 📦 Installation Guide

### Step 1: Clone the Repository

```bash
git clone <repository-url>
cd agentris
```

### Step 2: Install Dependencies

```bash
# Install pnpm if not already installed
npm install -g pnpm

# Install project dependencies
pnpm install
```

### Step 3: Environment Configuration

Create your environment file from the template:

```bash
cp .env.example .env
```

#### Required Environment Variables

Edit `.env` and configure the following:

```env
# Database (default values for local development)
DATABASE_URL=postgresql://postgres:password@localhost:5432/agentris

# Redis (default values for local development)
REDIS_URL=redis://localhost:6379

# Authentication (required)
NEXTAUTH_URL=http://localhost:3000
NEXTAUTH_SECRET=<generate-random-32-char-string>

# Optional: External Integrations
JIRA_CLIENT_ID=<your-jira-client-id>
JIRA_CLIENT_SECRET=<your-jira-client-secret>
JIRA_REDIRECT_URI=http://localhost:3000/api/auth/jira/callback

# Future integrations (optional)
ANTHROPIC_API_KEY=<your-anthropic-api-key>
SF_CLIENT_ID=<your-salesforce-client-id>
SF_CLIENT_SECRET=<your-salesforce-client-secret>
```

💡 **Tip**: Generate a secure `NEXTAUTH_SECRET` using:

```bash
openssl rand -base64 32
```

### Step 4: Start Infrastructure Services

Ensure Docker Desktop is running, then start the required services:

```bash
# Start PostgreSQL and Redis containers
pnpm docker:up

# Verify services are running
pnpm docker:logs

# To stop services later
pnpm docker:down
```

### Step 5: Initialize Database

Set up the database schema:

```bash
# Push Prisma schema to database
pnpm db:push

# Generate Prisma client
pnpm db:generate
```

### Step 6: Start Development Server

```bash
# Start all services in development mode
pnpm dev

# Or start specific services:
pnpm dev:web    # Frontend only
pnpm dev:api    # Backend only
```

## 🌐 Accessing the Application

Once running, access Agentris at:

- **Web Application**: http://localhost:3000
- **API Endpoints**: http://localhost:3000/api/trpc

### Default Ports

- **3000**: Next.js application
- **5432**: PostgreSQL database
- **6379**: Redis cache

## 🧪 Testing the Application

### Run Tests

```bash
# Run all tests
pnpm test

# Run tests in watch mode
pnpm test:watch

# Run tests with coverage
pnpm test:coverage
```

### Type Checking

```bash
# Check TypeScript types
pnpm typecheck
```

### Linting

```bash
# Run ESLint
pnpm lint

# Auto-fix linting issues
pnpm lint:fix
```

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

## 🔧 Troubleshooting

### Common Issues and Solutions

#### Docker Desktop Not Running

**Problem**: `Cannot connect to the Docker daemon`

**Solution**:

1. Start Docker Desktop application
2. Wait for Docker to fully initialize (icon shows "Docker Desktop is running")
3. Retry `pnpm docker:up`

#### Port Already in Use

**Problem**: `bind: address already in use`

**Solutions**:

```bash
# Find and kill process using port 3000
lsof -ti:3000 | xargs kill -9

# Find and kill process using port 5432 (PostgreSQL)
lsof -ti:5432 | xargs kill -9

# Or modify ports in docker-compose.yml and .env
```

#### pnpm Installation Fails

**Problem**: `pnpm: command not found` or installation errors

**Solutions**:

```bash
# Install pnpm globally
npm install -g pnpm

# Or use corepack (built into Node.js 16+)
corepack enable
corepack prepare pnpm@latest --activate

# Clear pnpm cache if needed
pnpm store prune
```

#### Database Connection Failed

**Problem**: `Can't reach database server` or connection timeout

**Solutions**:

1. Ensure Docker containers are running:
   ```bash
   docker ps  # Should show postgres and redis containers
   ```
2. Check container logs:
   ```bash
   pnpm docker:logs
   ```
3. Verify DATABASE_URL in `.env`:
   ```env
   DATABASE_URL=postgresql://postgres:password@localhost:5432/agentris
   ```
4. Restart containers:
   ```bash
   pnpm docker:down
   pnpm docker:up
   ```

#### TypeScript Build Errors

**Problem**: Build fails with TypeScript errors

**Current Known Issues**:

- Jira integration has type errors (non-blocking for development)

**Solutions**:

```bash
# Run in development mode (bypasses TypeScript errors)
pnpm dev

# To see all TypeScript errors
pnpm typecheck

# To fix specific package
cd packages/integrations
pnpm typecheck
```

#### Node Version Mismatch

**Problem**: `The engine "node" is incompatible`

**Solution**:

```bash
# Check your Node version
node --version  # Should be v20.0.0 or higher

# Install correct version using nvm
nvm install 20
nvm use 20

# Or using fnm
fnm install 20
fnm use 20
```

#### Missing Environment Variables

**Problem**: Application errors about missing configuration

**Solution**:

1. Ensure `.env` file exists:
   ```bash
   cp .env.example .env
   ```
2. Add required NEXTAUTH_SECRET:
   ```bash
   echo "NEXTAUTH_SECRET=$(openssl rand -base64 32)" >> .env
   ```

#### Permission Denied Errors

**Problem**: Permission denied when running commands

**Solutions**:

```bash
# Fix node_modules permissions
sudo chown -R $(whoami) node_modules

# Clear and reinstall
rm -rf node_modules pnpm-lock.yaml
pnpm install
```

### Getting Help

If you encounter issues not covered here:

1. Check existing [GitHub Issues](https://github.com/YOUR_ORG/agentris/issues)
2. Review the [documentation](./docs/)
3. Create a new issue with:
   - Error message
   - Steps to reproduce
   - System information (`node --version`, `pnpm --version`, OS)

## 🏗️ Development Workflow

### Making Changes

1. **Create a feature branch**:

   ```bash
   git checkout -b feature/your-feature-name
   ```

2. **Make your changes** following the coding standards

3. **Test your changes**:

   ```bash
   pnpm test
   pnpm typecheck
   pnpm lint
   ```

4. **Commit using conventional commits**:
   ```bash
   git commit -m "feat: add new feature"
   # or
   git commit -m "fix: resolve issue with..."
   ```

### Building for Production

```bash
# Build all packages
pnpm build

# Run production checks
pnpm typecheck && pnpm test

# Start production server
pnpm start
```

## 🛠️ Technology Stack

### Frontend

- **Framework**: Next.js 14.1.x with App Router
- **Language**: TypeScript 5.3.x
- **UI Library**: React 18.x
- **Styling**: Tailwind CSS with shadcn/ui components
- **State Management**: React Context + tRPC

### Backend

- **API Layer**: tRPC 10.45.x for type-safe APIs
- **Database ORM**: Prisma 5.8.x
- **Database**: PostgreSQL 16.x
- **Cache**: Redis 7.2.x
- **Authentication**: NextAuth.js 4.24.x with JWT

### Infrastructure

- **Build System**: Turborepo 2.5.x
- **Package Manager**: pnpm 10.15.x
- **Container**: Docker & Docker Compose
- **Testing**: Vitest 1.2.x
- **Code Quality**: ESLint, Prettier, Husky

### Integrations

- **Jira**: OAuth 2.0 integration for ticket management
- **Salesforce**: (Coming soon) API integration
- **AI Engine**: (Coming soon) LLM orchestration

## 📚 Documentation

- [Architecture Overview](./docs/architecture/)
- [API Documentation](./docs/api/)
- [Development Guide](./docs/development/)
- [Testing Strategy](./docs/testing/)

## 🤝 Contributing

We welcome contributions! Please follow these guidelines:

1. **Code Style**: Follow the existing patterns and conventions
2. **Commits**: Use [Conventional Commits](https://www.conventionalcommits.org/)
3. **Testing**: Write tests for new features
4. **Documentation**: Update docs for significant changes
5. **Pull Requests**: Provide clear descriptions of changes

### Commit Message Format

```
type(scope): description

[optional body]

[optional footer]
```

Types: `feat`, `fix`, `docs`, `style`, `refactor`, `test`, `chore`

## 📄 License

[License information to be added]

## 🙏 Acknowledgments

Built with modern open-source technologies. Special thanks to all contributors and the open-source community.

---

**Need help?** Create an [issue](https://github.com/YOUR_ORG/agentris/issues) or check the [documentation](./docs/).
