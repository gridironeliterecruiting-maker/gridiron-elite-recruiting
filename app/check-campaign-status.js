const { createClient } = require('@supabase/supabase-js')
require('dotenv').config({ path: '.env.local' })

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
)

async function checkCampaignStatus() {
  // Get recent campaigns
  const { data: campaigns } = await supabase
    .from('campaigns')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(5)
  
  console.log('Recent campaigns:')
  for (const c of campaigns || []) {
    console.log(`\nCampaign: ${c.name}`)
    console.log(`- ID: ${c.id}`)
    console.log(`- Status: ${c.status}`)
    console.log(`- Created: ${new Date(c.created_at).toLocaleString()}`)
    console.log(`- Scheduled: ${c.scheduled_at ? new Date(c.scheduled_at).toLocaleString() : 'Not scheduled'}`)
    
    // Get recipients for this campaign
    const { data: recipients } = await supabase
      .from('campaign_recipients')
      .select('*')
      .eq('campaign_id', c.id)
    
    console.log(`- Recipients: ${recipients?.length || 0}`)
    
    if (recipients && recipients.length > 0) {
      // Group by status
      const statusCounts = recipients.reduce((acc, r) => {
        acc[r.status] = (acc[r.status] || 0) + 1
        return acc
      }, {})
      
      console.log('- Status breakdown:', statusCounts)
      
      // Show a sample recipient
      const sample = recipients[0]
      console.log('\n  Sample recipient:')
      console.log(`  - Email: ${sample.coach_email}`)
      console.log(`  - Status: ${sample.status}`)
      console.log(`  - Next send at: ${sample.next_send_at ? new Date(sample.next_send_at).toLocaleString() : 'None'}`)
      console.log(`  - Current time: ${new Date().toLocaleString()}`)
      
      // Check if this email is past due
      if (sample.next_send_at) {
        const sendTime = new Date(sample.next_send_at)
        const now = new Date()
        console.log(`  - Due? ${sendTime <= now ? 'YES' : 'NO'} (${sendTime <= now ? Math.round((now - sendTime) / 60000) + ' minutes ago' : 'in ' + Math.round((sendTime - now) / 60000) + ' minutes'})`)
      }
    }
  }
}

checkCampaignStatus().catch(console.error)