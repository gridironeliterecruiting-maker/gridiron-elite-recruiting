require('dotenv').config({ path: '.env.local' })

const CRON_SECRET = process.env.CRON_SECRET
const APP_URL = process.env.NEXT_PUBLIC_APP_URL || 'https://gridironeliterecruiting.com'

async function triggerEmailQueue() {
  console.log('Triggering email queue processor...')
  
  try {
    const res = await fetch(`${APP_URL}/api/email/process-queue`, {
      headers: {
        'Authorization': `Bearer ${CRON_SECRET}`,
      },
    })
    
    if (!res.ok) {
      const error = await res.text()
      console.error('Failed to trigger queue:', error)
      return
    }
    
    const result = await res.json()
    console.log('\n✅ Queue processed successfully!')
    console.log(`- Emails processed: ${result.processed}`)
    console.log(`- Emails sent: ${result.sent}`)
    console.log(`- Errors: ${result.errors}`)
    
    if (result.message) {
      console.log(`- Message: ${result.message}`)
    }
  } catch (error) {
    console.error('Error triggering queue:', error)
  }
}

triggerEmailQueue().catch(console.error)