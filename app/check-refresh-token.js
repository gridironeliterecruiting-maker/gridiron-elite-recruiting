const { createClient } = require('@supabase/supabase-js')
require('dotenv').config({ path: '.env.local' })

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)

async function checkRefreshToken() {
  const { data: { users } } = await supabase.auth.admin.listUsers()
  const user = users?.find(u => u.email === 'gridironeliterecruiting@gmail.com')
  
  if (!user) {
    console.log('User not found')
    return
  }
  
  const { data: gmailToken } = await supabase
    .from('gmail_tokens')
    .select('refresh_token, token_expiry')
    .eq('user_id', user.id)
    .single()
  
  console.log('Gmail Token Info:')
  console.log(`- Has refresh token: ${gmailToken?.refresh_token ? 'YES' : 'NO'}`)
  console.log(`- Refresh token length: ${gmailToken?.refresh_token?.length || 0}`)
  console.log(`- Token expired: ${new Date(gmailToken?.token_expiry) < new Date() ? 'YES' : 'NO'}`)
  
  if (!gmailToken?.refresh_token) {
    console.log('\n⚠️  NO REFRESH TOKEN! This is why tokens can\'t be refreshed.')
    console.log('The user needs to re-authorize Gmail to get a refresh token.')
  }
}

checkRefreshToken().catch(console.error)