const { createClient } = require('@supabase/supabase-js')
require('dotenv').config({ path: '.env.local' })

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY

if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
  console.error('Missing Supabase environment variables')
  process.exit(1)
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)

async function debugEmailSending() {
  console.log('=== EMAIL SENDING DEBUG ===\n')
  
  // 1. Check global kill switch
  console.log('1. Checking global kill switch...')
  const { data: killSwitch } = await supabase
    .from('system_settings')
    .select('value')
    .eq('key', 'email_sending_enabled')
    .single()
  
  console.log(`   Email sending enabled: ${killSwitch?.value === 'true' ? '✅ YES' : '❌ NO'}`)
  if (killSwitch?.value !== 'true') {
    console.log('   ⚠️  This would block ALL email sending!')
  }
  
  // 2. Check gridironeliterecruiting@gmail.com user
  console.log('\n2. Checking gridironeliterecruiting@gmail.com user...')
  const { data: { users } } = await supabase.auth.admin.listUsers()
  const targetUser = users?.find(u => u.email === 'gridironeliterecruiting@gmail.com')
  
  if (!targetUser) {
    console.log('   ❌ User not found!')
    return
  }
  
  console.log(`   User ID: ${targetUser.id}`)
  
  // 3. Check user's can_send_emails permission
  console.log('\n3. Checking user email permission...')
  const { data: profile } = await supabase
    .from('profiles')
    .select('can_send_emails')
    .eq('id', targetUser.id)
    .single()
  
  console.log(`   Can send emails: ${profile?.can_send_emails ? '✅ YES' : '❌ NO'}`)
  if (!profile?.can_send_emails) {
    console.log('   ⚠️  This would block this user from sending ANY emails!')
  }
  
  // 4. Check Gmail token
  console.log('\n4. Checking Gmail token...')
  const { data: gmailToken } = await supabase
    .from('gmail_tokens')
    .select('email, token_expiry, account_tier, connected_at')
    .eq('user_id', targetUser.id)
    .single()
  
  if (!gmailToken) {
    console.log('   ❌ No Gmail token found!')
  } else {
    console.log(`   Gmail email: ${gmailToken.email}`)
    console.log(`   Token expires: ${new Date(gmailToken.token_expiry).toLocaleString()}`)
    console.log(`   Token expired: ${new Date(gmailToken.token_expiry) < new Date() ? '❌ YES' : '✅ NO'}`)
    console.log(`   Account tier: ${gmailToken.account_tier}`)
  }
  
  // 5. Check for active campaigns
  console.log('\n5. Checking for active campaigns...')
  const { data: campaigns } = await supabase
    .from('campaigns')
    .select('id, name, status, scheduled_at')
    .eq('user_id', targetUser.id)
    .eq('status', 'active')
  
  console.log(`   Active campaigns: ${campaigns?.length || 0}`)
  campaigns?.forEach(c => {
    console.log(`   - ${c.name} (ID: ${c.id})`)
  })
  
  // 6. Check for scheduled recipients
  console.log('\n6. Checking for scheduled recipients...')
  const { data: scheduledRecipients } = await supabase
    .from('campaign_recipients')
    .select('id, coach_email, status, next_send_at, campaign_id')
    .eq('status', 'scheduled')
    .lte('next_send_at', new Date().toISOString())
    .limit(10)
  
  console.log(`   Recipients due for sending: ${scheduledRecipients?.length || 0}`)
  
  if (scheduledRecipients?.length > 0) {
    console.log('\n7. Checking email allowlist for first recipient...')
    const firstRecipient = scheduledRecipients[0]
    const { data: allowed } = await supabase
      .from('email_allowlist')
      .select('id')
      .eq('email', firstRecipient.coach_email)
      .single()
    
    console.log(`   ${firstRecipient.coach_email}: ${allowed ? '✅ ALLOWED' : '❌ NOT IN ALLOWLIST'}`)
    if (!allowed) {
      console.log('   ⚠️  This would block sending to this recipient!')
    }
  }
  
  // Summary
  console.log('\n=== SUMMARY ===')
  console.log('Email sending requires ALL of these to be true:')
  console.log(`1. Global kill switch enabled: ${killSwitch?.value === 'true' ? '✅' : '❌'}`)
  console.log(`2. User has can_send_emails: ${profile?.can_send_emails ? '✅' : '❌'}`)
  console.log(`3. Gmail token exists: ${gmailToken ? '✅' : '❌'}`)
  console.log(`4. Gmail token not expired: ${gmailToken && new Date(gmailToken.token_expiry) > new Date() ? '✅' : '❌'}`)
  console.log(`5. Recipients in allowlist: Check individual recipients above`)
}

debugEmailSending().catch(console.error)