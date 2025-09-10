# Test Suite Failures - Environment Validation and UI Tests

**Bug ID**: EPIC-1-003
**Story**: 1.5 (Jira Integration Service) and 1.6 (Basic Web UI Shell)
**Test Scenario**: 1.1.1 (Development Environment Setup - Test Execution)
**Severity**: High
**Date Reported**: 2025-09-10

## Description

The `pnpm test` command fails with two distinct issues:

1. API tests fail due to missing environment variables required for Jira integration
2. Web UI test fails due to a pagination button assertion issue

## Steps to Reproduce

1. Clone the repository
2. Set up environment (create .env, generate Prisma Client)
3. Run `pnpm test`
4. Tests fail in @agentris/api and web packages

## Expected Result

All tests should pass successfully.

## Actual Result

### Issue 1: API Test Failure (Story 1.5)

```
@agentris/api:test: Environment validation failed:
  - JIRA_CLIENT_ID: Required
  - JIRA_CLIENT_SECRET: Required
  - ENCRYPTION_KEY: Required
```

Location: `packages/api/src/routers/jira.ts:15:13`

### Issue 2: Web Test Failure (Story 1.6)

```
web:test: × TicketList > handles pagination 43ms
  → expect(element).not.toBeDisabled()
  Received element is disabled
```

Location: `apps/web/components/ticket/TicketList.test.tsx`

## Root Cause Analysis

### API Test Issue

The Jira router requires environment variables at import time:

- `JIRA_CLIENT_ID`
- `JIRA_CLIENT_SECRET`
- `ENCRYPTION_KEY`

These are validated immediately when the module loads, even during testing. The test environment doesn't provide these variables.

### Web Test Issue

The pagination test expects the "Next" button to be enabled, but it's disabled. This could be due to:

- Incorrect mock data setup
- Wrong page state initialization
- Test logic error

## Proposed Fix

### Fix 1: API Tests - Mock Environment Variables

**Option A**: Update test setup files

```typescript
// packages/api/vitest.setup.ts or similar
process.env.JIRA_CLIENT_ID = 'test-client-id';
process.env.JIRA_CLIENT_SECRET = 'test-client-secret';
process.env.ENCRYPTION_KEY = 'test-encryption-key-32-chars-long';
```

**Option B**: Conditional validation

```typescript
// packages/api/src/routers/jira.ts
const isTestEnvironment = process.env.NODE_ENV === 'test';

const envConfig = isTestEnvironment
  ? {
      JIRA_CLIENT_ID: 'test-id',
      JIRA_CLIENT_SECRET: 'test-secret',
      ENCRYPTION_KEY: 'test-key',
    }
  : getEnvConfig(); // Real validation
```

**Option C**: Mock the env-validation module in tests

```typescript
// packages/api/src/__tests__/setup.ts
vi.mock('@agentris/shared/utils/env-validation', () => ({
  getEnvConfig: () => ({
    JIRA_CLIENT_ID: 'test-id',
    JIRA_CLIENT_SECRET: 'test-secret',
    ENCRYPTION_KEY: 'test-key',
  }),
}));
```

### Fix 2: Web Test - Fix Pagination Test

```typescript
// apps/web/components/ticket/TicketList.test.tsx
test('handles pagination', async () => {
  // Ensure there are enough items for pagination
  const manyTickets = Array.from({ length: 15 }, (_, i) => ({
    id: `${i + 1}`,
    key: `TEST-${i + 1}`,
    summary: `Test ticket ${i + 1}`,
    status: 'Open',
    assignee: 'Test User'
  }));

  render(<TicketList tickets={manyTickets} />);

  // Wait for pagination to be ready
  await waitFor(() => {
    const nextButton = screen.getByRole('button', { name: /next/i });
    expect(nextButton).not.toBeDisabled();
  });
});
```

## Immediate Workaround

For testing purposes, developers can:

1. **For API tests**: Add required env vars to `.env`:

```bash
JIRA_CLIENT_ID=test-client-id
JIRA_CLIENT_SECRET=test-client-secret
ENCRYPTION_KEY=test-encryption-key-32-chars-long
```

2. **For Web tests**: Skip the failing test temporarily:

```typescript
test.skip('handles pagination', async () => {
  // Test implementation
});
```

## Environment

- OS: macOS
- Node Version: As per project requirements
- Test Runner: Vitest
- Failed packages: @agentris/api, web

## Impact

- Blocks CI/CD pipeline (tests must pass for deployment)
- Prevents validation of Jira integration functionality
- Reduces confidence in UI component behavior
- New developers see failing tests on fresh setup

## Related Files

- `packages/api/src/routers/jira.ts` - Requires env vars at import
- `packages/shared/src/utils/env-validation.ts` - Validation logic
- `apps/web/components/ticket/TicketList.test.tsx` - Failing UI test
- `.env.example` - Missing test-related env var documentation

## Test Results Summary

- @agentris/shared: ✅ 4/4 tests passed
- @agentris/auth: ✅ 4/4 tests passed
- @agentris/api: ❌ Failed due to env validation
- web: ❌ 1 failed, 17 passed (pagination test)

## Testing Notes

After fix is applied, verify:

1. All tests pass without real credentials
2. Test environment doesn't require production secrets
3. CI/CD pipeline can run tests without manual setup
4. Mock data is sufficient for all test scenarios

## Recommendations

1. **Separate test configuration** from production configuration
2. **Document test requirements** clearly in README
3. **Add test:ci script** that sets up test environment
4. **Consider using .env.test** for test-specific variables

## Priority

**High** - Blocks CI/CD and affects developer experience, but workarounds exist

---

_Reported during QA testing of Epic 1 stories_
