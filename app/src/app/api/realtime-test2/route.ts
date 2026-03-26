import { NextResponse } from 'next/server'

export async function GET() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || ''
  const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || ''
  const wsUrl = `wss://${supabaseUrl.replace('https://', '')}/realtime/v1`

  const encodedKey = Buffer.from(supabaseKey).toString('base64')
  const encodedWsUrl = Buffer.from(wsUrl).toString('base64')

  const html = `<!DOCTYPE html>
<html>
<head><title>Realtime Test 2</title></head>
<body>
<h1>Realtime Test 2 - RealtimeClient Direct</h1>
<div id="log" style="font-family:monospace;white-space:pre-wrap;"></div>
<script type="module">
import { RealtimeClient } from 'https://esm.sh/@supabase/realtime-js@2'

const log = (msg) => {
  document.getElementById('log').textContent += new Date().toLocaleTimeString() + ' ' + msg + '\\n'
  console.log(msg)
}

const WS_URL = atob('${encodedWsUrl}')
const API_KEY = atob('${encodedKey}')

log('Creating RealtimeClient...')
log('URL: ' + WS_URL)

const client = new RealtimeClient(WS_URL, {
  params: { apikey: API_KEY }
})

log('Connecting...')
client.connect()

log('Creating channel...')
const channel = client.channel('test-room')
channel
  .on('broadcast', { event: 'test' }, (payload) => {
    log('Broadcast received: ' + JSON.stringify(payload))
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
