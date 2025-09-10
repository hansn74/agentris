# NextAuth Secret Not Loading Despite Being Configured

**Bug ID**: EPIC-1-004 (Updated)
**Story**: 1.3 (Core Authentication Service) and 1.6 (Basic Web UI Shell)
**Test Scenario**: 1.1.3 (Development Workflow - Dev Server)
**Severity**: Critical
**Date Reported**: 2025-09-10
**Date Updated**: 2025-09-10

## Description

The development server fails to load NEXTAUTH_SECRET even though it's properly configured in the `.env` file. This causes authentication to be completely broken with "MissingSecret" errors.

## Steps to Reproduce

1. Clone the repository
2. Set up environment (create .env with all required variables)
3. Verify `.env` contains:
   - `NEXTAUTH_URL=http://localhost:3000`
   - `NEXTAUTH_SECRET=<valid-secret>`
4. Run `pnpm dev`
5. Application shows MissingSecret error despite configuration

## Expected Result

- NextAuth should read NEXTAUTH_SECRET from .env file
- Authentication should work properly

## Actual Result

```
[auth][error] MissingSecret: Please define a `secret`.
Read more at https://errors.authjs.dev#missingsecret
```

## Root Cause Analysis

The issue is that Next.js app router and NextAuth.js are not loading the `.env` file properly. Possible causes:

1. **Next.js 15 with Auth.js v5 compatibility issue**: The app is using NextAuth beta/Auth.js which may expect `AUTH_SECRET` instead of `NEXTAUTH_SECRET`

2. **Environment variable loading in app router**: The auth configuration might be loading before dotenv processes the `.env` file

3. **Missing environment variable prefix**: Next.js requires `NEXT_PUBLIC_` prefix for client-side vars, but auth secret should be server-only

## Investigation Steps

### Check 1: Verify which env var name is expected

```bash
# Check if AUTH_SECRET works instead
grep -r "AUTH_SECRET\|NEXTAUTH_SECRET" apps/web/
```

### Check 2: Look at auth.ts configuration

The auth configuration in `apps/web/auth.ts` might not be reading the env var correctly.

### Check 3: Test with different variable names

```bash
# Try both variable names in .env:
AUTH_SECRET=your-secret-here
NEXTAUTH_SECRET=your-secret-here
```

## Proposed Fix

### Fix 1: Update auth.ts to explicitly use process.env

```typescript
// apps/web/auth.ts
import NextAuth from 'next-auth';

const authSecret = process.env.NEXTAUTH_SECRET || process.env.AUTH_SECRET;

if (!authSecret) {
  throw new Error(
    'Authentication secret not found. Please set NEXTAUTH_SECRET or AUTH_SECRET in .env file'
  );
}

export const { auth, handlers, signIn, signOut } = NextAuth({
  secret: authSecret,
  // ... rest of config
});
```

### Fix 2: Ensure .env is loaded in Next.js config

```javascript
// apps/web/next.config.js
require('dotenv').config({ path: '../../.env' });

module.exports = {
  // ... existing config
  env: {
    NEXTAUTH_SECRET: process.env.NEXTAUTH_SECRET,
    NEXTAUTH_URL: process.env.NEXTAUTH_URL,
  },
};
```

### Fix 3: Use AUTH_SECRET (Auth.js v5 convention)

Auth.js v5 (the new version) expects `AUTH_SECRET` not `NEXTAUTH_SECRET`:

```bash
# In .env file
AUTH_SECRET=your-secret-here
AUTH_URL=http://localhost:3000
```

### Fix 4: Check for conflicting env files

Ensure there's no `.env.local` or other env files overriding:

```bash
ls -la apps/web/.env*
ls -la .env*
```

## Immediate Workaround

Try these solutions in order:

1. **Add AUTH_SECRET to .env**:

```bash
# Copy your NEXTAUTH_SECRET value to AUTH_SECRET
echo "AUTH_SECRET=$(grep NEXTAUTH_SECRET .env | cut -d '=' -f2)" >> .env
```

2. **Export variables before running**:

```bash
export NEXTAUTH_SECRET="your-secret-here"
export AUTH_SECRET="your-secret-here"
pnpm dev
```

3. **Create .env.local in apps/web**:

```bash
cd apps/web
echo "NEXTAUTH_SECRET=your-secret-here" > .env.local
echo "AUTH_SECRET=your-secret-here" >> .env.local
cd ../..
pnpm dev
```

## Environment

- OS: macOS
- Next.js: 15.5.2
- Auth.js/NextAuth: 0.40.0 (beta/v5)
- Issue: Environment variables not loading from .env

## Impact

- **Critical**: Application is completely unusable
- Environment variable loading is broken
- Affects all developers even with proper configuration

## Related Files

- `apps/web/auth.ts` - Auth configuration not reading env vars
- `apps/web/next.config.js` - May need env loading configuration
- `.env` - Contains correct variables but not being read
- Root `package.json` - May need dotenv configuration

## Key Finding

**The .env file has the correct variables but they're not being loaded by the Next.js application.** This is a configuration/build issue, not a missing variable issue.

## Testing Notes

User confirmed:

- ✅ `.env` file exists with NEXTAUTH_URL and NEXTAUTH_SECRET
- ❌ Application still shows MissingSecret error
- This indicates environment loading issue, not missing configuration

## Recommendations

1. **Check Auth.js v5 requirements** (AUTH_SECRET vs NEXTAUTH_SECRET)
2. **Fix environment variable loading** in Next.js 15 app router
3. **Add diagnostic logging** to show which env vars are loaded
4. **Update documentation** to clarify which variable names to use
5. **Add validation on startup** with helpful error messages

## Priority

**Critical** - Application is non-functional even with correct configuration

---

_Reported during QA testing of Epic 1 stories_
_Updated after user confirmation that env vars exist but aren't loading_
