-- Event-driven campaign scheduling with pg_cron
-- Enables one-time scheduled HTTP calls to process-queue at the exact time
-- the user chose, instead of relying on a daily cron poll.

CREATE EXTENSION IF NOT EXISTS pg_cron;
CREATE EXTENSION IF NOT EXISTS pg_net;

-- Store process-queue URL and cron secret in system_settings
INSERT INTO system_settings (key, value) VALUES
  ('process_queue_url', 'https://runwayrecruit.com/api/email/process-queue'),
  ('cron_secret', 'gridiron-cron-secret-2024')
ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value;

-- Schedule a one-time pg_cron job to trigger process-queue at a specific time.
-- The job self-deletes after firing.
CREATE OR REPLACE FUNCTION schedule_campaign_send(
  p_campaign_id TEXT,
  p_send_at TIMESTAMPTZ
) RETURNS BIGINT AS $$
DECLARE
  v_job_name TEXT;
  v_cron_expr TEXT;
  v_job_id BIGINT;
  v_url TEXT;
  v_secret TEXT;
BEGIN
  v_job_name := 'campaign_' || p_campaign_id;

  -- Read config from system_settings
  SELECT value INTO v_url FROM system_settings WHERE key = 'process_queue_url';
  SELECT value INTO v_secret FROM system_settings WHERE key = 'cron_secret';

  -- Convert send_at to UTC cron expression (minute hour day month *)
  v_cron_expr := EXTRACT(MINUTE FROM p_send_at AT TIME ZONE 'UTC') || ' ' ||
                 EXTRACT(HOUR FROM p_send_at AT TIME ZONE 'UTC') || ' ' ||
                 EXTRACT(DAY FROM p_send_at AT TIME ZONE 'UTC') || ' ' ||
                 EXTRACT(MONTH FROM p_send_at AT TIME ZONE 'UTC') || ' *';

  -- Schedule the job
  SELECT cron.schedule(
    v_job_name,
    v_cron_expr,
    format(
      'SELECT net.http_get(url := %L, headers := %L::jsonb); SELECT cron.unschedule(%L);',
      v_url,
      json_build_object('Authorization', 'Bearer ' || v_secret)::text,
      v_job_name
    )
  ) INTO v_job_id;

  RETURN v_job_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Cancel a scheduled campaign send. Safe to call even if no job exists.
CREATE OR REPLACE FUNCTION unschedule_campaign_send(p_campaign_id TEXT)
RETURNS VOID AS $$
BEGIN
  PERFORM cron.unschedule('campaign_' || p_campaign_id);
EXCEPTION WHEN OTHERS THEN
  NULL;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
