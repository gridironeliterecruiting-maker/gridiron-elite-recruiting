import { NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'

export async function POST() {
  const admin = createAdminClient()
  
  // Update the kill switch to enable email sending
  const { error } = await admin
    .from('system_settings')
    .update({ value: 'true' })
    .eq('key', 'email_sending_enabled')
    
  if (error) {
    console.error('Failed to enable email sending:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
  
  // Verify the update
  const { data: updated } = await admin
    .from('system_settings')
    .select('*')
    .eq('key', 'email_sending_enabled')
    .single()
    
  return NextResponse.json({ 
    success: true, 
    message: 'Email sending enabled',
    setting: updated 
  })
}