const { createClient } = require('@supabase/supabase-js')
require('dotenv').config({ path: '.env.local' })

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY
const GOOGLE_CLIENT_ID = process.env.GOOGLE_CLIENT_ID
const GOOGLE_CLIENT_SECRET = process.env.GOOGLE_CLIENT_SECRET

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)

async function testTokenRefresh() {
  // Get the user and token
  const { data: { users } } = await supabase.auth.admin.listUsers()
  const user = users?.find(u => u.email === 'gridironeliterecruiting@gmail.com')
  
  if (!user) {
    console.log('User not found')
    return
  }
  
  const { data: gmailToken } = await supabase
    .from('gmail_tokens')
    .select('*')
    .eq('user_id', user.id)
    .single()
  
  console.log('Current token info:')
  console.log(`- Token expires: ${new Date(gmailToken.token_expiry).toLocaleString()}`)
  console.log(`- Has refresh token: ${!!gmailToken.refresh_token}`)
  
  if (!gmailToken.refresh_token) {
    console.log('No refresh token available!')
    return
  }
  
  console.log('\nAttempting to refresh token...')
  
  try {
    const res = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        client_id: GOOGLE_CLIENT_ID,
        client_secret: GOOGLE_CLIENT_SECRET,
        refresh_token: gmailToken.refresh_token,
        grant_type: 'refresh_token',
      }),
    })
    
    if (!res.ok) {
      const error = await res.text()
      console.error('Failed to refresh token:', error)
      return
    }
    
    const tokens = await res.json()
    console.log('\n✅ Token refreshed successfully!')
    console.log(`- New access token received: ${tokens.access_token ? 'YES' : 'NO'}`)
    console.log(`- Expires in: ${tokens.expires_in} seconds`)
    
    // Update the token in the database
    const newExpiry = new Date(Date.now() + tokens.expires_in * 1000)
    const { error: updateError } = await supabase
      .from('gmail_tokens')
      .update({
        access_token: tokens.access_token,
        token_expiry: newExpiry.toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq('user_id', user.id)
    
    if (updateError) {
      console.error('Failed to update token in database:', updateError)
    } else {
      console.log(`\n✅ Token updated in database!`)
      console.log(`- New expiry: ${newExpiry.toLocaleString()}`)
    }
  } catch (error) {
    console.error('Error refreshing token:', error)
  }
}

testTokenRefresh().catch(console.error)