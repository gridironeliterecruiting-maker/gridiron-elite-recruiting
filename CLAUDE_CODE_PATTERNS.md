# Code Patterns & Examples for Claude Code

## Common Patterns

### 1. Supabase Client Usage

**Server-side (API routes, server components):**
```typescript
import { createClient } from '@/lib/supabase/server'

export async function GET() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  
  const { data, error } = await supabase
    .from('programs')
    .select('*')
    .eq('profile_id', user.id)
}
```

**Client-side (React components):**
```typescript
import { createClient } from '@/lib/supabase/client'

const supabase = createClient()
const { data } = await supabase.from('coaches').select('*')
```

**Admin operations (bypass RLS):**
```typescript
import { createAdminClient } from '@/lib/supabase/admin'

const admin = createAdminClient()
// Can perform operations without RLS restrictions
```

### 2. API Route Structure

```typescript
// app/src/app/api/[resource]/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function GET(request: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  
  // Your logic here
  return NextResponse.json({ data })
}
```

### 3. Protected Pages

```typescript
// Middleware handles auth, but always verify in components
const { data: { user } } = await supabase.auth.getUser()
if (!user) redirect('/login')
```

### 4. Gmail Integration

**Check Gmail connection:**
```typescript
const { data: gmailToken } = await supabase
  .from('gmail_tokens')
  .select('*')
  .eq('profile_id', user.id)
  .single()

const isConnected = gmailToken && new Date(gmailToken.expires_at) > new Date()
```

**Send email:**
```typescript
const response = await fetch('/api/email/send', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    campaignId,
    recipients: [{ email, firstName, lastName }],
  }),
})
```

### 5. Type Safety

**Database types are generated:**
```typescript
import { Database } from '@/types/supabase'

type Profile = Database['public']['Tables']['profiles']['Row']
type Coach = Database['public']['Tables']['coaches']['Row']
```

### 6. Error Handling

```typescript
try {
  const { data, error } = await supabase.from('table').select()
  if (error) throw error
  return data
} catch (error) {
  console.error('Operation failed:', error)
  // Handle appropriately
}
```

## Key Files to Understand

### Authentication
- `app/src/lib/supabase/middleware.ts` - Session management
- `app/src/app/login/page.tsx` - Login flow
- `app/src/app/auth/callback/route.ts` - OAuth callback

### Email System
- `app/src/app/api/email/send/route.ts` - Email sending endpoint
- `app/src/app/api/gmail/oauth-callback/route.ts` - Gmail OAuth
- `app/src/lib/gmail.ts` - Gmail API helpers

### Components
- `app/src/components/campaigns/` - Email campaign wizard
- `app/src/components/pipeline/` - Drag-and-drop CRM
- `app/src/components/programs/` - Program browser

### Database
- `supabase/schema.sql` - Database structure
- `app/src/types/supabase.ts` - Generated types

## Critical Security Points

### Email Sending Checks
```typescript
// NEVER remove any of these checks
// 1. System kill switch
const { data: settings } = await admin
  .from('system_settings')
  .select('value')
  .eq('key', 'email_sending_enabled')
  .single()

if (settings?.value !== 'true') {
  return NextResponse.json({ error: 'Email sending disabled' }, { status: 403 })
}

// 2. User permission
const { data: profile } = await supabase
  .from('profiles')
  .select('can_send_emails')
  .eq('id', user.id)
  .single()

if (!profile?.can_send_emails) {
  return NextResponse.json({ error: 'Email not permitted' }, { status: 403 })
}

// 3. Recipient allowlist
const { data: allowed } = await admin
  .from('email_allowlist')
  .select('email')
  .eq('email', recipientEmail)
  .single()

if (!allowed) {
  return NextResponse.json({ error: 'Recipient not allowed' }, { status: 403 })
}
```

## Common Gotchas

1. **Supabase client must be awaited in server components:**
   ```typescript
   const supabase = await createClient() // Note the await!
   ```

2. **Gmail tokens expire - always check:**
   ```typescript
   const isExpired = new Date(token.expires_at) < new Date()
   ```

3. **RLS policies apply to regular client, not admin:**
   ```typescript
   // This respects RLS
   const supabase = await createClient()
   
   // This bypasses RLS
   const admin = createAdminClient()
   ```

4. **Environment variables in Vercel need to be set for all environments**

5. **The `/app` directory is the Next.js root, not the repo root**

## Development Commands

```bash
# Install dependencies
cd app && npm install

# Run development server
npm run dev

# Build for production
npm run build

# Type check
npm run type-check

# Generate Supabase types
npm run generate-types
```

## Testing Email Locally

1. Set up `.env.local` with all required vars
2. Use your personal Gmail for testing
3. Add test recipients to `email_allowlist` table
4. Enable system-wide email sending in `system_settings`

## Debugging Tips

1. **Check Vercel logs** for API errors
2. **Browser console** for client-side errors  
3. **Supabase dashboard** for database queries
4. **Network tab** for API responses
5. **React DevTools** for component state

Remember: This is a production app with real users. Always test on staging first!