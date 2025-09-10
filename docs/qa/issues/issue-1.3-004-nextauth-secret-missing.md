# NextAuth Secret Configuration Missing

**Bug ID**: EPIC-1-004
**Story**: 1.3 (Core Authentication Service) and 1.6 (Basic Web UI Shell)
**Test Scenario**: 1.1.3 (Development Workflow - Dev Server)
**Severity**: Critical
**Date Reported**: 2025-09-10

## Description

The development server starts but authentication is completely broken due to missing NEXTAUTH_SECRET configuration. The application shows error in browser and cannot handle any authentication operations.

## Steps to Reproduce

1. Clone the repository
2. Set up environment (create .env, generate Prisma Client, etc.)
3. Run `pnpm dev`
4. Navigate to http://localhost:3000
5. Application redirects to /dashboard but shows authentication errors

## Expected Result

- Development server starts cleanly
- Authentication works with configured NextAuth
- Dashboard loads for authenticated users
- Login page shows for unauthenticated users

## Actual Result

### Server Console Errors

```
[auth][error] MissingSecret: Please define a `secret`.
Read more at https://errors.authjs.dev#missingsecret
GET /api/auth/session 500 in 620ms
```

### Browser Error

```
ClientFetchError: There was a problem with the server configuration.
Check the server logs for more information.
```

### Additional Warnings

- Unsupported metadata viewport/themeColor configuration warnings
- Authentication middleware fails on every request

## Root Cause Analysis

The NextAuth.js configuration is missing the required `secret` configuration. This appears to be happening in multiple places:

1. **Middleware** (`apps/web/middleware.ts`): Auth middleware fails due to missing secret
2. **API Route** (`apps/web/app/api/auth/[...nextauth]/route.ts`): Session endpoint returns 500
3. **Auth Configuration** (`apps/web/auth.ts`): Missing secret in NextAuth config

The application is using NextAuth.js v5 (Auth.js) which requires:

- `AUTH_SECRET` or `NEXTAUTH_SECRET` environment variable
- Or explicit `secret` in the configuration

## Proposed Fix

### Fix 1: Add NEXTAUTH_SECRET to .env.example

Update `.env.example` to include:

```bash
# Authentication (REQUIRED - generate with: openssl rand -base64 32)
NEXTAUTH_SECRET=your-secret-key-here-min-32-chars
NEXTAUTH_URL=http://localhost:3000
```

### Fix 2: Update auth.ts configuration

```typescript
// apps/web/auth.ts
import NextAuth from 'next-auth';

if (!process.env.NEXTAUTH_SECRET && process.env.NODE_ENV === 'development') {
  console.warn('⚠️  NEXTAUTH_SECRET not set. Using default for development only.');
  process.env.NEXTAUTH_SECRET = 'development-secret-change-in-production';
}

export const { auth, handlers, signIn, signOut } = NextAuth({
  secret: process.env.NEXTAUTH_SECRET,
  // ... rest of config
});
```

### Fix 3: Add setup validation script

Create `scripts/check-env.js`:

```javascript
const required = ['DATABASE_URL', 'NEXTAUTH_SECRET', 'NEXTAUTH_URL'];
const missing = required.filter((key) => !process.env[key]);

if (missing.length > 0) {
  console.error('❌ Missing required environment variables:');
  missing.forEach((key) => {
    console.error(`   - ${key}`);
    if (key === 'NEXTAUTH_SECRET') {
      console.log('     Generate with: openssl rand -base64 32');
    }
  });
  process.exit(1);
}
```

### Fix 4: Update viewport/themeColor configuration

```typescript
// apps/web/app/(dashboard)/layout.tsx
// Move viewport and themeColor to separate export
export const viewport = {
  width: 'device-width',
  initialScale: 1,
  themeColor: '#000000',
};

export const metadata = {
  title: 'Dashboard',
  description: 'Agentris Dashboard',
  // Remove viewport and themeColor from here
};
```

## Immediate Workaround

Users can add to their `.env` file:

```bash
# Generate a proper secret
openssl rand -base64 32
# Copy the output and add to .env:
NEXTAUTH_SECRET=<paste-generated-secret-here>
NEXTAUTH_URL=http://localhost:3000

# Restart the dev server
pnpm dev
```

## Environment

- OS: macOS
- Next.js: 15.5.2
- NextAuth/Auth.js: 0.40.0
- Missing env var: NEXTAUTH_SECRET

## Impact

- **Critical**: Application is completely unusable without authentication
- Blocks all testing of authenticated features
- Prevents development of any protected functionality
- Poor developer experience on first setup

## Related Files

- `apps/web/auth.ts` - NextAuth configuration missing secret
- `apps/web/middleware.ts` - Middleware fails without secret
- `apps/web/app/api/auth/[...nextauth]/route.ts` - API route configuration
- `apps/web/app/(dashboard)/layout.tsx` - Metadata configuration issues
- `.env.example` - Missing NEXTAUTH_SECRET documentation

## Testing Notes

After fix is applied, verify:

1. Dev server starts without authentication errors
2. `/api/auth/session` returns 200 OK
3. Login/logout flow works correctly
4. Protected routes are accessible when authenticated
5. Metadata warnings are resolved

## Additional Issues Found

1. Metadata configuration using deprecated format (viewport, themeColor)
2. Warning about default encryption key (less critical, for production)

## Recommendations

1. **Add pre-flight check** before starting dev server
2. **Generate NEXTAUTH_SECRET automatically** on first setup
3. **Update .env.example** with all required variables
4. **Add setup wizard** for initial configuration
5. **Fix metadata exports** to use Next.js 15 format

## Priority

**Critical** - Application is completely non-functional without this fix

## Related Documentation

- [NextAuth.js Configuration](https://next-auth.js.org/configuration/options#secret)
- [Auth.js Errors](https://errors.authjs.dev#missingsecret)
- [Next.js 15 Metadata](https://nextjs.org/docs/app/api-reference/functions/generate-viewport)

---

_Reported during QA testing of Epic 1 stories_
