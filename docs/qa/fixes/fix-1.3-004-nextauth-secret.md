# Fix: NextAuth Secret Loading Issue

**Bug ID**: EPIC-1-004
**Stories**: 1.3, 1.6
**Date Fixed**: 2025-09-10
**Fixed By**: James (Dev Agent)

## Problem

Auth.js v5 (next-auth 5.0.0-beta) was not loading environment variables from the .env file, causing MissingSecret errors even when NEXTAUTH_SECRET was properly configured.

## Root Cause

1. Auth.js v5 expects `AUTH_SECRET` instead of `NEXTAUTH_SECRET`
2. Next.js wasn't loading the root .env file automatically
3. The auth configuration wasn't explicitly setting the secret

## Solution Implemented

### 1. Updated auth.ts

- Added explicit secret configuration that supports both AUTH_SECRET and NEXTAUTH_SECRET
- Added trustHost: true for proper URL handling
- Added error message for missing secrets in production

### 2. Updated next.config.js

- Added dotenv configuration to load root .env file
- Mapped NEXTAUTH variables to AUTH variables for compatibility
- Ensures environment variables are available during build and runtime

### 3. Updated .env files

- Added AUTH_SECRET and AUTH_URL variables
- Maintains backward compatibility with NEXTAUTH\_\* variables
- Updated .env.example with both sets of variables

## Files Modified

- `/apps/web/auth.ts` - Added explicit secret handling
- `/apps/web/next.config.js` - Added dotenv loading and env mapping
- `/.env` - Added AUTH_SECRET and AUTH_URL
- `/.env.example` - Added Auth.js v5 variables
- `/package.json` - Added dotenv as dev dependency

## Testing

✅ Dev server starts without MissingSecret error
✅ Auth providers endpoint responds correctly
✅ Both AUTH_SECRET and NEXTAUTH_SECRET are supported

## Migration Guide

For existing developers:

1. Pull latest changes
2. Run `pnpm install` to get dotenv dependency
3. Add to your .env file:
   ```
   AUTH_SECRET=your-secret-here
   AUTH_URL=http://localhost:3000
   ```
4. Restart dev server with `pnpm dev`

## Prevention

- Always check Auth.js/NextAuth version for correct env variable names
- Include environment loading in Next.js config
- Provide clear error messages for missing configuration
