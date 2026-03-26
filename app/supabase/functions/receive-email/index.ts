import "@supabase/functions-js/edge-runtime.d.ts"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2"

Deno.serve(async (req) => {
  // Handle GET for Zoho webhook verification
  if (req.method === "GET") {
    return new Response(
      JSON.stringify({ status: "ok", service: "mail360-webhook" }),
      { headers: { "Content-Type": "application/json" } }
    )
  }

  // Only process POST requests
  if (req.method !== "POST") {
    return new Response(
      JSON.stringify({ ok: true }),
      { headers: { "Content-Type": "application/json" } }
    )
  }

  try {
    const payload = await req.json()
    const event = payload.event || payload.operation || ""

    console.log("[receive-email] Event:", event, "| account_key:", payload.account_key)

    if (event === "newMail") {
      const accountKey = payload.account_key || ""
      const threadId = payload.thread_id || ""
      const fromAddress = payload.from_address || ""
      const toAddress = payload.to_address || ""
      const subject = payload.subject || ""
      const summary = payload.summary || ""
      const messageId = payload.message_id || ""
      const receivedTime = payload.received_time || ""

      if (!accountKey) {
        console.error("[receive-email] newMail missing account_key")
        return new Response(
          JSON.stringify({ ok: true }),
          { headers: { "Content-Type": "application/json" } }
        )
      }

      // Use Service Role key to bypass RLS
      const supabase = createClient(
        Deno.env.get("SUPABASE_URL")!,
        Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
      )

      // Look up which user owns this account_key
      const { data: profile } = await supabase
        .from("profiles")
        .select("id, workspace_email")
        .eq("zoho_account_key", accountKey)
        .maybeSingle()

      if (!profile) {
        console.warn("[receive-email] No user found for account_key:", accountKey)
        return new Response(
          JSON.stringify({ ok: true }),
          { headers: { "Content-Type": "application/json" } }
        )
      }

      // Insert notification — Supabase Realtime will broadcast this
      const { error } = await supabase
        .from("email_notifications")
        .insert({
          user_id: profile.id,
          account_key: accountKey,
          thread_id: threadId,
          message_id: messageId,
          from_address: fromAddress,
          to_address: toAddress,
          subject,
          summary,
          received_at: receivedTime
            ? new Date(parseInt(receivedTime, 10)).toISOString()
            : new Date().toISOString(),
        })

      if (error) {
        console.error("[receive-email] Insert error:", error.message)
      } else {
        console.log("[receive-email] Notification saved for user:", profile.id)
      }
    }

    // Always return 200 so Zoho doesn't retry
    return new Response(
      JSON.stringify({ ok: true }),
      { headers: { "Content-Type": "application/json" } }
    )
  } catch (err) {
    console.error("[receive-email] Error:", err)
    return new Response(
      JSON.stringify({ ok: true }),
      { headers: { "Content-Type": "application/json" } }
    )
  }
})
