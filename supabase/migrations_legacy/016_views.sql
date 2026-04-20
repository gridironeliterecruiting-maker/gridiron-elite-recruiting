-- Captures the campaign_clean_stats view that was created directly in the
-- production Supabase dashboard (never committed as a migration until now).
-- Source of truth for engagement stats — scanner-flagged events are excluded
-- here via scanner_flagged_at IS NULL, so the view must be queried instead of
-- email_events directly.
--
-- Pulled from prod (project ufmzldfkdpjeyvjfpoid) via pg_get_viewdef on 2026-04-19.

CREATE OR REPLACE VIEW public.campaign_clean_stats AS
SELECT
    c.id AS campaign_id,
    count(DISTINCT cr.id) AS total_recipients,
    count(DISTINCT CASE
        WHEN ee.event_type = 'sent' THEN ee.recipient_id
    END) AS sent_count,
    count(DISTINCT CASE
        WHEN ee.event_type = 'opened' AND ee.scanner_flagged_at IS NULL THEN ee.recipient_id
    END) AS unique_opens,
    count(DISTINCT CASE
        WHEN ee.event_type = 'clicked' AND ee.scanner_flagged_at IS NULL THEN ee.recipient_id
    END) AS unique_clickers,
    count(CASE
        WHEN ee.event_type = 'clicked' AND ee.scanner_flagged_at IS NULL THEN 1
    END) AS total_clicks,
    count(DISTINCT CASE
        WHEN ee.event_type = 'replied' THEN ee.recipient_id
    END) AS replied_count,
    count(DISTINCT CASE
        WHEN cr.status = ANY (ARRAY['bounced', 'error']) THEN cr.id
    END) AS error_count
FROM campaigns c
LEFT JOIN campaign_recipients cr ON cr.campaign_id = c.id
LEFT JOIN email_events ee ON ee.recipient_id = cr.id
GROUP BY c.id;
