# Coding Standards

## Critical Fullstack Rules

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

## Naming Conventions

| Element          | Frontend             | Backend         | Example           |
| ---------------- | -------------------- | --------------- | ----------------- |
| Components       | PascalCase           | -               | `UserProfile.tsx` |
| Hooks            | camelCase with 'use' | -               | `useAuth.ts`      |
| tRPC Routers     | camelCase            | camelCase       | `ticketRouter`    |
| Database Tables  | -                    | PascalCase      | `Ticket`          |
| Environment Vars | SCREAMING_SNAKE      | SCREAMING_SNAKE | `DATABASE_URL`    |
