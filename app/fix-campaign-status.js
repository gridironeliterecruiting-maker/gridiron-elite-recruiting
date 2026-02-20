const { createClient } = require('@supabase/supabase-js')
require('dotenv').config({ path: '.env.local' })

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
)

async function fixCampaignStatus() {
  const campaignId = '36dedaf6-401e-4d81-af87-1000cd465f81'
  
  console.log(`Updating campaign ${campaignId} status to 'active'...`)
  
  const { error } = await supabase
    .from('campaigns')
    .update({ 
      status: 'active',
      updated_at: new Date().toISOString()
    })
    .eq('id', campaignId)
  
  if (error) {
    console.error('Failed to update campaign:', error)
  } else {
    console.log('✅ Campaign status updated to active!')
  }
  
  // Now trigger the queue
  console.log('\nTriggering email queue...')
  const CRON_SECRET = process.env.CRON_SECRET
  const APP_URL = process.env.NEXT_PUBLIC_APP_URL || 'https://gridironeliterecruiting.com'
  
  const res = await fetch(`${APP_URL}/api/email/process-queue`, {
    headers: {
      'Authorization': `Bearer ${CRON_SECRET}`,
    },
  })
  
  const result = await res.json()
  console.log('\nQueue result:')
  console.log(`- Processed: ${result.processed}`)
  console.log(`- Sent: ${result.sent}`)
  console.log(`- Errors: ${result.errors}`)
}

fixCampaignStatus().catch(console.error)