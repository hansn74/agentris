# Auth Configuration Missing Secret Parameter

**Bug ID**: EPIC-1-005
**Story**: 1.6 (Basic Web UI Shell)
**Test Scenario**: 1.1.3 (Development Workflow - Dev Server)
**Severity**: Critical
**Date Reported**: 2025-09-10

## Description

The NextAuth configuration in `apps/web/auth.ts` is missing the `secret` parameter. Even though NEXTAUTH_SECRET is defined in the `.env` file, it's not being passed to the NextAuth configuration object.

## Steps to Reproduce

1. Set up environment with proper .env file containing NEXTAUTH_SECRET
2. Run `pnpm dev`
3. Authentication fails with MissingSecret error

## Expected Result

NextAuth should use the NEXTAUTH_SECRET from environment variables.

## Actual Result

```
[auth][error] MissingSecret: Please define a `secret`
```

## Root Cause

The file `apps/web/auth.ts` at line 11 initializes NextAuth without passing the secret:

```typescript
export const { handlers, signIn, signOut, auth } = NextAuth({
  providers: [...],
  pages: {...},
  callbacks: {...},
  // MISSING: secret: process.env.AUTH_SECRET or process.env.NEXTAUTH_SECRET
});
```

## Confirmed Code Issue

**File**: `apps/web/auth.ts`
**Line**: 11-67
**Problem**: No `secret` property in the NextAuth configuration object

## Proposed Fix

### Immediate Fix

Update `apps/web/auth.ts`:

```typescript
import NextAuth from 'next-auth';
import Credentials from 'next-auth/providers/credentials';
import { z } from 'zod';
import { api } from './trpc/server';

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(6),
});

export const { handlers, signIn, signOut, auth } = NextAuth({
  secret: process.env.AUTH_SECRET || process.env.NEXTAUTH_SECRET, // ADD THIS LINE
  providers: [
    Credentials({
      // ... existing credentials provider
    }),
  ],
  pages: {
    signIn: '/login',
  },
  callbacks: {
    // ... existing callbacks
  },
});
```

## Immediate Workaround for Testing

Since you can't edit the file in your test environment, there's no workaround. This is a code bug that requires fixing the auth.ts file.

## Environment

- File: `apps/web/auth.ts`
- Missing: `secret` configuration parameter
- Next.js: 15.5.2
- NextAuth/Auth.js: 0.40.0

## Impact

- **Critical**: Authentication is completely broken
- No workaround possible without code change
- Blocks all authenticated functionality

## Related Files

- `apps/web/auth.ts` - Missing secret configuration (lines 11-67)
- `.env` - Contains NEXTAUTH_SECRET but it's not used

## Testing Notes

- User's `.env` file correctly contains NEXTAUTH_SECRET
- The environment variable exists but isn't referenced in code
- This is a code bug, not a configuration issue

## Developer Action Required

Add the following line after line 11 in `apps/web/auth.ts`:

```typescript
secret: process.env.AUTH_SECRET || process.env.NEXTAUTH_SECRET,
```

## Additional Note

The code shows this is from Story 1.6 implementation where the auth integration was added, but the secret configuration was overlooked. This is not an environment issue but a coding error.

## Priority

**Critical** - Blocks all development and testing. No workaround available.

---

_Reported during QA testing of Epic 1 stories_
