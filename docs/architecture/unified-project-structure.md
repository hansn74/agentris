# Unified Project Structure

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
