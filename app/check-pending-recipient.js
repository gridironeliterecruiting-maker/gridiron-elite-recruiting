const { createClient } = require('@supabase/supabase-js')
require('dotenv').config({ path: '.env.local' })

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
)

async function checkPendingRecipient() {
  // Get the pending recipient
  const { data: recipients } = await supabase
    .from('campaign_recipients')
    .select('*, campaigns!inner(*)')
    .eq('status', 'scheduled')
    .lte('next_send_at', new Date().toISOString())
    .limit(5)
  
  if (!recipients || recipients.length === 0) {
    console.log('No pending recipients found')
    return
  }
  
  console.log(`Found ${recipients.length} pending recipient(s):\n`)
  
  for (const r of recipients) {
    console.log(`Recipient ID: ${r.id}`)
    console.log(`- Email: ${r.coach_email}`)
    console.log(`- Status: ${r.status}`)
    console.log(`- Current step: ${r.current_step}`)
    console.log(`- Next send at: ${new Date(r.next_send_at).toLocaleString()}`)
    console.log(`- Campaign: ${r.campaigns.name} (${r.campaigns.status})`)
    console.log(`- Campaign ID: ${r.campaign_id}`)
    console.log(`- User ID: ${r.campaigns.user_id}`)
    
    // Check if user is gridironeliterecruiting
    const { data: { users } } = await supabase.auth.admin.listUsers()
    const user = users?.find(u => u.id === r.campaigns.user_id)
    console.log(`- User email: ${user?.email || 'NOT FOUND'}`)
    console.log('')
  }
}

checkPendingRecipient().catch(console.error)