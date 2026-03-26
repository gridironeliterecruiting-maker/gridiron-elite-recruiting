import { NextResponse } from 'next/server'

export async function GET() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || ''
  const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || ''

  const html = `<!DOCTYPE html>
<html>
<head><title>Realtime Test</title></head>
<body>
<h1>Supabase Realtime Test</h1>
<div id="log" style="font-family:monospace;white-space:pre-wrap;"></div>
<script type="module">
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const log = (msg) => {
  document.getElementById('log').textContent += new Date().toLocaleTimeString() + ' ' + msg + '\\n'
  console.log(msg)
}

const SUPABASE_URL = "${supabaseUrl}"
const SUPABASE_KEY = "${supabaseKey}"

log('Creating Supabase client...')
log('URL: ' + SUPABASE_URL)

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY)

log('Subscribing to channel test-room...')
const channel = supabase
  .channel('test-room')
  .on('broadcast', { event: 'test' }, (payload) => {
    log('Received broadcast: ' + JSON.stringify(payload))
  })
  .subscribe((status) => {
    log('Subscription status: ' + status)
  })
</script>
</body>
</html>`

  return new NextResponse(html, {
    headers: { 'Content-Type': 'text/html' },
  })
}
