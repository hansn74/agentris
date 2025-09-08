# API Specification

## tRPC Router Definitions

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
