# Preview Environment Redirect Fix

## Problem
Preview deployments on Vercel redirect to production (gridironeliterecruiting.com) after login, making them unusable for testing changes before production deployment.

## Root Cause
The application has `NEXT_PUBLIC_APP_URL` hardcoded to `https://gridironeliterecruiting.com` in multiple places:

1. `.env.local` has: `NEXT_PUBLIC_APP_URL=https://gridironeliterecruiting.com`
2. Code fallbacks to production URL when env var is missing:
   - `app/src/app/api/gmail/oauth-callback/route.ts`
   - `app/src/app/auth/callback/route.ts`
   - `app/src/lib/gmail.ts`

## Solution

### Option 1: Dynamic URL Detection (Recommended)
Instead of hardcoding URLs, detect the current deployment URL dynamically:

```typescript
// Use this helper function throughout the app
export function getAppUrl() {
  // In browser
  if (typeof window !== 'undefined') {
    return window.location.origin
  }
  
  // On server - Vercel provides these
  if (process.env.VERCEL_URL) {
    return `https://${process.env.VERCEL_URL}`
  }
  
  // Fallback to configured URL or production
  return process.env.NEXT_PUBLIC_APP_URL || 'https://gridironeliterecruiting.com'
}
```

### Option 2: Vercel Environment Variable Configuration
1. Remove `NEXT_PUBLIC_APP_URL` from `.env.local`
2. In Vercel project settings:
   - Production: Set `NEXT_PUBLIC_APP_URL=https://gridironeliterecruiting.com`
   - Preview: Leave it unset (will use VERCEL_URL)
   - Development: Leave it unset

### Option 3: Use Relative URLs
For auth callbacks and internal redirects, use relative URLs like `/dashboard` instead of absolute URLs.

## Files to Update

1. **app/src/lib/app-url.ts** (new file)
   - Create the `getAppUrl()` helper

2. **app/src/app/api/gmail/oauth-callback/route.ts**
   - Replace: `const finalUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://gridironeliterecruiting.com'`
   - With: `const finalUrl = getAppUrl()`

3. **app/src/app/auth/callback/route.ts**
   - Replace hardcoded URL with `getAppUrl()`

4. **app/src/lib/gmail.ts**
   - Replace all instances of hardcoded URLs with `getAppUrl()`

5. **.env.local**
   - Remove or comment out `NEXT_PUBLIC_APP_URL` line

## Testing
1. Deploy to preview
2. Login flow should stay on preview URL (e.g., app-nx0ikb4jw-paul-kongshaugs-projects.vercel.app)
3. All OAuth callbacks should return to the preview environment
4. Production deployment should still work with gridironeliterecruiting.com

## Long-term Benefits
- Preview environments will be fully functional
- No more blind deployments to production
- Easier to test features before release
- Works with any Vercel preview URL automatically