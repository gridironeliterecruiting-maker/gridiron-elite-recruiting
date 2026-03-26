import { NextResponse } from 'next/server'

// Simple HTML page that tests Supabase Realtime WebSocket directly
// No SSR, no createBrowserClient, no @supabase/ssr — just raw supabase-js
export async function GET() {
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

log('Creating Supabase client...')
const supabase = createClient(
  '${process.env.NEXT_PUBLIC_SUPABASE_URL}',
  '${process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY}'
)

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
