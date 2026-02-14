# Double Google Login Bug — Research & Fix

**Date:** 2026-02-14
**Status:** Fix deployed, needs user testing

## Root Cause Found

**The middleware's `getUser()` call deletes the PKCE `code_verifier` cookie before the callback route handler can use it.**

### Detailed Flow (Before Fix)

1. User clicks "Sign in with Google"
2. `createBrowserClient` stores `code_verifier` in cookie `sb-<ref>-auth-token-code-verifier`
3. Browser → Google → Supabase → `/auth/callback?code=...`
4. **Middleware runs FIRST** on `/auth/callback`:
   - Creates Supabase client, calls `getUser()`
   - `getUser()` → `_useSession()` → `_getSession()` finds **stale session cookies** from previous login
   - Tries to refresh session → refresh fails (token expired/invalid)
   - Throws `AuthSessionMissingError`
   - **Catch block executes: `removeItemAsync(storage, 'sb-<ref>-auth-token-code-verifier')`**
   - Code verifier cookie is **deleted**
5. Route handler tries `exchangeCodeForSession(code)` → no code_verifier → **fails**
6. Redirects to `/login`

### Why Second Attempt Works

On the second attempt:
- Step 4's first run already **cleared the stale session cookies**
- Now `getUser()` → `_getSession()` finds NO cookies → returns `{ session: null, error: null }`
- `_getUser` returns the error (doesn't throw), so the catch block **never fires**
- Code verifier cookie **survives**
- `exchangeCodeForSession` succeeds

### Evidence

From `@supabase/auth-js` source (`GoTrueClient.js`, `_getUser` method):
```js
catch (error) {
    if (isAuthError(error)) {
        if (isAuthSessionMissingError(error)) {
            await this._removeSession();
            await removeItemAsync(this.storage, `${this.storageKey}-code-verifier`);
            //    ^^^ THIS DELETES THE CODE VERIFIER
        }
        return this._returnResult({ data: { user: null }, error });
    }
    throw error;
}
```

## Fix Applied

**File:** `src/lib/supabase/middleware.ts`

Skip `getUser()` for `/auth/callback` route. This route is already in the public routes list and doesn't need auth checking. The route handler handles its own auth via `exchangeCodeForSession`.

```typescript
const isAuthCallback = request.nextUrl.pathname.startsWith('/auth/callback')
let user = null
if (!isAuthCallback) {
  const { data: { user: sessionUser } } = await supabase.auth.getUser()
  user = sessionUser
}
```

**Commit:** `ce379e6` — deployed to production

## Other Known Causes (from research)

### 1. Redirect URL Mismatch
- **Cause:** Supabase redirect URLs don't include the custom domain
- **Diagnosis:** Check Supabase → Authentication → URL Configuration
- **Status:** Should already be configured correctly for gridironeliterecruiting.com
- **Needs Paul:** Verify in Supabase dashboard that `https://gridironeliterecruiting.com/auth/callback` is in redirect allowlist

### 2. NEXT_PUBLIC_APP_URL Mismatch
- **Cause:** Environment variable doesn't match actual domain
- **Diagnosis:** Check Vercel env vars
- **Status:** Code uses `process.env.NEXT_PUBLIC_APP_URL || window.location.origin` (client) and `|| 'https://gridironeliterecruiting.com'` (server) — should be fine
- **Needs Paul:** Verify `NEXT_PUBLIC_APP_URL` is set correctly in Vercel dashboard

### 3. Cookie SameSite/Secure Issues
- **Cause:** Cookies not sent on cross-site redirects
- **Diagnosis:** Check cookie attributes in browser DevTools
- **Status:** `@supabase/ssr` sets `SameSite=Lax` by default, which works for top-level navigations
- **Needs Paul:** If issue persists, check cookies in DevTools Network tab

### 4. Supabase Site URL Configuration
- **Cause:** Supabase project's "Site URL" setting doesn't match production domain
- **Diagnosis:** Supabase Dashboard → Authentication → URL Configuration → Site URL
- **Status:** Unknown
- **Needs Paul:** Verify Site URL is `https://gridironeliterecruiting.com`

## Testing

Paul should:
1. Clear all cookies for gridironeliterecruiting.com
2. Try signing in with Google — should work on FIRST attempt now
3. Sign out
4. Try signing in again — should still work on first attempt
5. Wait a day (let session expire), try again — this was the scenario that triggered the bug
