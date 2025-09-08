# Frontend Architecture

## Component Architecture

### Component Organization

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

## State Management Architecture

### State Structure

- Server state managed by TanStack Query via tRPC
- Client state managed by Zustand for UI preferences
- Form state managed by React Hook Form
- Optimistic updates for better UX
- Real-time updates via WebSocket subscriptions

## Routing Architecture

### Route Organization

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
